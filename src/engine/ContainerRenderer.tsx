// src/engine/ContainerRenderer.tsx — Dashed container group (e.g., a pipeline)
//
// Renders a dashed/solid border container with a top-left label.
// Animation state drives opacity and border/fill color switching.

import React from "react";
import { useTheme } from "../theme";
import type { ElementAnimState, ResolvedContainer } from "../types";

type ContainerRendererProps = {
  container: ResolvedContainer;
  anim: ElementAnimState;
};

export const ContainerRenderer: React.FC<ContainerRendererProps> = ({
  container,
  anim,
}) => {
  const theme = useTheme();
  const { def, left, top, width, height } = container;
  const borderStyle = def.style?.borderStyle ?? "dashed";

  // Color switches: when brightness > 0.5, switch from brand blue to accent orange
  const active = anim.brightness > 0.5;
  const borderColor = active
    ? theme.colors.accent.primary
    : theme.colors.brand.blue;
  const fillColor = active
    ? `${theme.colors.accent.primary}0C`
    : (def.style?.backgroundColor ?? `${theme.colors.brand.blue}0F`);
  const labelColor = active
    ? theme.colors.accent.primary
    : theme.colors.brand.blue;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        border: `2.5px ${borderStyle} ${borderColor}`,
        borderRadius: theme.radii.lg,
        background: fillColor,
        opacity: anim.opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: theme.spacing.tight,
          left: theme.spacing.element,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: theme.fonts.mono,
          color: labelColor,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {def.label}
      </div>
    </div>
  );
};
