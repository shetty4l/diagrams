// src/engine/useGridLayout.ts — Grid geometry + position resolution
//
// Converts declarative diagram config (nodes, containers, connections)
// into absolute pixel positions within a container-local coordinate space.
//
// Derivation chain:
//   canvas size → padding → container dims → header/footer fracs →
//   grid area → cell sizes → node centers → edge anchors → arrow routes
//
// No magic numbers. Every pixel traces back to the canvas + theme.

import { useMemo } from "react";
import type { Theme } from "../theme";
import { useTheme } from "../theme";
import type {
  ConnectionDef,
  ConnectionTarget,
  ContainerDef,
  Edge,
  GridConfig,
  NodeDef,
  Point,
  ResolvedConnection,
  ResolvedContainer,
  ResolvedLayout,
  ResolvedNode,
} from "../types";
import { getConnectionId } from "../types";

// ─── Default Values ─────────────────────────────────────────────

const DEFAULT_CANVAS = { width: 1920, height: 1080 };
const DEFAULT_HEADER_FRAC = 0.06;
const DEFAULT_FOOTER_FRAC = 0.03;
const DEFAULT_STEP_INDICATOR_FRAC = 0.05;
const DEFAULT_CONTAINER_INSET_FRAC = 0.06;
const CONTAINER_LABEL_H = 24;

// Box size as fraction of cell
const OUTER_BOX_W_FRAC = 0.62;
const OUTER_BOX_H_FRAC = 0.32;
const INNER_BOX_W_FRAC = 0.58;
const INNER_BOX_H_FRAC = 0.55;

// ─── Hook ───────────────────────────────────────────────────────

export function useGridLayout(
  grid: GridConfig,
  nodes: NodeDef[],
  containers: ContainerDef[],
  connections: ConnectionDef[],
): ResolvedLayout {
  const theme = useTheme();
  return useMemo(() => {
    return resolveLayout(grid, nodes, containers, connections, theme);
  }, [grid, nodes, containers, connections, theme]);
}

// ─── Pure Layout Resolution ─────────────────────────────────────
// Exported separately for testing without React hooks.

