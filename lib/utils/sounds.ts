// Sound registry - automatically import and export all sound files
export const SOUNDS = {
  notification: require('../../assets/sounds/notification.mp3'),
  beep: require('../../assets/sounds/beep.mp3'),
  pop: require('../../assets/sounds/pop.mp3'),
  whoosh: require('../../assets/sounds/whoosh.mp3'),

  // UI interaction sounds (.wav files)
  tapVariant1: require('../../assets/sounds/ui_tap-variant-01.wav'),
  tapVariant2: require('../../assets/sounds/ui_tap-variant-02.wav'),
  tapVariant3: require('../../assets/sounds/ui_tap-variant-03.wav'),
  tapVariant4: require('../../assets/sounds/ui_tap-variant-04.wav'),
  unlock: require('../../assets/sounds/ui_unlock.wav'),
  lock: require('../../assets/sounds/ui_lock.wav'),

  // Navigation sounds
  hoverTap: require('../../assets/sounds/navigation_hover-tap.wav'),
  selectionComplete: require('../../assets/sounds/navigation_selection-complete-celebration.wav'),
  forwardMinimal: require('../../assets/sounds/navigation_forward-selection-minimal.wav'),
  backwardMinimal: require('../../assets/sounds/navigation_backward-selection-minimal.wav'),

  // State changes
  confirmUp: require('../../assets/sounds/state-change_confirm-up.wav'),
  confirmDown: require('../../assets/sounds/state-change_confirm-down.wav'),
} as const;

// Type for sound names - provides autocompletion
export type SoundName = keyof typeof SOUNDS;

// Helper function to get sound by name
export const getSound = (soundName: SoundName) => SOUNDS[soundName];

// List of all available sound names
export const SOUND_NAMES = Object.keys(SOUNDS) as SoundName[];

// Sound categories for better organization
export const SOUND_CATEGORIES = {
  feedback: ['beep', 'pop'] as SoundName[],
  notifications: ['notification'] as SoundName[],
  transitions: ['whoosh'] as SoundName[],
  
  // UI interactions
  taps: ['tapVariant1', 'tapVariant2', 'tapVariant3', 'tapVariant4'] as SoundName[],
  security: ['unlock', 'lock'] as SoundName[],
  
  // Navigation
  navigation: ['hoverTap', 'selectionComplete', 'forwardMinimal', 'backwardMinimal'] as SoundName[],
  
  // State changes
  stateChanges: ['confirmUp', 'confirmDown'] as SoundName[],
} as const; 