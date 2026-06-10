import { storageService, TutorialState } from '@/lib/storage/storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type { TutorialState };

interface TutorialContextType {
  tutorialState: TutorialState;
  isLoading: boolean;
  showTutorial: boolean;
  currentScreen: 'home' | 'workout' | 'history' | 'profile' | 'notes' | null;
  currentStep: number;
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  setCurrentScreen: (screen: 'home' | 'workout' | 'history' | 'profile' | 'notes') => void;
  resetTutorials: () => Promise<void>;
}

const defaultTutorialState: TutorialState = {
  hasCompletedAppTutorial: false,
  tutorialsCompleted: {
    home: false,
    workout: false,
    history: false,
    profile: false,
  },
};

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const _TUTORIAL_STORAGE_KEY = '@morf/tutorial_state';

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [tutorialState, setTutorialState] = useState<TutorialState>(defaultTutorialState);
  const [isLoading, setIsLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'workout' | 'history' | 'profile' | 'notes' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const loadTutorialState = useCallback(async () => {
    try {
      const data = await storageService.getTutorialState();
      if (data) {
        setTutorialState(data);
      }
    } catch (error) {
      console.error('Error loading tutorial state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load tutorial state on mount
  useEffect(() => {
    loadTutorialState();
  }, [loadTutorialState]);

  const saveTutorialState = useCallback(async (newState: TutorialState) => {
    try {
      await storageService.saveTutorialState(newState);
      setTutorialState(newState);
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  }, []);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setCurrentScreen('home');
    setShowTutorial(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const skipTutorial = useCallback(async () => {
    setShowTutorial(false);
    setCurrentStep(0);
    setCurrentScreen(null);

    const newState: TutorialState = {
      hasCompletedAppTutorial: true,
      tutorialsCompleted: {
        home: true,
        workout: true,
        history: true,
        profile: true,
      },
    };
    await saveTutorialState(newState);
  }, [saveTutorialState]);

  const completeTutorial = useCallback(async () => {
    setShowTutorial(false);
    setCurrentStep(0);
    setCurrentScreen(null);

    const newState: TutorialState = {
      hasCompletedAppTutorial: true,
      tutorialsCompleted: {
        home: true,
        workout: true,
        history: true,
        profile: true,
      },
    };
    await saveTutorialState(newState);
  }, [saveTutorialState]);

  const resetTutorials = useCallback(async () => {
    await saveTutorialState(defaultTutorialState);
    setShowTutorial(false);
    setCurrentStep(0);
    setCurrentScreen(null);
  }, [saveTutorialState]);

  const value: TutorialContextType = useMemo(() => ({
    tutorialState,
    isLoading,
    showTutorial,
    currentScreen,
    currentStep,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    setCurrentScreen,
    resetTutorials,
  }), [tutorialState, isLoading, showTutorial, currentScreen, currentStep, startTutorial, nextStep, previousStep, skipTutorial, completeTutorial, resetTutorials]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
