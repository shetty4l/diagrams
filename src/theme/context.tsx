import React, { createContext, useContext } from "react";
import { defaultLight } from "./presets";
import type { Theme } from "./types";

const ThemeContext = createContext<Theme>(defaultLight);

export const ThemeProvider: React.FC<{
  theme: Theme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
