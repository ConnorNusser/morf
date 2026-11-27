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
  // Tier themes take their tier's color (TIER_COLORS in strengthStandards):
  // E gray, C green, B blue, A purple, S gold. On dark grounds the primary is
  // the tier's light shade so links and pills stay readable.
  // E Tier Light
  beginner: {
    name: "beginner",
    colors: {
      background: "#F4F4F5",
      text: "#18181B",
      primary: "#3F3F46",
      secondary: "#E4E4E7",
      accent: "#71717A",
      surface: "#FFFFFF",
      border: "#D4D4D8",
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
      primary: "#D4D4D8",
      secondary: "#18181B",
      accent: "#A1A1AA",
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
      background: "#EEF3EF",
      text: "#13201A",
      primary: "#1F7A4A",
      secondary: "#E1EAE3",
      accent: "#2E8B57",
      surface: "#FFFFFF",
      border: "#CFDDD3",
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
      background: "#0D1324",
      text: "#EEF2FF",
      primary: "#7C9CFF",
      secondary: "#161E36",
      accent: "#3558C0",
      surface: "#161E36",
      border: "#26314F",
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
      background: "#140F1C",
      text: "#F1ECF7",
      primary: "#D08BFF",
      secondary: "#1F1729",
      accent: "#9932CC",
      surface: "#1F1729",
      border: "#2F2440",
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
      background: "#17140C",
      text: "#FAF6E8",
      primary: "#FFD700",
      secondary: "#221E12",
      accent: "#FFE45C",
      surface: "#221E12",
      border: "#35301C",
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
