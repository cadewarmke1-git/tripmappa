import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { computeAutoTheme, SKY_CHECK_MS } from "../lib/theme.js";
import { isHeroSurfaceThemeLocked, syncSkyCycle } from "../lib/surfaceTheme.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => computeAutoTheme());

  useEffect(() => {
    const bodyTheme = theme === "day" ? "day" : theme === "twilight" ? "twilight" : "night";
    document.body.classList.remove("theme-day", "theme-twilight", "theme-night");
    document.body.classList.add(`theme-${bodyTheme}`);
    if (!isHeroSurfaceThemeLocked()) {
      syncSkyCycle({ theme });
    }
    return () => {
      document.body.classList.remove("theme-day", "theme-twilight", "theme-night");
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
