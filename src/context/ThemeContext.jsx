import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { computeAutoTheme, SKY_CHECK_MS } from "../lib/theme.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(computeAutoTheme);

  useEffect(() => {
    document.body.classList.remove("theme-day", "theme-night");
    document.body.classList.add(`theme-${theme}`);
    return () => {
      document.body.classList.remove("theme-day", "theme-night");
    };
  }, [theme]);

  useEffect(() => {
    const updateTheme = () => setTheme(computeAutoTheme());
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

  const value = useMemo(() => ({ theme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
