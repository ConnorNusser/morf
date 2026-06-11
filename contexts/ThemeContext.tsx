import { storageService } from '@/lib/storage/storage';
import { Theme, ThemeLevel, getNextTheme, themes } from '@/lib/ui/theme';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeContextType {
  currentTheme: Theme;
  currentThemeLevel: ThemeLevel;
  themes: typeof themes;
  progressToNextTheme: () => void;
  setThemeLevel: (level: ThemeLevel) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to the dark theme for new users (until they pick one in settings).
  const getDefaultTheme = (): ThemeLevel => 'beginner_dark';

  // Initialize with system preference, will be updated from storage
  const [currentThemeLevel, setCurrentThemeLevel] = useState<ThemeLevel>(getDefaultTheme());

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      const savedTheme = await storageService.getThemePreference();
      // If no saved theme (null/undefined), fall back to the default (dark).
      if (savedTheme) {
        setCurrentThemeLevel(savedTheme);
      } else {
        const defaultTheme = getDefaultTheme();
        setCurrentThemeLevel(defaultTheme);
        await storageService.saveThemePreference(defaultTheme);
      }
    };
    loadThemePreference();
  }, []);

  const setThemeLevel = useCallback(async (level: ThemeLevel) => {
    setCurrentThemeLevel(level);
    // Persist theme preference to storage
    await storageService.saveThemePreference(level);
  }, []);

  const progressToNextTheme = useCallback(() => {
    const nextTheme = getNextTheme(currentThemeLevel);
    setThemeLevel(nextTheme);
  }, [currentThemeLevel, setThemeLevel]);

  // Ensure we always have a valid theme
  const currentTheme = themes[currentThemeLevel] || themes.beginner;

  const value = useMemo(() => ({
    currentTheme,
    currentThemeLevel,
    themes,
    progressToNextTheme,
    setThemeLevel,
  }), [currentTheme, currentThemeLevel, progressToNextTheme, setThemeLevel]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 