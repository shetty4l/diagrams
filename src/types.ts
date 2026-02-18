// src/types.ts — Type definitions for the declarative diagram engine
//
// Design: Diagrams are defined as pure data (nodes, connections, containers,
// timeline). The engine reads this data and handles grid layout, arrow routing,
// and animation. Each diagram is a thin config file, not a React component.

import type { DrawOrigin } from "./components/DiagramBox";
import type { IconName } from "./icons";

// ─── Geometry Primitives ────────────────────────────────────────

export type Point = { x: number; y: number };

export type Edge = "left" | "right" | "top" | "bottom";

// ─── Grid Configuration ─────────────────────────────────────────

export type GridConfig = {
  rows: number;
  cols: number;
  /** Canvas dimensions (default 1920×1080) */
  canvas?: { width: number; height: number };
  /** Fractional space reserved for header, footer, step indicator */
  headerFrac?: number; // default 0.06
  footerFrac?: number; // default 0.03
  stepIndicatorFrac?: number; // default 0.05
};

// ─── Node Definitions ───────────────────────────────────────────

export type NodeDef = {
  id: string;
  label: string;
  sublabel?: string;
  icon: IconName;
  /** Grid position in the outer grid (row, col) */
  position: { row: number; col: number };
  /** If this node lives inside a container, the container ID */
  container?: string;
  /** Column index within the container's inner grid (required if container is set) */
  innerCol?: number;
  /**
   * Align this node's X to match another node's inner column.
   * Used for nodes outside a container that should line up vertically
   * with an inner node (e.g., an image node aligns with a server node).
   */
  alignToInnerCol?: { containerId: string; innerCol: number };
  /** Box spans multiple grid columns (default: 1). Width = cellWidth * widthCols. */
  widthCols?: number;
  /** Box spans multiple grid rows (default: 1). Height = cellHeight * heightRows. */
  heightRows?: number;
  /** Which edge the border draw animation starts from (default: 'left') */
  drawOrigin?: DrawOrigin;
  /** Override label font size (default: 13 for outer, scales for inner) */
  labelFontSize?: number;
  /** Override sublabel font size (default: 10) */
  sublabelFontSize?: number;
  /** Override icon size in px (default: 20 for outer, 16 for inner) */
  iconSize?: number;
  /** Override box height as fraction of cell height (default: 0.32 for single-cell outer) */
  boxHeightFrac?: number;
  /** Override highlight / border-draw color (default: theme accent) */
  highlightColor?: string;
  /** Style escape hatch */
  style?: React.CSSProperties;
};

// ─── Container Definitions ──────────────────────────────────────

export type ContainerDef = {
  id: string;
  label: string;
  /** Which outer grid cells this container spans (inclusive) */
  span: {
    fromRow: number;
    toRow: number;
    fromCol: number;
    toCol: number;
  };
  /** How many columns the inner grid has (rows is always 1 for now) */
  innerGrid: { cols: number };
  /** Fractional inset from cell edges (default 0.06) */
  insetFrac?: number;
  style?: {
    borderStyle?: "dashed" | "solid";
    backgroundColor?: string;
  };
};

// ─── Connection Definitions ─────────────────────────────────────
//
// Connections reference node IDs or container edge refs.
// Container edge refs use the format: "container:<containerId>"
//
// fromEdge/toEdge are optional — the engine infers them from the
// relative positions of the source and target. Override when the
// auto-inferred edge is wrong (e.g., vertical connections between rows).

export type ConnectionTarget =
  | string // node ID
  | { container: string; edge: "left" | "right" }; // container border

export type ConnectionDef = {
  id?: string; // auto-generated as "from->to" if omitted
  from: ConnectionTarget;
  to: ConnectionTarget;
  fromEdge?: Edge; // optional override; inferred if omitted
  toEdge?: Edge; // optional override; inferred if omitted
  label?: string;
  /** Offset label position from the default. Positive x = right, positive y = down. */
  labelOffset?: { x?: number; y?: number };
  /** Override arrow stroke width (default: 1.5 normal, 2.5 highlighted) */
  strokeWidth?: number;
  /** Override arrow color (default: tertiary when dim, accent when highlighted) */
  color?: string;
  /** Override arrow label font size (default: 11) */
  labelFontSize?: number;
  /** Manual waypoints for complex routes. If omitted, auto-routed. */
  waypoints?: Point[];
};

