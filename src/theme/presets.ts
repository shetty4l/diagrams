import type { Theme } from "./types";

export const defaultLight: Theme = {
  name: "default-light",
  colors: {
    background: "#FFFFFF",
    backgroundGradientStart: "#E9EAEB",
    surface: "#F5F6F7",
    surfaceBright: "#EDEEF0",
    border: "rgba(0,0,0,0.10)",
    borderActive: "rgba(0,0,0,0.20)",
    text: {
      primary: "#232F3E",
      secondary: "#545B64",
      tertiary: "#879596",
    },
    accent: {
      primary: "#FF9900",
      glow: "rgba(255,153,0,0.15)",
    },
    brand: {
      blue: "#4F81BD",
      darkBlue: "#1F497D",
    },
    status: {
      success: "#067D68",
      warning: "#D97706",
      danger: "#C0504D",
      info: "#4F81BD",
    },
  },
  fonts: {
    sans: "Inter",
    mono: "JetBrains Mono",
  },
  spacing: { page: 48, section: 32, element: 16, tight: 8 },
  radii: { sm: 4, md: 8, lg: 12, full: 9999 },
  animation: {
    staggerDelay: 4,
    entranceDuration: 15,
    highlightDuration: 60,
    springConfig: {
      smooth: { damping: 200 },
      snappy: { damping: 20, stiffness: 200 },
    },
  },
};

export const presentationLight: Theme = {
  name: "presentation-light",
  colors: {
    background: "#FFFFFF",
    backgroundGradientStart: "#F5F5F5",
    surface: "#F8F8F8",
    surfaceBright: "#EFEFEF",
    border: "rgba(0,0,0,0.08)",
    borderActive: "rgba(0,0,0,0.16)",
    text: {
      primary: "#303030",
      secondary: "#606060",
      tertiary: "#909090",
    },
    accent: {
      primary: "#F89728",
      glow: "rgba(248,151,40,0.15)",
    },
    brand: {
      blue: "#007FCC",
      darkBlue: "#005A8C",
    },
    status: {
      success: "#2E8B57",
      warning: "#F89728",
      danger: "#EF4135",
      info: "#007FCC",
    },
  },
  fonts: {
    sans: "Inter",
    mono: "JetBrains Mono",
  },
  spacing: { page: 48, section: 32, element: 16, tight: 8 },
  radii: { sm: 4, md: 8, lg: 12, full: 9999 },
  animation: {
    staggerDelay: 4,
    entranceDuration: 15,
    highlightDuration: 60,
    springConfig: {
      smooth: { damping: 200 },
      snappy: { damping: 20, stiffness: 200 },
    },
  },
};
