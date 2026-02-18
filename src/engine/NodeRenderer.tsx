// src/engine/NodeRenderer.tsx — Positions and renders a DiagramBox + BorderDraw
//
// Thin wrapper: takes a ResolvedNode + animation state, renders at the
// correct absolute position within the diagram container.

import React from "react";
import { BorderDraw, DiagramBox } from "../components/DiagramBox";
import { icons } from "../icons";
import { useTheme } from "../theme";
import type { ElementAnimState, ResolvedNode } from "../types";

type NodeRendererProps = {
  node: ResolvedNode;
  anim: ElementAnimState;
};

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, anim }) => {
  const theme = useTheme();
  const { def, center, width, height, isInner } = node;
  const IconComponent = icons[def.icon];
  const iconSize = def.iconSize ?? (isInner ? 16 : 20);
  const origin = def.drawOrigin ?? "left";
  const highlightColor = def.highlightColor ?? theme.colors.accent.primary;

  return (
    <div
      style={{
        position: "absolute",
        left: center.x - width / 2,
        top: center.y - height / 2,
        width,
        height,
      }}
    >
      <DiagramBox
        label={def.label}
        sublabel={def.sublabel}
        icon={<IconComponent size={iconSize} />}
        highlightProgress={anim.brightness}
        highlightColor={highlightColor}
        opacity={anim.opacity}
        labelFontSize={def.labelFontSize}
        sublabelFontSize={def.sublabelFontSize}
        style={{
          width: "100%",
          height: "100%",
          ...(isInner ? { minWidth: 0 } : {}),
          ...def.style,
        }}
      />
      {anim.drawProgress > 0 && anim.drawProgress < 1 && (
        <BorderDraw
          width={width}
          height={height}
          progress={anim.drawProgress}
          origin={origin}
          color={highlightColor}
        />
      )}
    </div>
  );
};
