import { storageService } from '@/lib/storage';
import { Theme, ThemeLevel, getNextTheme, themes } from '@/lib/theme';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  currentTheme: Theme;
  currentThemeLevel: ThemeLevel;
  themes: typeof themes;
  progressToNextTheme: () => void;
  setThemeLevel: (level: ThemeLevel) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize with the beginner theme, will be updated from storage
  const [currentThemeLevel, setCurrentThemeLevel] = useState<ThemeLevel>('beginner');

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      const savedTheme = await storageService.getThemePreference();
      setCurrentThemeLevel(savedTheme);
    };
    loadThemePreference();
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