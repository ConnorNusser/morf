import { ThemeLevel } from '@/types';

export { ThemeLevel };

export interface Theme {
  name: ThemeLevel;
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
}

export const themes: Record<ThemeLevel, Theme> = {
  // E Tier Light - Studio Ghibli, magical, nature-inspired
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
    borderRadius: 16,
  },

  // E Tier Dark - Silver metallic theme
  beginner_dark: {
    name: 'beginner_dark',
    colors: {
      background: '#121215',    // Dark charcoal
      text: '#E4E4E7',          // Zinc 200
      primary: '#A1A1AA',       // Zinc 400 (silver)
      secondary: '#18181B',     // Zinc 900
      accent: '#D4D4D8',        // Zinc 300 (bright silver)
      surface: '#1C1C1F',       // Elevated dark
      border: '#27272A',        // Zinc 800
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,
  },

  // C Tier - Clean iOS-inspired light theme
  intermediate: {
    name: 'intermediate',
    colors: {
      background: '#F2F2F7',    // iOS system gray 6
      text: '#1C1C1E',          // iOS label
      primary: '#007AFF',       // iOS blue
      secondary: '#E5E5EA',     // iOS system gray 5
      accent: '#34C759',        // iOS green
      surface: '#FFFFFF',       // White cards
      border: '#C6C6C8',        // iOS separator
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 10,
  },

  // B Tier - Deep ocean dark theme
  advanced: {
    name: 'advanced',
    colors: {
      background: '#0F172A',    // Slate 900
      text: '#F1F5F9',          // Slate 100
      primary: '#3B82F6',       // Blue 500
      secondary: '#1E293B',     // Slate 800
      accent: '#22D3EE',        // Cyan 400
      surface: '#1E293B',       // Slate 800
      border: '#334155',        // Slate 700
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,
  },

  // A Tier - Royal purple premium theme
  elite: {
    name: 'elite',
    colors: {
      background: '#13111C',    // Deep purple black
      text: '#EEEEF0',          // Soft white
      primary: '#A855F7',       // Purple 500
      secondary: '#1E1B2E',     // Purple tinted dark
      accent: '#F472B6',        // Pink 400
      surface: '#221F2E',       // Elevated purple surface
      border: '#2E2A3E',        // Subtle purple border
    },
    properties: {
      fontFamily: 'Karla_400Regular',
      headingFontFamily: 'Karla_700Bold',
    },
    borderRadius: 10,
  },

  // S Tier - Claude inspired dark theme
  god: {
    name: 'god',
    colors: {
      background: '#2C2724',    // Warm dark gray (not black)
      text: '#FAF6F1',          // Claude warm cream
      primary: '#C15F3C',       // Claude rust orange
      secondary: '#3D3632',     // Slightly lighter warm gray
      accent: '#E67D22',        // Claude bright orange
      surface: '#38322E',       // Elevated warm gray
      border: '#4A433E',        // Warm medium border
    },
    properties: {
      fontFamily: 'Karla_400Regular',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,
  },

  // Rose - Soft pastel dreamscape
  share_warm: {
    name: 'share_warm',
    colors: {
      background: '#FDF4F5',    // Soft rose white
      text: '#6B4C5A',          // Muted mauve text
      primary: '#E879A9',       // Soft pink
      secondary: '#FCE8EC',     // Light pink
      accent: '#93C5FD',        // Soft blue
      surface: '#FFFFFF',       // Pure white cards
      border: '#F5D0DC',        // Pink border
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 16,
  },

  // Cyber - Cyberpunk anime aesthetics
  share_cool: {
    name: 'share_cool',
    colors: {
      background: '#0C0A1D',    // Deep midnight
      text: '#E2E8F0',          // Soft white
      primary: '#8B5CF6',       // Violet 500
      secondary: '#1A1633',     // Dark violet
      accent: '#FB923C',        // Orange 400
      surface: '#16132D',       // Elevated violet
      border: '#6D28D9',        // Violet 700
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_700Bold',
    },
    borderRadius: 8,
  },
};

export const getNextTheme = (currentTheme: ThemeLevel): ThemeLevel => {
  // Only progression themes are in order - beginner variants stay at same level
  const themeOrder: ThemeLevel[] = ['beginner', 'intermediate', 'advanced', 'elite', 'god'];

  // Map beginner variants to beginner for progression purposes
  const normalizedTheme = currentTheme.startsWith('beginner') ? 'beginner' : currentTheme;
  const currentIndex = themeOrder.indexOf(normalizedTheme);
  return themeOrder[Math.min(currentIndex + 1, themeOrder.length - 1)];
}; 