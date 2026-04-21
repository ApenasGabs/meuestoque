import { useEffect, useState } from "react";

export const FONT_SIZE_OPTIONS = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
export type FontSize = (typeof FONT_SIZE_OPTIONS)[number];

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  xs: "XS",
  sm: "Pequeno",
  md: "Normal",
  lg: "Grande",
  xl: "Muito Grande",
  "2xl": "Gigante",
};

const isFontSize = (value: string): value is FontSize =>
  FONT_SIZE_OPTIONS.includes(value as FontSize);

export const getStoredFontSize = (): FontSize => {
  if (typeof window === "undefined") {
    return "md";
  }

  const savedFontSize = localStorage.getItem("fontSize");
  return savedFontSize && isFontSize(savedFontSize) ? savedFontSize : "md";
};

export const getStoredTheme = (): string => {
  if (typeof window === "undefined") {
    return "light";
  }

  return localStorage.getItem("theme") || "light";
};

const applyFontSizeClass = (fontSize: FontSize): void => {
  Object.values(FONT_SIZE_CLASSES).forEach((className) => {
    document.documentElement.classList.remove(className);
  });

  document.documentElement.classList.add(FONT_SIZE_CLASSES[fontSize]);
};

export const applyStoredPreferences = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const storedTheme = getStoredTheme();
  const storedFontSize = getStoredFontSize();

  document.documentElement.setAttribute("data-theme", storedTheme);
  document.body.setAttribute("data-theme", storedTheme);
  applyFontSizeClass(storedFontSize);
};

interface UseFontSizePreferenceReturn {
  fontSize: FontSize;
  setFontSize: (fontSize: FontSize) => void;
}

export const useFontSizePreference = (): UseFontSizePreferenceReturn => {
  const [fontSize, setFontSize] = useState<FontSize>(getStoredFontSize);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    applyFontSizeClass(fontSize);
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  return { fontSize, setFontSize };
};
