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
  // Home Screen Steps
  {
    id: 'home-welcome',
    title: 'Welcome to Morf!',
    description: 'Let me show you around the app. This quick tour will help you get started.',
    tooltipPosition: 'center',
    screen: 'home',
  },
  {
    id: 'home-feed',
    title: 'Community Feed',
    description: 'Switch to Feed to see what others are lifting! Share your workouts and connect with the community.',
    targetId: 'home-view-selector',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'home',
  },
  {
    id: 'home-stats',
    title: 'Your Strength Stats',
    description: 'This card shows your overall strength level compared to other lifters. Track your progress as you get stronger!',
    targetId: 'home-overall-stats',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'home',
  },
  {
    id: 'home-leaderboard',
    title: 'Leaderboards',
    description: 'Tap here to see how you rank against other lifters. Compete with friends and track your standing!',
    targetId: 'home-leaderboard-button',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'home',
  },
  // Workout Screen Steps
  {
    id: 'workout-intro',
    title: 'Log Your Workouts',
    description: 'This is where you record your exercises. Just type naturally like you would in notes!',
    tooltipPosition: 'center',
    screen: 'workout',
  },
  {
    id: 'workout-input',
    title: 'Workout Notes',
    description: 'Type your exercises here. Use format like "Bench Press 135x10" or "Squat 225 3x5". The app will parse it automatically!',
    targetId: 'workout-note-input',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'workout',
  },
  {
    id: 'workout-header',
    title: 'Workout Tools',
    description: 'Use these buttons to access the AI Plan Builder, view keyword help, see your timer, and finish your workout.',
    targetId: 'workout-header-buttons',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'workout',
  },
  // Routines Screen Steps
  {
    id: 'notes-intro',
    title: 'Your Routines',
    description: 'Create and manage your workout routines here. The app suggests which routine to do next based on when you last did each one.',
    tooltipPosition: 'center',
    screen: 'notes',
  },
  {
    id: 'notes-routine-card',
    title: 'Routine Cards',
    description: 'Tap a card to see exercise details and weights. Hit "Start" to load the routine into your workout!',
    targetId: 'notes-routine-card',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'notes',
  },
  {
    id: 'notes-ai-generate',
    title: 'AI Routine Generator',
    description: 'Tap the sparkle icon to have AI create a personalized workout program based on your goals and experience level.',
    targetId: 'notes-ai-button',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'notes',
  },
  // History Screen Steps
  {
    id: 'history-intro',
    title: 'Your Workout History',
    description: 'View all your past workouts, track progress over time, and manage saved templates.',
    tooltipPosition: 'center',
    screen: 'history',
  },
  {
    id: 'history-content',
    title: 'Your Progress',
    description: 'See your weekly activity, workout streak, and exercise history. Switch tabs to view exercises or saved notes.',
    targetId: 'history-content',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'history',
  },
  // Profile Screen Steps
  {
    id: 'profile-intro',
    title: 'Your Profile',
    description: 'Manage your settings, personal info, and customize your experience.',
    tooltipPosition: 'center',
    screen: 'profile',
  },
  {
    id: 'profile-stats',
    title: 'Personal Info',
    description: 'Update your height, weight, and other details to keep your strength percentiles accurate.',
    targetId: 'profile-personal-info',
    tooltipPosition: 'bottom',
    pointerDirection: 'up',
    screen: 'profile',
  },
  {
    id: 'profile-complete',
    title: "You're All Set!",
    description: 'Explore the app and start logging your workouts. You can replay this tutorial anytime from your Profile.',
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
