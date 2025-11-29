// Fun comparison text for workout stats

interface VolumeComparison {
  threshold: number;
  text: string;
  emoji: string;
}

// Volume comparisons (in lbs)
const volumeComparisons: VolumeComparison[] = [
  { threshold: 10000, text: 'a grand piano', emoji: '🎹' },
  { threshold: 25000, text: 'a small car', emoji: '🚗' },
  { threshold: 50000, text: '2 hippos', emoji: '🦛' },
  { threshold: 100000, text: '5 grand pianos', emoji: '🎹' },
  { threshold: 250000, text: 'a blue whale\'s tongue', emoji: '🐋' },
  { threshold: 500000, text: '3 elephants', emoji: '🐘' },
  { threshold: 1000000, text: '6 elephants', emoji: '🐘' },
  { threshold: 2000000, text: 'a school bus', emoji: '🚌' },
  { threshold: 5000000, text: 'the Statue of Liberty\'s head', emoji: '🗽' },
  { threshold: 10000000, text: 'a space shuttle', emoji: '🚀' },
];

// Workout count comparisons
const workoutCountComparisons: VolumeComparison[] = [
  { threshold: 10, text: 'off to a great start', emoji: '🌱' },
  { threshold: 25, text: 'building momentum', emoji: '⚡' },
  { threshold: 50, text: 'a true regular', emoji: '💪' },
  { threshold: 100, text: 'basically living at the gym', emoji: '🏠' },
  { threshold: 150, text: 'a certified gym rat', emoji: '🐀' },
  { threshold: 200, text: 'an absolute machine', emoji: '🤖' },
  { threshold: 250, text: 'beyond human', emoji: '🦸' },
  { threshold: 300, text: 'one with the iron', emoji: '⚔️' },
  { threshold: 365, text: 'literally never missed a day', emoji: '👑' },
];

// Streak comparisons
const streakComparisons: VolumeComparison[] = [
  { threshold: 3, text: 'Hat trick', emoji: '🎩' },
  { threshold: 7, text: 'A whole week strong', emoji: '📅' },
  { threshold: 14, text: 'Two weeks of dedication', emoji: '🔥' },
  { threshold: 21, text: 'Habit formed', emoji: '🧠' },
  { threshold: 30, text: 'A month of gains', emoji: '📈' },
  { threshold: 60, text: 'Two months non-stop', emoji: '🚂' },
  { threshold: 90, text: 'A whole quarter', emoji: '🏆' },
  { threshold: 180, text: 'Half a year', emoji: '⭐' },
  { threshold: 365, text: 'The entire year', emoji: '👑' },
];

export function getVolumeComparison(volume: number): { text: string; emoji: string } {
  // Find the highest threshold that volume exceeds
  for (let i = volumeComparisons.length - 1; i >= 0; i--) {
    if (volume >= volumeComparisons[i].threshold) {
      return {
        text: volumeComparisons[i].text,
        emoji: volumeComparisons[i].emoji,
      };
    }
  }
  return { text: 'a small dog', emoji: '🐕' };
}

export function getWorkoutCountComparison(count: number): { text: string; emoji: string } {
  for (let i = workoutCountComparisons.length - 1; i >= 0; i--) {
    if (count >= workoutCountComparisons[i].threshold) {
      return {
        text: workoutCountComparisons[i].text,
        emoji: workoutCountComparisons[i].emoji,
      };
    }
  }
  return { text: 'just getting started', emoji: '🌟' };
}

export function getStreakComparison(days: number): { text: string; emoji: string } {
  for (let i = streakComparisons.length - 1; i >= 0; i--) {
    if (days >= streakComparisons[i].threshold) {
      return {
        text: streakComparisons[i].text,
        emoji: streakComparisons[i].emoji,
      };
    }
  }
  return { text: 'Every journey starts somewhere', emoji: '🚶' };
}

export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatDateRange(startDate: Date, endDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = startDate.toLocaleDateString('en-US', options);
  const end = endDate.toLocaleDateString('en-US', options);
  return `${start} - ${end}`;
}
