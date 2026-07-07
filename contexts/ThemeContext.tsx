import { storageService } from '@/lib/storage/storage';
import { Theme, ThemeLevel, themes } from '@/lib/ui/theme';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeContextType {
  currentTheme: Theme;
  currentThemeLevel: ThemeLevel;
  themes: typeof themes;
  setThemeLevel: (level: ThemeLevel) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark for new users until they pick one in settings.
  const getDefaultTheme = (): ThemeLevel => 'beginner_dark';

  const [currentThemeLevel, setCurrentThemeLevel] = useState<ThemeLevel>(getDefaultTheme());

  useEffect(() => {
    const loadThemePreference = async () => {
      const savedTheme = await storageService.getThemePreference();
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
    await storageService.saveThemePreference(level);
  }, []);

  const currentTheme = themes[currentThemeLevel] || themes.beginner;

  const value = useMemo(() => ({
    currentTheme,
    currentThemeLevel,
    themes,
    setThemeLevel,
  }), [currentTheme, currentThemeLevel, setThemeLevel]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 