export function resolveLayout(
  grid: GridConfig,
  nodes: NodeDef[],
  containers: ContainerDef[],
  connections: ConnectionDef[],
  theme: Theme,
): ResolvedLayout {
  const canvas = grid.canvas ?? DEFAULT_CANVAS;
  const pad = theme.spacing.page;
  const containerW = canvas.width - pad * 2;
  const containerH = canvas.height - pad * 2;

  const headerFrac = grid.headerFrac ?? DEFAULT_HEADER_FRAC;
  const footerFrac = grid.footerFrac ?? DEFAULT_FOOTER_FRAC;
  const stepFrac = grid.stepIndicatorFrac ?? DEFAULT_STEP_INDICATOR_FRAC;

  const gridTop = containerH * headerFrac;
  const gridBottom = containerH * (1 - footerFrac - stepFrac);
  const gridW = containerW;
  const gridH = gridBottom - gridTop;
  const cellW = gridW / grid.cols;
  const cellH = gridH / grid.rows;

  // Outer cell center
  const outerCellCenter = (row: number, col: number): Point => ({
    x: cellW * col + cellW / 2,
    y: gridTop + cellH * row + cellH / 2,
  });

  // ── Resolve Containers ──

  const resolvedContainers: Record<string, ResolvedContainer> = {};

  for (const cdef of containers) {
    const insetFrac = cdef.insetFrac ?? DEFAULT_CONTAINER_INSET_FRAC;
    const mfPad = theme.spacing.element;

    const left = cellW * cdef.span.fromCol + cellW * insetFrac;
    const right = cellW * (cdef.span.toCol + 1) - cellW * insetFrac;
    // Vertical: center on the row midpoint, extend by ±0.52 of cell height
    const rowMidY = outerCellCenter(cdef.span.fromRow, 0).y;
    const top = rowMidY - cellH * 0.52;
    const bottom = rowMidY + cellH * 0.52;
    const w = right - left;
    const h = bottom - top;

    // Inner grid: inside container padding + label
    const innerLeft = left + mfPad;
    const innerRight = right - mfPad;
    const innerTop = top + mfPad + CONTAINER_LABEL_H;
    const innerBottom = bottom - mfPad;
    const innerW = innerRight - innerLeft;
    const innerH = innerBottom - innerTop;
    const innerCellW = innerW / cdef.innerGrid.cols;
    const innerCellH = innerH; // single row

    resolvedContainers[cdef.id] = {
      def: cdef,
      left,
      top,
      width: w,
      height: h,
      labelHeight: CONTAINER_LABEL_H,
      innerGrid: {
        left: innerLeft,
        top: innerTop,
        cellWidth: innerCellW,
        cellHeight: innerCellH,
      },
    };
  }

  // Inner cell center helper
  const innerCellCenter = (containerId: string, col: number): Point => {
    const c = resolvedContainers[containerId];
    if (!c) throw new Error(`Container "${containerId}" not found in layout`);
    return {
      x:
        c.innerGrid.left +
        c.innerGrid.cellWidth * col +
        c.innerGrid.cellWidth / 2,
      y: c.innerGrid.top + c.innerGrid.cellHeight / 2,
    };
  };

  // ── Resolve Nodes ──

  const resolvedNodes: Record<string, ResolvedNode> = {};

  for (const ndef of nodes) {
    const isInner = ndef.container != null;
    let center: Point;
    let w: number;
    let h: number;

    if (isInner && ndef.container && ndef.innerCol != null) {
      // Node inside a container — use inner grid
      center = innerCellCenter(ndef.container, ndef.innerCol);
      const c = resolvedContainers[ndef.container];
      w = c.innerGrid.cellWidth * INNER_BOX_W_FRAC;
      h = c.innerGrid.cellHeight * INNER_BOX_H_FRAC;
    } else if (ndef.alignToInnerCol) {
      // Node outside container but aligned to an inner column's X
      const innerX = innerCellCenter(
        ndef.alignToInnerCol.containerId,
        ndef.alignToInnerCol.innerCol,
      ).x;
      center = {
        x: innerX,
        y: outerCellCenter(ndef.position.row, ndef.position.col).y,
      };
      w = cellW * OUTER_BOX_W_FRAC;
      h = cellH * (ndef.boxHeightFrac ?? OUTER_BOX_H_FRAC);
    } else {
      // Standard outer node
      const wCols = ndef.widthCols ?? 1;
      const hRows = ndef.heightRows ?? 1;

      // Center of the spanned cell range
      const startCenter = outerCellCenter(ndef.position.row, ndef.position.col);
      center = {
        x: startCenter.x + (cellW * (wCols - 1)) / 2,
        y: startCenter.y + (cellH * (hRows - 1)) / 2,
      };

      w = cellW * (wCols > 1 ? wCols * 0.92 : OUTER_BOX_W_FRAC);
      // Height: explicit boxHeightFrac > multi-row > wide-bar > default
      const defaultHFrac =
        hRows > 1 ? hRows * 0.72 : wCols > 1 ? 0.52 : OUTER_BOX_H_FRAC;
      h = cellH * (ndef.boxHeightFrac ?? defaultHFrac);
    }

    resolvedNodes[ndef.id] = {
      def: ndef,
      center,
      width: w,
      height: h,
      isInner,
    };
  }

  // ── Edge Anchors ──

  const nodeEdge = (nodeId: string, edge: Edge): Point => {
    const n = resolvedNodes[nodeId];
    if (!n) throw new Error(`Node "${nodeId}" not found in layout`);
    const hbw = n.width / 2;
    const hbh = n.height / 2;
    switch (edge) {
      case "right":
        return { x: n.center.x + hbw, y: n.center.y };
      case "left":
        return { x: n.center.x - hbw, y: n.center.y };
      case "top":
        return { x: n.center.x, y: n.center.y - hbh };
      case "bottom":
        return { x: n.center.x, y: n.center.y + hbh };
    }
  };

  const containerEdge = (
    containerId: string,
    edge: "left" | "right",
    y: number,
  ): Point => {
    const c = resolvedContainers[containerId];
    if (!c) throw new Error(`Container "${containerId}" not found in layout`);
    return { x: edge === "left" ? c.left : c.left + c.width, y };
  };

  // ── Infer Edge ──
  // Given source and target positions, infer which edge to use.

  const inferEdge = (from: Point, to: Point): Edge => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "bottom" : "top";
  };

  const getTargetCenter = (target: ConnectionTarget): Point => {
    if (typeof target === "string") {
      const n = resolvedNodes[target];
      if (!n) throw new Error(`Node "${target}" not found in layout`);
      return n.center;
    }
    const c = resolvedContainers[target.container];
    if (!c)
      throw new Error(`Container "${target.container}" not found in layout`);
    const y = outerCellCenter(c.def.span.fromRow, 0).y;
    return containerEdge(target.container, target.edge, y);
  };

  // ── Auto-Route Orthogonal Path ──
  // Given source and target points + edges, compute an orthogonal path.

  const autoRoute = (
    from: Point,
    fromEdge: Edge,
    to: Point,
    toEdge: Edge,
  ): Point[] => {
    // Same Y (horizontal connection)
    if (Math.abs(from.y - to.y) < 1) {
      return [from, to];
    }
    // Same X (vertical connection)
    if (Math.abs(from.x - to.x) < 1) {
      return [from, to];
    }
    // L-shaped: horizontal exit → vertical turn → horizontal enter
    if (
      (fromEdge === "right" || fromEdge === "left") &&
      (toEdge === "right" || toEdge === "left")
    ) {
      const midX = (from.x + to.x) / 2;
      return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
    }
    // Vertical exit → horizontal enter
    if (
      (fromEdge === "top" || fromEdge === "bottom") &&
      (toEdge === "top" || toEdge === "bottom")
    ) {
      return [from, to]; // straight vertical
    }
    // Mixed: just connect directly for now (edge case)
    const midY = (from.y + to.y) / 2;
    return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
  };

  // ── Resolve Connections ──

  const resolvedConnections: ResolvedConnection[] = [];

  for (const cdef of connections) {
    const fromCenter = getTargetCenter(cdef.from);
    const toCenter = getTargetCenter(cdef.to);

    // Infer edges if not specified
    const fromEdge =
      cdef.fromEdge ??
      (typeof cdef.from === "string"
        ? inferEdge(fromCenter, toCenter)
        : cdef.from.edge === "left"
          ? "left"
          : "right");
    const toEdge =
      cdef.toEdge ??
      (typeof cdef.to === "string"
        ? inferEdge(toCenter, fromCenter)
        : cdef.to.edge === "left"
          ? "left"
          : "right");

    // Resolve the actual anchor points using the inferred edges
    const fromPoint =
      typeof cdef.from === "string"
        ? nodeEdge(cdef.from, fromEdge)
        : containerEdge(
            (cdef.from as { container: string; edge: "left" | "right" })
              .container,
            (cdef.from as { container: string; edge: "left" | "right" }).edge,
            fromCenter.y,
          );

    const toPoint =
      typeof cdef.to === "string"
        ? nodeEdge(cdef.to, toEdge)
        : containerEdge(
            (cdef.to as { container: string; edge: "left" | "right" })
              .container,
            (cdef.to as { container: string; edge: "left" | "right" }).edge,
            toCenter.y,
          );

    // Use manual waypoints if provided, otherwise auto-route
    const points = cdef.waypoints
      ? [fromPoint, ...cdef.waypoints, toPoint]
      : autoRoute(fromPoint, fromEdge, toPoint, toEdge);

    const id = getConnectionId(cdef);

    resolvedConnections.push({
      def: cdef,
      id,
      points,
      label: cdef.label,
    });
  }

  return {
    nodes: resolvedNodes,
    containers: resolvedContainers,
    connections: resolvedConnections,
    containerWidth: containerW,
    containerHeight: containerH,
    gridTop,
    gridBottom,
    cellWidth: cellW,
    cellHeight: cellH,
  };
}
