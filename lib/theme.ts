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
  },

  // Beginner Dark - Slack-inspired neutral gray theme
  beginner_dark: {
    name: 'beginner_dark',
    colors: {
      background: '#1A1D21',    // Slack dark background
      text: '#D1D2D3',          // Soft gray text
      primary: '#36C5F0',       // Slack blue accent
      secondary: '#222529',     // Slightly lighter gray
      accent: '#2EB67D',        // Slack green
      surface: '#27242C',       // Card surface
      border: '#3F4147',        // Subtle gray border
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 12,
  },

  // Clean Material Design - Soft, accessible (now intermediate)
  intermediate: {
    name: 'intermediate',
    colors: {
      background: '#FAFAFA',    // Very light gray background
      text: '#1D1D1F',          // Dark iOS-like text
      primary: '#007AFF',       // iOS blue
      secondary: '#F5F5F5',     // Light gray cards
      accent: '#34C759',        // iOS green accent
      surface: '#FFFFFF',       // White cards
      border: '#D1D1D6',        // Separator color
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 10,
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
  },

  // Shareable Cotton Candy - Soft pastel dreamland
  share_warm: {
    name: 'share_warm',
    colors: {
      background: '#FFF0F5',    // Soft lavender blush
      text: '#8B4A8C',          // Soft purple text
      primary: '#FF69B4',       // Hot pink primary
      secondary: '#FFE4E1',     // Misty rose surface
      accent: '#87CEEB',        // Sky blue accent
      surface: '#FFFFFF',       // Pure white cards
      border: '#DDA0DD',        // Plum border
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_600SemiBold',
    },
    borderRadius: 20, // Extra rounded for soft aesthetic
  },

  // Shareable Anime Night - Dark anime-inspired aesthetics
  share_cool: {
    name: 'share_cool',
    colors: {
      background: '#0D1421',    // Deep midnight blue
      text: '#E8E8FF',          // Soft white with blue tint
      primary: '#6366F1',       // Electric indigo primary
      secondary: '#1E293B',     // Dark slate surface
      accent: '#F59E0B',        // Bright amber accent
      surface: '#1F2937',       // Dark gray cards
      border: '#4F46E5',        // Electric purple border
    },
    properties: {
      fontFamily: 'System',
      headingFontFamily: 'Raleway_700Bold', // Bold for dramatic effect
    },
    borderRadius: 8, // Moderate rounding for modern anime feel
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