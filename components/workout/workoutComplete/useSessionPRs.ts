// The session's PR rows plus the haptics that celebrate them.
import { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { PRInfo, prsFromRewards } from '@/lib/gamification/sessionShareCard';
import playHapticFeedback from '@/lib/utils/haptic';
import { convertWeightToLbs } from '@/lib/utils/utils';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutTextParser';
import { UserProfile, UserProgress } from '@/types';
import { useEffect, useMemo, useRef } from 'react';

// Badge-scan PR detection against the stored lifts. Lives here (not lib/)
// because it leans on ExerciseBadge.
function detectBadgePRs(
  exercises: (ParsedExercise | ParsedExerciseSummary)[],
  userLifts: UserProgress[],
  userProfile: UserProfile | null,
): PRInfo[] {
  const detectedPRs: PRInfo[] = [];
  const bodyWeightLbs = userProfile ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit) : undefined;

  for (const exercise of exercises) {
    if (!exercise.matchedExerciseId || exercise.isCustom) continue;

    const sets = exercise.sets || [];
    if (sets.length === 0) continue;

    const badgeInfo = getExerciseBadgeInfo(
      exercise.matchedExerciseId,
      exercise.isCustom,
      sets,
      userLifts,
      bodyWeightLbs,
      userProfile?.gender,
      userProfile?.age
    );

    if (badgeInfo?.type === 'tier' && badgeInfo.isPR) {
      const exerciseInfo = getCatalogExercise(exercise.matchedExerciseId);
      const userLift = userLifts.find(l => l.workoutId === exercise.matchedExerciseId);

      const best1RM = Math.max(
        ...sets.map(set => {
          if (set.reps === 0) return 0;
          return e1rmLbs(set.weight, set.reps, set.unit);
        }),
        0
      );

      const previousPR = userLift?.personalRecord || 0;
      const improvement = previousPR > 0 ? best1RM - previousPR : 0;

      detectedPRs.push({
        exerciseName: exerciseInfo?.name || exercise.name,
        exerciseId: exercise.matchedExerciseId,
        newPR: Math.round(best1RM),
        previousPR: Math.round(previousPR),
        improvement: Math.round(improvement),
        percentile: badgeInfo.percentile,
      });
    }
  }

  return detectedPRs;
}

export function useSessionPRs({
  rewards,
  exercises,
  userLifts,
  userProfile,
}: {
  rewards?: SessionRewards | null;
  exercises: (ParsedExercise | ParsedExerciseSummary)[];
  userLifts: UserProgress[];
  userProfile: UserProfile | null;
}): PRInfo[] {
  const prs = useMemo((): PRInfo[] => {
    // The history diff is the source of truth for PRs — it covers every
    // featured lift, including secondary lifts the badge scan below misses
    // (which the app already pushes to friends). The badge scan is only the
    // fallback while rewards are still computing (or failed best-effort).
    if (rewards) return prsFromRewards(rewards, userLifts);

    return detectBadgePRs(exercises, userLifts, userProfile);
  }, [rewards, exercises, userLifts, userProfile]);

  useEffect(() => {
    playHapticFeedback(prs.length > 0 ? 'success' : 'medium', false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only haptic
  }, []);

  // Celebrate diff-only PRs that land after mount too.
  const prCelebrated = useRef(false);
  useEffect(() => {
    if (prs.length === 0 || prCelebrated.current) return;
    prCelebrated.current = true;
    playHapticFeedback('success', false);
  }, [prs]);

  return prs;
}
