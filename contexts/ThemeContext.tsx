import { storageService } from '@/lib/storage/storage';
import { BackgroundGradientId, DEFAULT_GRADIENT_ID } from '@/lib/ui/backgroundGradients';
import { Theme, ThemeLevel, themes } from '@/lib/ui/theme';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeContextType {
  currentTheme: Theme;
  currentThemeLevel: ThemeLevel;
  themes: typeof themes;
  setThemeLevel: (level: ThemeLevel) => void;
  currentGradientId: BackgroundGradientId;
  setGradientId: (id: BackgroundGradientId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark for new users until they pick one in settings.
  const getDefaultTheme = (): ThemeLevel => 'beginner_dark';

  const [currentThemeLevel, setCurrentThemeLevel] = useState<ThemeLevel>(getDefaultTheme());
  const [currentGradientId, setCurrentGradientId] = useState<BackgroundGradientId>(DEFAULT_GRADIENT_ID);

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
      const savedGradient = await storageService.getGradientPreference();
      if (savedGradient) {
        setCurrentGradientId(savedGradient);
      }
    };
    loadThemePreference();
  }, []);

  const setThemeLevel = useCallback(async (level: ThemeLevel) => {
    setCurrentThemeLevel(level);
    await storageService.saveThemePreference(level);
  }, []);

  const setGradientId = useCallback(async (id: BackgroundGradientId) => {
    setCurrentGradientId(id);
    await storageService.saveGradientPreference(id);
  }, []);

  const currentTheme = themes[currentThemeLevel] || themes.beginner;

  const value = useMemo(() => ({
    currentTheme,
    currentThemeLevel,
    themes,
    setThemeLevel,
    currentGradientId,
    setGradientId,
  }), [currentTheme, currentThemeLevel, setThemeLevel, currentGradientId, setGradientId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 