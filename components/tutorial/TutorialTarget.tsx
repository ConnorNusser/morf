import { useTutorial } from '@/contexts/TutorialContext';
import React, { useCallback, useEffect, useRef } from 'react';
import { View, LayoutChangeEvent, ViewStyle } from 'react-native';

interface TutorialTargetProps {
  id: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

// Registry to store measured positions of tutorial targets
export const tutorialTargetRegistry = new Map<string, {
  x: number;
  y: number;
  width: number;
  height: number;
}>();

export function TutorialTarget({ id, children, style }: TutorialTargetProps) {
  const viewRef = useRef<View>(null);
  const { showTutorial } = useTutorial();

  const measureAndRegister = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          tutorialTargetRegistry.set(id, { x, y, width, height });
        }
      });
    }
  }, [id]);

  // Measure when tutorial becomes visible or layout changes
  useEffect(() => {
    if (showTutorial) {
      // Small delay to ensure layout is complete
      const timer = setTimeout(measureAndRegister, 100);
      return () => clearTimeout(timer);
    }
  }, [showTutorial, measureAndRegister]);

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    if (showTutorial) {
      measureAndRegister();
    }
  }, [showTutorial, measureAndRegister]);

  return (
    <View ref={viewRef} onLayout={handleLayout} style={style} collapsable={false}>
      {children}
    </View>
  );
}

export function getTargetPosition(id: string) {
  return tutorialTargetRegistry.get(id);
}

export function clearTargetRegistry() {
  tutorialTargetRegistry.clear();
}
