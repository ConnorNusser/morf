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
  // E Tier Light
  beginner: {
    name: "beginner",
    colors: {
      background: "#F7F3E9",
      text: "#2D3E2F",
      primary: "#8B5A3C",
      secondary: "#E8DCC6",
      accent: "#7FB069",
      surface: "#FFFFFF",
      border: "#D4C4A8",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 16,
  },

  // E Tier Dark
  beginner_dark: {
    name: "beginner_dark",
    colors: {
      background: "#121215",
      text: "#E4E4E7",
      primary: "#1F6FEB",
      secondary: "#18181B",
      accent: "#D4D4D8",
      surface: "#1C1C1F",
      border: "#27272A",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 12,
  },

  // C Tier
  intermediate: {
    name: "intermediate",
    colors: {
      background: "#EFEEF3",
      text: "#1A1A1A",
      primary: "#5856D6",
      secondary: "#E5E4E9",
      accent: "#34C759",
      surface: "#FFFFFF",
      border: "#D1D1D6",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 10,
  },

  // B Tier
  advanced: {
    name: "advanced",
    colors: {
      background: "#0F172A",
      text: "#F1F5F9",
      primary: "#3B82F6",
      secondary: "#1E293B",
      accent: "#22D3EE",
      surface: "#1E293B",
      border: "#334155",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 12,
  },

  // A Tier
  elite: {
    name: "elite",
    colors: {
      background: "#13111C",
      text: "#EEEEF0",
      primary: "#A855F7",
      secondary: "#1E1B2E",
      accent: "#F472B6",
      surface: "#221F2E",
      border: "#2E2A3E",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 10,
  },

  // S Tier
  god: {
    name: "god",
    colors: {
      background: "#2C2724",
      text: "#FAF6F1",
      primary: "#C15F3C",
      secondary: "#3D3632",
      accent: "#E67D22",
      surface: "#38322E",
      border: "#4A433E",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Karla_700Bold",
      bold: "Karla_700Bold",
    },
    borderRadius: 12,
  },

  // Rose
  share_warm: {
    name: "share_warm",
    colors: {
      background: "#FDF4F5",
      text: "#6B4C5A",
      primary: "#E879A9",
      secondary: "#FCE8EC",
      accent: "#93C5FD",
      surface: "#FFFFFF",
      border: "#F5D0DC",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 16,
  },

  // Cyber
  share_cool: {
    name: "share_cool",
    colors: {
      background: "#0C0A1D",
      text: "#E2E8F0",
      primary: "#8B5CF6",
      secondary: "#1A1633",
      accent: "#FB923C",
      surface: "#16132D",
      border: "#6D28D9",
    },
    fonts: {
      regular: "Raleway_400Regular",
      medium: "Raleway_500Medium",
      semiBold: "Raleway_600SemiBold",
      bold: "Raleway_700Bold",
    },
    borderRadius: 8,
  },

  // Winter 2026 seasonal (Dec 1 - March 20)
  winter_2026: {
    name: "winter_2026",
    colors: {
      background: "#162825",
      text: "#f1f5f9",
      primary: "#38bdf8",
      secondary: "#4a7c6f",
      accent: "#e2e8f0",
      surface: "#1e3633",
      border: "#2d4a44",
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
  // Only progression themes are ordered; beginner variants stay at same level
  const themeOrder: ThemeLevel[] = [
    "beginner",
    "intermediate",
    "advanced",
    "elite",
    "god",
  ];

  const normalizedTheme = currentTheme.startsWith("beginner")
    ? "beginner"
    : currentTheme;
  const currentIndex = themeOrder.indexOf(normalizedTheme);
  return themeOrder[Math.min(currentIndex + 1, themeOrder.length - 1)];
};

export const isSeasonalThemeAvailable = (theme: ThemeLevel): boolean => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  if (theme === "winter_2026") {
    // Available Dec 1 - March 20
    return month === 11 || month === 0 || month === 1 || (month === 2 && day <= 20);
  }

  return true;
};
