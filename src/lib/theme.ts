export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME = "light";
export const FALLBACK_THEME_COLOR = "#7C9E87";

export const getStoredTheme = (): string => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME;
  } catch (error) {
    console.warn("Failed to read theme from localStorage:", error);
    return DEFAULT_THEME;
  }
};

const ensureThemeColorMeta = (): HTMLMetaElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;

  if (!metaThemeColor) {
    metaThemeColor = document.createElement("meta");
    metaThemeColor.name = "theme-color";
    document.head.appendChild(metaThemeColor);
  }

  return metaThemeColor;
};

const resolveThemeColor = (): string => {
  if (typeof document === "undefined") {
    return FALLBACK_THEME_COLOR;
  }

  const probe = document.createElement("div");
  probe.className = "bg-base-200";
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.inset = "-9999px";

  document.body.appendChild(probe);

  const computedColor = window.getComputedStyle(probe).backgroundColor;

  probe.remove();

  return computedColor || FALLBACK_THEME_COLOR;
};

export const updateThemeColorMeta = (): void => {
  const metaThemeColor = ensureThemeColorMeta();

  if (!metaThemeColor) {
    return;
  }

  metaThemeColor.content = resolveThemeColor();
};

export const applyTheme = (theme: string): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn("Failed to save theme to localStorage:", error);
  }

  updateThemeColorMeta();
};

export const initializeTheme = (): void => {
  if (typeof document === "undefined") {
    return;
  }

  applyTheme(getStoredTheme());
};

