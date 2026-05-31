import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { computeAutoTheme, resolveThemeToggle, SKY_CHECK_MS } from "../lib/theme.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [autoTheme, setAutoTheme] = useState(computeAutoTheme);
  const [themeOverride, setThemeOverride] = useState(null);
  const theme = themeOverride ?? autoTheme;

  useEffect(() => {
    document.body.classList.remove("theme-day", "theme-night");
    document.body.classList.add(`theme-${theme}`);
    return () => {
      document.body.classList.remove("theme-day", "theme-night");
    };
  }, [theme]);

  useEffect(() => {
    const updateTheme = () => setAutoTheme(computeAutoTheme());
    updateTheme();
    const interval = window.setInterval(updateTheme, SKY_CHECK_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") updateTheme();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (themeOverride && themeOverride === autoTheme) {
      setThemeOverride(null);
    }
  }, [autoTheme, themeOverride]);

  const toggleTheme = useCallback(() => {
    setThemeOverride(resolveThemeToggle(theme, autoTheme));
  }, [theme, autoTheme]);

  const value = useMemo(() => ({
    theme,
    autoTheme,
    themeOverride,
    toggleTheme,
    setThemeOverride,
  }), [theme, autoTheme, themeOverride, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
