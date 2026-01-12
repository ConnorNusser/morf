import { ThemeLevel } from "@/types";

export { ThemeLevel };

export interface ThemeFonts {
  regular: string;
  medium: string;
  semiBold: string;
  bold: string;
}

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
  fonts: ThemeFonts;
  borderRadius: number;
}

export const themes: Record<ThemeLevel, Theme> = {
  // E Tier Light - Studio Ghibli, magical, nature-inspired
  beginner: {
    name: "beginner",
    colors: {
      background: "#F7F3E9", // Warm cream background (like parchment)
      text: "#2D3E2F", // Deep forest green text
      primary: "#8B5A3C", // Warm brown (like tree bark)
      secondary: "#E8DCC6", // Light beige for subtle elements
      accent: "#7FB069", // Soft sage green (nature accent)
      surface: "#FFFFFF", // Pure white for cards (clean contrast)
      border: "#D4C4A8", // Soft tan borders
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 16,
  },

  // E Tier Dark - Steel blue accent on neutral dark
  beginner_dark: {
    name: "beginner_dark",
    colors: {
      background: "#121215", // Dark charcoal
      text: "#E4E4E7", // Zinc 200
      primary: "#1D9BF0", // Steel blue
      secondary: "#18181B", // Zinc 900
      accent: "#D4D4D8", // Zinc 300 (bright silver)
      surface: "#1C1C1F", // Elevated dark
      border: "#27272A", // Zinc 800
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 12,
  },

  // C Tier - Modern light theme (iOS/Discord inspired)
  intermediate: {
    name: "intermediate",
    colors: {
      background: "#EFEEF3", // Cool light gray (more contrast)
      text: "#1A1A1A", // Near black for readability
      primary: "#5856D6", // iOS purple
      secondary: "#E5E4E9", // Subtle gray
      accent: "#34C759", // iOS green
      surface: "#FFFFFF", // Pure white cards (contrast!)
      border: "#D1D1D6", // iOS separator gray
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 10,
  },

  // B Tier - Deep ocean dark theme
  advanced: {
    name: "advanced",
    colors: {
      background: "#0F172A", // Slate 900
      text: "#F1F5F9", // Slate 100
      primary: "#3B82F6", // Blue 500
      secondary: "#1E293B", // Slate 800
      accent: "#22D3EE", // Cyan 400
      surface: "#1E293B", // Slate 800
      border: "#334155", // Slate 700
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 12,
  },

  // A Tier - Royal purple premium theme
  elite: {
    name: "elite",
    colors: {
      background: "#13111C", // Deep purple black
      text: "#EEEEF0", // Soft white
      primary: "#A855F7", // Purple 500
      secondary: "#1E1B2E", // Purple tinted dark
      accent: "#F472B6", // Pink 400
      surface: "#221F2E", // Elevated purple surface
      border: "#2E2A3E", // Subtle purple border
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 10,
  },

  // S Tier - Claude inspired dark theme
  god: {
    name: "god",
    colors: {
      background: "#2C2724", // Warm dark gray (not black)
      text: "#FAF6F1", // Claude warm cream
      primary: "#C15F3C", // Claude rust orange
      secondary: "#3D3632", // Slightly lighter warm gray
      accent: "#E67D22", // Claude bright orange
      surface: "#38322E", // Elevated warm gray
      border: "#4A433E", // Warm medium border
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Karla_700Bold",
      bold: "Karla_700Bold",
    },
    borderRadius: 12,
  },

  // Rose - Soft pastel dreamscape
  share_warm: {
    name: "share_warm",
    colors: {
      background: "#FDF4F5", // Soft rose white
      text: "#6B4C5A", // Muted mauve text
      primary: "#E879A9", // Soft pink
      secondary: "#FCE8EC", // Light pink
      accent: "#93C5FD", // Soft blue
      surface: "#FFFFFF", // Pure white cards
      border: "#F5D0DC", // Pink border
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 16,
  },

  // Cyber - Cyberpunk anime aesthetics
  share_cool: {
    name: "share_cool",
    colors: {
      background: "#0C0A1D", // Deep midnight
      text: "#E2E8F0", // Soft white
      primary: "#8B5CF6", // Violet 500
      secondary: "#1A1633", // Dark violet
      accent: "#FB923C", // Orange 400
      surface: "#16132D", // Elevated violet
      border: "#6D28D9", // Violet 700
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 8,
  },

  // Christmas 2025 - Evergreen theme (Dec 1 - Jan 15)
  christmas_theme_2025: {
    name: "christmas_theme_2025",
    colors: {
      background: "#1a3a2a", // Deep forest green
      text: "#F5F5F0", // Warm white
      primary: "#DC2626", // Classic Christmas red
      secondary: "#15803d", // Lighter pine green
      accent: "#FBBF24", // Warm gold
      surface: "#234536", // Lighter forest surface
      border: "#2d5a42", // Muted green border
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 14,
  },
};

export const getNextTheme = (currentTheme: ThemeLevel): ThemeLevel => {
  // Only progression themes are in order - beginner variants stay at same level
  const themeOrder: ThemeLevel[] = [
    "beginner",
    "intermediate",
    "advanced",
    "elite",
    "god",
  ];

  // Map beginner variants to beginner for progression purposes
  const normalizedTheme = currentTheme.startsWith("beginner")
    ? "beginner"
    : currentTheme;
  const currentIndex = themeOrder.indexOf(normalizedTheme);
  return themeOrder[Math.min(currentIndex + 1, themeOrder.length - 1)];
};

// Check if a seasonal theme is currently available based on date
export const isSeasonalThemeAvailable = (theme: ThemeLevel): boolean => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  if (theme === "christmas_theme_2025") {
    // Available Dec 1 - Jan 15
    return month === 11 || (month === 0 && day <= 15);
  }

  // Non-seasonal themes are always available
  return true;
};
