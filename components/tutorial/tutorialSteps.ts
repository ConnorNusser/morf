export type PointerDirection = 'up' | 'down' | 'left' | 'right';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  // ID of the TutorialTarget component to highlight
  targetId?: string;
  // Where the tooltip should appear
  tooltipPosition: 'top' | 'bottom' | 'center';
  // Direction the pointing hand should face
  pointerDirection?: PointerDirection;
  // Screen this step belongs to
  screen: 'home' | 'workout' | 'history' | 'profile' | 'notes';
}

export const tutorialSteps: TutorialStep[] = [
  // Home Screen
  {
    id: 'home-welcome',
    title: 'Welcome to Morf!',
    description: 'Let me show you around. This quick tour covers the essentials.',
    tooltipPosition: 'center',
    screen: 'home',
  },
  {
    id: 'home-leaderboard',
    title: 'Leaderboards',
    description: 'See how you rank against other lifters. Compete with friends and track your standing!',
    targetId: 'home-leaderboard-button',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'home',
  },
  // Workout Screen
  {
    id: 'workout-input',
    title: 'Log Your Workouts',
    description: 'Type exercises naturally like "Bench 135x10" or "Squat 225 3x5". The app parses it automatically!',
    targetId: 'workout-note-input',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'workout',
  },
  // Routines Screen
  {
    id: 'notes-intro',
    title: 'Your Routines',
    description: 'Create and manage workout routines here. Start a routine to get suggested weights based on your progress.',
    tooltipPosition: 'center',
    screen: 'notes',
  },
  {
    id: 'notes-ai-generate',
    title: 'AI Routine Generator',
    description: 'Tap here to create a personalized program based on your goals and experience level.',
    targetId: 'notes-ai-button',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'notes',
  },
  // History Screen
  {
    id: 'history-intro',
    title: 'Workout History',
    description: 'View past workouts, track your streak, and see progress over time.',
    tooltipPosition: 'center',
    screen: 'history',
  },
  // Profile Screen
  {
    id: 'profile-stats',
    title: 'Your Stats',
    description: 'Keep your weight and body stats updated for accurate strength percentiles and progress tracking.',
    targetId: 'profile-personal-info',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'profile',
  },
  {
    id: 'profile-complete',
    title: "You're All Set!",
    description: 'Start logging workouts and building your routines. Replay this tour anytime from Profile.',
    tooltipPosition: 'center',
    screen: 'profile',
  },
];

export const getStepsByIndex = (index: number): TutorialStep | undefined => {
  return tutorialSteps[index];
};

export const getTotalSteps = (): number => {
  return tutorialSteps.length;
};
