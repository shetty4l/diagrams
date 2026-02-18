// src/engine/DiagramEngine.tsx — Orchestrator component
//
// Takes a DiagramConfig and renders the full diagram:
//   1. Background + Header
//   2. Diagram container (position:relative)
//      - Containers (dashed boxes)
//      - SVG arrow layer
//      - Nodes (DiagramBox + BorderDraw)
//      - Step indicator + progress dots
//   3. Footer
//
// Animation is driven by useTimeline() when available.
// Without a timeline, everything renders at full opacity (static mode).

import React from "react";
import { AbsoluteFill } from "remotion";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { StepIndicator } from "../components/StepIndicator";
import { useTheme } from "../theme";
import type { DiagramConfig, ElementAnimState } from "../types";
import { ArrowRenderer } from "./ArrowRenderer";
import { ContainerRenderer } from "./ContainerRenderer";
import { NodeRenderer } from "./NodeRenderer";
import { useGridLayout } from "./useGridLayout";
import { useTimeline } from "./useTimeline";

type DiagramEngineProps = {
  config: DiagramConfig;
};

/** Default animation state: fully visible, no animation */
const STATIC_ANIM: ElementAnimState = {
  brightness: 0,
  drawProgress: 1,
  opacity: 1,
};

export const DiagramEngine: React.FC<DiagramEngineProps> = ({ config }) => {
  const theme = useTheme();

  const layout = useGridLayout(
    config.grid,
    config.nodes,
    config.containers ?? [],
    config.connections,
  );

  const timelineState = useTimeline(
    config.timeline,
    config.nodes,
    config.connections,
    config.containers ?? [],
  );

  const pad = theme.spacing.page;

  return (
    <AbsoluteFill
      style={{
        padding: pad,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${theme.colors.backgroundGradientStart} 0%, ${theme.colors.background} 7%)`,
        fontFamily: theme.fonts.sans,
      }}
    >
      {config.header && (
        <Header title={config.header.title} subtitle={config.header.subtitle} />
      )}

      {/* Diagram container: position:relative for shared coordinate space */}
      {/* globalOpacity fades the entire diagram content during dim transitions */}
      <div
        style={{
          flex: 1,
          position: "relative",
          opacity: timelineState?.globalOpacity ?? 1,
        }}
      >
        {/* ── Containers (dashed boxes) ── */}
        {Object.values(layout.containers).map((container) => (
          <ContainerRenderer
            key={container.def.id}
            container={container}
            anim={timelineState?.containers[container.def.id] ?? STATIC_ANIM}
          />
        ))}

        {/* ── SVG arrow layer ── */}
        <svg
          width={layout.containerWidth}
          height={layout.containerHeight}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
          }}
        >
          {layout.connections.map((conn) => (
            <ArrowRenderer
              key={conn.id}
              connection={conn}
              anim={timelineState?.connections[conn.id] ?? STATIC_ANIM}
            />
          ))}
        </svg>

        {/* ── Nodes ── */}
        {Object.values(layout.nodes).map((node) => (
          <NodeRenderer
            key={node.def.id}
            node={node}
            anim={timelineState?.nodes[node.def.id] ?? STATIC_ANIM}
          />
        ))}

        {/* ── Step indicator + progress dots ── */}
        {timelineState &&
          timelineState.indicatorOpacity > 0 &&
          timelineState.currentStep && (
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                gap: theme.spacing.tight,
                opacity: timelineState.indicatorOpacity,
                background: `${theme.colors.surface}D9`,
                backdropFilter: "blur(8px)",
                padding: `${theme.spacing.element}px ${theme.spacing.section}px`,
                borderRadius: theme.radii.lg,
                boxShadow:
                  "0 2px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)",
              }}
            >
              <StepIndicator
                step={timelineState.currentStep.num}
                label={timelineState.currentStep.text}
                active
                opacity={1}
              />
              <div style={{ display: "flex", gap: theme.spacing.tight }}>
                {Array.from({ length: timelineState.totalSteps }).map(
                  (_, i) => {
                    const stepNum = i + 1;
                    const currentNum = timelineState.currentStep?.num;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: theme.radii.full,
                          background:
                            currentNum !== undefined && stepNum === currentNum
                              ? theme.colors.accent.primary
                              : currentNum !== undefined && stepNum < currentNum
                                ? theme.colors.brand.blue
                                : theme.colors.border,
                        }}
                      />
                    );
                  },
                )}
              </div>
            </div>
          )}
      </div>

      {typeof config.footer === "string" && <Footer text={config.footer} />}
    </AbsoluteFill>
  );
};