// ─── Animation Timeline ─────────────────────────────────────────
//
// The timeline is a flat list of phases. Each phase is either:
//   - hold: pause for a duration (seconds)
//   - sequence: a list of animation steps that play one after another
//
// Steps within a sequence play sequentially (one finishes, next starts).
// Phases themselves also play sequentially.

export type StepLabel = {
  num: number;
  text: string;
};

export type AnimationStep =
  | {
      action: "fillBox";
      target: string;
      duration?: number;
      step?: StepLabel;
      group?: string;
    }
  | {
      action: "dimBox";
      target: string;
      duration?: number;
      step?: StepLabel;
      group?: string;
    }
  | {
      action: "drawLine";
      target: string;
      duration?: number;
      step?: StepLabel;
      group?: string;
    }
  | {
      action: "showContainer";
      target: string;
      duration?: number;
      step?: StepLabel;
      group?: string;
    }
  | { action: "hold"; duration: number }
  | { action: "parallel"; steps: AnimationStep[]; group?: string };

export type Phase =
  | { type: "hold"; duration: number } // seconds — hold current state
  | { type: "sequence"; steps: AnimationStep[] }
  | { type: "dim"; duration: number } // seconds — ramp all elements from full → dim
  | { type: "reveal"; duration: number }; // seconds — ramp all elements from dim → full

export type Timeline = Phase[];

// ─── Resolved Animation State ───────────────────────────────────
//
// The timeline engine resolves the declarative timeline into per-frame
// state for every element. These are the values renderers consume.

export type ElementAnimState = {
  /** 0–1 brightness/highlight progress (drives opacity + glow) */
  brightness: number;
  /** 0–1 border draw / stroke draw progress (drives SVG dasharray) */
  drawProgress: number;
  /** Final resolved opacity (dim + brightness contribution) */
  opacity: number;
};

export type TimelineState = {
  nodes: Record<string, ElementAnimState>;
  connections: Record<string, ElementAnimState>;
  containers: Record<string, ElementAnimState>;
  /** Current step indicator (if any) */
  currentStep?: { num: number; text: string; progress: number };
  /** How many labeled steps total */
  totalSteps: number;
  /** 0–1 opacity for the step indicator area */
  indicatorOpacity: number;
  /** 0–1 global opacity for the diagram content area (used by dim phase) */
  globalOpacity: number;
  /** 0–1 per-element brightness floor (1 during bookend holds, 0 during walkthrough) */
  globalFloor: number;
};

// ─── Resolved Layout ────────────────────────────────────────────
//
// The grid layout hook resolves node/container/connection positions
// into absolute pixel coordinates within the diagram container.

export type ResolvedNode = {
  def: NodeDef;
  center: Point;
  width: number;
  height: number;
  isInner: boolean;
};

export type ResolvedContainer = {
  def: ContainerDef;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Space reserved for the container label */
  labelHeight: number;
  /** Inner grid origin and cell dimensions */
  innerGrid: {
    left: number;
    top: number;
    cellWidth: number;
    cellHeight: number;
  };
};

export type ResolvedConnection = {
  def: ConnectionDef;
  id: string;
  points: Point[];
  label?: string;
};

export type ResolvedLayout = {
  nodes: Record<string, ResolvedNode>;
  containers: Record<string, ResolvedContainer>;
  connections: ResolvedConnection[];
  /** Container dimensions (after padding) */
  containerWidth: number;
  containerHeight: number;
  /** Grid area bounds */
  gridTop: number;
  gridBottom: number;
  cellWidth: number;
  cellHeight: number;
};

// ─── Full Diagram Configuration ─────────────────────────────────

export type DiagramConfig = {
  grid: GridConfig;
  nodes: NodeDef[];
  connections: ConnectionDef[];
  containers?: ContainerDef[];
  timeline: Timeline;
  header?: { title: string; subtitle?: string };
  /** Footer text, or false to disable. Omitting renders no footer. */
  footer?: string | false;
};

// ─── Utilities ──────────────────────────────────────────────────

/** Derive a stable ID for a connection definition. */
export function getConnectionId(def: ConnectionDef): string {
  if (def.id) return def.id;
  const fromId =
    typeof def.from === "string"
      ? def.from
      : `container:${def.from.container}:${def.from.edge}`;
  const toId =
    typeof def.to === "string"
      ? def.to
      : `container:${def.to.container}:${def.to.edge}`;
  return `${fromId}->${toId}`;
}
