// Theme type definition for @shetty4l/diagrams

export type Theme = {
  name: string;
  colors: {
    background: string;
    backgroundGradientStart: string;
    surface: string;
    surfaceBright: string;
    border: string;
    borderActive: string;
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    accent: {
      primary: string;
      glow: string;
    };
    brand: {
      blue: string;
      darkBlue: string;
    };
    status: {
      success: string;
      warning: string;
      danger: string;
      info: string;
    };
  };
  fonts: {
    sans: string;
    mono: string;
  };
  spacing: {
    page: number;
    section: number;
    element: number;
    tight: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  animation: {
    staggerDelay: number;
    entranceDuration: number;
    highlightDuration: number;
    springConfig: {
      smooth: { damping: number };
      snappy: { damping: number; stiffness: number };
    };
  };
};
