import { createContext, useContext, useEffect, useState, type ReactNode, type CSSProperties } from "react";

export type DashTheme = "dark" | "light";

export const DARK_COLORS = {
  bg: "#14171A",
  panel: "#1C2024",
  panelAlt: "#20262B",
  border: "#2C3238",
  amber: "#E8A33D",
  red: "#D6524A",
  green: "#4CA771",
  teal: "#5FA8B5",
  text: "#E9E5DC",
  textMuted: "#8B9298",
};

export const LIGHT_COLORS = {
  bg: "#EDEAE2",
  panel: "#FFFFFF",
  panelAlt: "#F4F1EA",
  border: "#DCD7CC",
  amber: "#B8791E",
  red: "#C13B32",
  green: "#2E8659",
  teal: "#2C7C8C",
  text: "#1B1E20",
  textMuted: "#6B6F73",
};

interface DashThemeContextValue {
  theme: DashTheme;
  colors: typeof DARK_COLORS;
  toggleTheme: () => void;
}

const DashThemeContext = createContext<DashThemeContextValue | undefined>(undefined);

export function DashThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<DashTheme>("dark");
  const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // The page background (set globally for the dark marketing site) shows
  // through whenever this panel is shorter than the viewport, so it must
  // track the control room's own theme instead of staying stuck on dark.
  useEffect(() => {
    const html = document.documentElement;
    const originalHtmlBg = html.style.backgroundColor;
    const originalBodyBg = document.body.style.backgroundColor;
    return () => {
      html.style.backgroundColor = originalHtmlBg;
      document.body.style.backgroundColor = originalBodyBg;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
  }, [colors.bg]);

  const vars: CSSProperties = {
    "--dash-bg": colors.bg,
    "--dash-panel": colors.panel,
    "--dash-panel-alt": colors.panelAlt,
    "--dash-border": colors.border,
    "--dash-amber": colors.amber,
    "--dash-red": colors.red,
    "--dash-green": colors.green,
    "--dash-teal": colors.teal,
    "--dash-text": colors.text,
    "--dash-text-muted": colors.textMuted,
    fontFamily: "'Rajdhani', sans-serif",
  } as CSSProperties;

  return (
    <DashThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      <div style={vars} className="bg-[var(--dash-bg)] text-[var(--dash-text)]">
        {children}
      </div>
    </DashThemeContext.Provider>
  );
}

export function useDashTheme() {
  const ctx = useContext(DashThemeContext);
  if (!ctx) throw new Error("useDashTheme must be used within DashThemeProvider");
  return ctx;
}
