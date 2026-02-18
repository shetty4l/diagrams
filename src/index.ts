// src/index.ts — barrel export for @shetty4l/diagrams

export type { DrawOrigin } from "./components/DiagramBox";
// Components
export {
  BorderDraw,
  DiagramBox,
} from "./components/DiagramBox";
export { Footer } from "./components/Footer";
export { Header } from "./components/Header";
export { StepIndicator } from "./components/StepIndicator";
export { ArrowRenderer } from "./engine/ArrowRenderer";
export { ContainerRenderer } from "./engine/ContainerRenderer";
// Engine
export { DiagramEngine } from "./engine/DiagramEngine";
export { NodeRenderer } from "./engine/NodeRenderer";
export { resolveLayout, useGridLayout } from "./engine/useGridLayout";
export { calculateTotalDuration, useTimeline } from "./engine/useTimeline";
export type { IconName } from "./icons";
// Icons
export { icons } from "./icons";
export type { Theme } from "./theme";
// Theme
export {
  defaultLight,
  presentationLight,
  ThemeProvider,
  useTheme,
} from "./theme";

// Types
export type {
  AnimationStep,
  ConnectionDef,
  ConnectionTarget,
  ContainerDef,
  DiagramConfig,
  Edge,
  ElementAnimState,
  GridConfig,
  NodeDef,
  Phase,
  Point,
  ResolvedConnection,
  ResolvedContainer,
  ResolvedLayout,
  ResolvedNode,
  StepLabel,
  Timeline,
  TimelineState,
} from "./types";
export { getConnectionId } from "./types";
