import { AllThemeLevel, ShareableThemeLevel, ThemeLevel, ThemeUnlockType } from '@/types';

export { AllThemeLevel, ShareableThemeLevel, ThemeLevel, ThemeUnlockType };

export interface Theme {
  name: AllThemeLevel;
  colors: {
    background: string;
    text: string;
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    border: string;
  };
  properties: {
    fontFamily?: string;
    headingFontFamily?: string;
  };
  borderRadius: number;
  unlockType: ThemeUnlockType;
  displayName: string;
  description: string;
}

export const themes: Record<ThemeLevel, Theme> = {
  // Studio Ghibli - Magical, warm, nature-inspired (now beginner!)
  beginner: {
    name: 'beginner',
    colors: {
      background: '#F7F3E9',    // Warm cream background (like parchment)
      text: '#2D3E2F',          // Deep forest green text
      primary: '#8B5A3C',       // Warm brown (like tree bark)
      secondary: '#E8DCC6',     // Light beige for subtle elements
      accent: '#7FB069',        // Soft sage green (nature accent)
      surface: '#FFFFFF',       // Pure white for cards (clean contrast)
      border: '#D4C4A8',        // Soft tan borders
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 16,  // Rounded, organic feeling
    unlockType: 'fitness',
    displayName: 'Beginner',
    description: 'A warm, nature-inspired theme for beginners.',
  },
  
  // Clean Material Design - Soft, accessible (now intermediate)
  intermediate: {
    name: 'intermediate',
    colors: {
      background: '#FAFAFA',    // Very light gray background (previously advanced)
      text: '#1D1D1F',          // Dark iOS-like text
      primary: '#007AFF',       // iOS blue (was advanced primary)
      secondary: '#F5F5F5',     // Light gray cards
      accent: '#34C759',        // iOS green accent
      surface: '#FFFFFF',       // White cards
      border: '#D1D1D6',        // Separator color
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 10,  // Keeping the previous advanced radius
    unlockType: 'fitness',
    displayName: 'Intermediate',
    description: 'A clean, accessible theme for intermediate users.',
  },
  
  // iOS-inspired - Clean, minimal, professional (now advanced)
  advanced: {
    name: 'advanced',
    colors: {
      background: '#121212',     // Dark neutral background for contrast (from previous intermediate)
      text: '#FFFFFF',          // Pure white text
      primary: '#625AD8',       // Indigo-violet primary
      secondary: '#7339AB',     // Deep purple secondary
      accent: '#1F9CE4',        // Bright blue accent
      surface: '#1F1F1F',       // Dark surface
      border: '#2A2A2A',        // Subtle border
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,  // Slightly larger radius for dark theme
    unlockType: 'fitness',
    displayName: 'Advanced',
    description: 'A dark, professional theme for advanced users.',
  },
  
  // ARCTIC ICE - Frozen mastery with elite darkness (now elite)
  elite: {
    name: 'elite',
    colors: {
      background: '#0A0F1C',    // Very dark arctic blue
      text: '#E6F3FF',          // Soft ice white
      primary: '#1E90FF',       // Dodger blue (bright ice accent)
      secondary: '#0F1419',     // Almost black with blue tint
      accent: '#40E0D0',        // Turquoise (ice crystal glow)
      surface: '#111827',       // Dark blue-gray surface
      border: '#1F2937',        // Dark gray-blue borders
    },
    properties: {
      fontFamily: 'Karla_400Regular', // Clean, calm Google Font - perfect for arctic elegance
      headingFontFamily: 'Karla_700Bold', // Bold Karla for consistent font family
    },
    borderRadius: 8,
    unlockType: 'fitness',
    displayName: 'Elite',
    description: 'A frozen, elite theme for the most dedicated users.',
  },
  
  // Dark mode - Modern, sophisticated (now god)
  god: {
    name: 'god',
    colors: {
      background: '#0F0F0F',    // Very dark background
      text: '#FFFFFF',          // Pure white text
      primary: '#8B5CF6',       // Purple primary
      secondary: '#1F1F1F',     // Dark card background
      accent: '#06D6A0',        // Teal accent
      surface: '#262626',       // Lighter dark for elevated cards
      border: '#404040',        // Subtle dark borders
    },
    properties: {
      fontFamily: 'Karla_400Regular',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 8,
    unlockType: 'fitness',
    displayName: 'God',
    description: 'A modern, sophisticated theme for the ultimate user.',
  },
};

// Shareable themes unlocked via social actions
export const shareableThemes: Record<ShareableThemeLevel, Theme> = {
  // NEON CYBERPUNK - Electric vibes
  neon: {
    name: 'neon',
    colors: {
      background: '#0A0A0F',
      text: '#00FFFF',
      primary: '#FF00FF',
      secondary: '#1A1A2E',
      accent: '#00FF41',
      surface: '#16213E',
      border: '#FF00FF',
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_700Bold',
    },
    borderRadius: 6,
    unlockType: 'share',
    displayName: 'Neon Cyberpunk',
    description: 'Electric vibes for digital natives. Share the app to unlock!',
  },

  // RETRO SUNSET - 80s aesthetic
  retro: {
    name: 'retro',
    colors: {
      background: '#2D1B69',
      text: '#FFFFFF',
      primary: '#F72585',
      secondary: '#4C956C',
      accent: '#FFD60A',
      surface: '#3F2F7A',
      border: '#B388EB',
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_700Bold',
    },
    borderRadius: 20,
    unlockType: 'share',
    displayName: 'Retro Sunset',
    description: '80s synthwave aesthetic. Share to unlock those nostalgic vibes!',
  },

  // COSMIC DREAM - Space theme
  cosmic: {
    name: 'cosmic',
    colors: {
      background: '#0B0E1A',
      text: '#FFFFFF',
      primary: '#6366F1',
      secondary: '#1E1B4B',
      accent: '#F59E0B',
      surface: '#312E81',
      border: '#4C1D95',
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 14,
    unlockType: 'share',
    displayName: 'Cosmic Dream',
    description: 'Journey through the stars. Share to unlock the cosmos!',
  },

  // FOREST MYSTIC - Deep nature theme
  forest: {
    name: 'forest',
    colors: {
      background: '#1A2B1F',
      text: '#E8F5E8',
      primary: '#4ADE80',
      secondary: '#0F3318',
      accent: '#FCD34D',
      surface: '#2D5A3A',
      border: '#059669',
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 18,
    unlockType: 'share',
    displayName: 'Forest Mystic',
    description: 'Embrace the wilderness within. Share to unlock nature\'s power!',
  },

  // OCEAN DEPTHS - Deep sea theme
  ocean: {
    name: 'ocean',
    colors: {
      background: '#0C1B2B',
      text: '#E0F7FA',
      primary: '#00BCD4',
      secondary: '#1A3A52',
      accent: '#FF7043',
      surface: '#2E5A78',
      border: '#0097A7',
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,
    unlockType: 'share',
    displayName: 'Ocean Depths',
    description: 'Dive deep into tranquility. Share to unlock the abyss!',
  },
};

// Combined themes for easy access
export const allThemes: Record<AllThemeLevel, Theme> = {
  ...themes,
  ...shareableThemes,
};

export const getNextTheme = (currentTheme: ThemeLevel): ThemeLevel => {
  const themeOrder: ThemeLevel[] = ['beginner', 'intermediate', 'advanced', 'elite', 'god'];
  const currentIndex = themeOrder.indexOf(currentTheme);
  return themeOrder[Math.min(currentIndex + 1, themeOrder.length - 1)];
}; 