import { useState, useEffect } from "react";
import { Platform } from "react-native";

export interface TicketColors {
  primary: string;
  accent: string;
  background: string;
}

const DEFAULT_COLORS: TicketColors = {
  primary: "#7C3A2D",
  accent: "#A67C52",
  background: "#FFF8F0",
};

let getColors: typeof import("react-native-image-colors").getColors | null = null;
try {
  getColors = require("react-native-image-colors").getColors;
} catch {
  // native module not available (Expo Go)
}

function extractColors(result: { platform: string; [key: string]: string }): TicketColors {
  if (result.platform === "android") {
    return {
      primary: result.vibrant || result.dominant || DEFAULT_COLORS.primary,
      accent: result.muted || result.darkVibrant || DEFAULT_COLORS.accent,
      background: result.lightMuted || result.lightVibrant || DEFAULT_COLORS.background,
    };
  }
  if (result.platform === "ios") {
    return {
      primary: result.primary || DEFAULT_COLORS.primary,
      accent: result.secondary || DEFAULT_COLORS.accent,
      background: result.background || DEFAULT_COLORS.background,
    };
  }
  if (result.platform === "web") {
    return {
      primary: result.vibrant || result.dominant || DEFAULT_COLORS.primary,
      accent: result.muted || result.darkVibrant || DEFAULT_COLORS.accent,
      background: result.lightMuted || result.lightVibrant || DEFAULT_COLORS.background,
    };
  }
  return DEFAULT_COLORS;
}

export function useImageColors(imageUri: string | null): TicketColors {
  const [colors, setColors] = useState<TicketColors>(DEFAULT_COLORS);

  useEffect(() => {
    if (!imageUri || !getColors) {
      setColors(DEFAULT_COLORS);
      return;
    }

    getColors(imageUri, {
      fallback: DEFAULT_COLORS.primary,
      cache: true,
      key: imageUri,
      quality: Platform.OS === "web" ? "low" : undefined,
    }).then((result) => {
      setColors(extractColors(result as unknown as { platform: string; [key: string]: string }));
    }).catch(() => {
      setColors(DEFAULT_COLORS);
    });
  }, [imageUri]);

  return colors;
}
