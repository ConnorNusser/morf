// Loads global per-exercise records, seeding first-run from workout history AND
// legacy profile.lifts so existing users' rank doesn't drop on upgrade.
import { storageService } from '@/lib/storage/storage';
import { ExerciseRecord, GeneratedWorkout, UserLift, isFeaturedLift } from '@/types';
import { updateExerciseRecords } from './progression';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { convertWeightToLbs } from '@/lib/utils/utils';

export async function loadExerciseRecords(
  history: GeneratedWorkout[]
): Promise<Record<string, ExerciseRecord>> {
  const existing = await storageService.getExerciseRecords();
  if (Object.keys(existing).length > 0) return existing; // already migrated

  // Seed anchors + bests from history, oldest→newest.
  const sorted = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let records: Record<string, ExerciseRecord> = {};
  for (const w of sorted) {
    records = updateExerciseRecords(records, w.exercises, new Date(w.createdAt));
  }

  // Fold in legacy profile.lifts bests (e.g. onboarding lifts, never logged as a
  // workout). Best-only; the anchor stays the latest real session. The `lifts`
  // fields are removed from the type but the data still persists on disk.
  const profile = await storageService.getUserProfile();
  const legacyProfile = profile as unknown as { lifts?: UserLift[]; secondaryLifts?: UserLift[] } | null;
  const legacy = [...(legacyProfile?.lifts ?? []), ...(legacyProfile?.secondaryLifts ?? [])];
  for (const lift of legacy) {
    if (lift.weight <= 0) continue;
    const lbs = lift.unit === 'lbs' ? lift.weight : convertWeightToLbs(lift.weight, lift.unit);
    const e1rm = OneRMCalculator.estimate(lbs, lift.reps);
    const rec = records[lift.id];
    if (!rec) {
      records[lift.id] = {
        exerciseId: lift.id,
        isMainLift: isFeaturedLift(lift.id),
        weight: lbs,
        reps: lift.reps,
        unit: 'lbs',
        updatedAt: new Date(lift.dateRecorded),
        bestE1RMLbs: e1rm,
        bestE1RMAt: new Date(lift.dateRecorded),
      };
    } else if (e1rm > rec.bestE1RMLbs) {
      records[lift.id] = { ...rec, bestE1RMLbs: e1rm, bestE1RMAt: new Date(lift.dateRecorded) };
    }
  }

  await storageService.saveExerciseRecords(records);
  return records;
}
