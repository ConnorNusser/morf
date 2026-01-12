import { storageService } from '@/lib/storage/storage';
import { Theme, ThemeLevel, getNextTheme, themes } from '@/lib/ui/theme';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

interface ThemeContextType {
  currentTheme: Theme;
  currentThemeLevel: ThemeLevel;
  themes: typeof themes;
  progressToNextTheme: () => void;
  setThemeLevel: (level: ThemeLevel) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();

  // Get default theme based on system preference
  const getDefaultTheme = (): ThemeLevel => {
    return colorScheme === 'dark' ? 'beginner_dark' : 'beginner';
  };

  // Initialize with system preference, will be updated from storage
  const [currentThemeLevel, setCurrentThemeLevel] = useState<ThemeLevel>(getDefaultTheme());

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      const savedTheme = await storageService.getThemePreference();
      // If no saved theme (null/undefined), use system preference
      if (savedTheme) {
        setCurrentThemeLevel(savedTheme);
      } else {
        // First time user - set based on system preference
        const defaultTheme = getDefaultTheme();
        setCurrentThemeLevel(defaultTheme);
        await storageService.saveThemePreference(defaultTheme);
      }
    };
    loadThemePreference();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount
  }, []);

  const progressToNextTheme = () => {
    const nextTheme = getNextTheme(currentThemeLevel);
    setThemeLevel(nextTheme);
  };

  const setThemeLevel = async (level: ThemeLevel) => {
    setCurrentThemeLevel(level);
    // Persist theme preference to storage
    await storageService.saveThemePreference(level);
  };

  // Ensure we always have a valid theme
  const currentTheme = themes[currentThemeLevel] || themes.beginner;

  const value = {
    currentTheme,
    currentThemeLevel,
    themes,
    progressToNextTheme,
    setThemeLevel,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 