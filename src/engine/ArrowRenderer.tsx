// src/engine/ArrowRenderer.tsx — SVG arrow with draw animation + auto-routing
//
// Renders a polyline arrow with:
//   - Progressive stroke draw (strokeDasharray/strokeDashoffset)
//   - Arrowhead that fades in at 90% draw progress
//   - Optional label at path midpoint (horizontal → above, vertical → right)
//   - Color switches from tertiary to accent when highlighted (opacity > 0.8)

import React from "react";
import { interpolate } from "remotion";
import { useTheme } from "../theme";
import type { ElementAnimState, ResolvedConnection } from "../types";

type ArrowRendererProps = {
  connection: ResolvedConnection;
  anim: ElementAnimState;
};

export const ArrowRenderer: React.FC<ArrowRendererProps> = ({
  connection,
  anim,
}) => {
  const theme = useTheme();
  const { points, label, def } = connection;
  if (points.length < 2) return null;

  const highlighted = anim.opacity > 0.8;
  // Respect per-connection color/strokeWidth/labelFontSize overrides
  const colorOverride = def.color;
  const color =
    colorOverride ??
    (highlighted ? theme.colors.accent.primary : theme.colors.text.tertiary);
  const swOverride = def.strokeWidth;
  const sw = swOverride ?? (highlighted ? 2.5 : 1.5);
  const labelFs = def.labelFontSize ?? 11;

  // Build SVG path
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  // Compute total path length for strokeDasharray
  let totalLen = 0;
  const segs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    segs.push(segLen);
    totalLen += segLen;
  }

  // Progressive draw
  const drawnLen = totalLen * anim.drawProgress;
  const dashOffset = totalLen - drawnLen;

  // Arrowhead: fade in when draw reaches 90%
  const headOpacity = interpolate(anim.drawProgress, [0.9, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Arrowhead geometry
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const hl = swOverride ? Math.max(12, swOverride * 3) : 9;
  const head = [
    `${last.x},${last.y}`,
    `${last.x - hl * Math.cos(angle - 0.35)},${last.y - hl * Math.sin(angle - 0.35)}`,
    `${last.x - hl * Math.cos(angle + 0.35)},${last.y - hl * Math.sin(angle + 0.35)}`,
  ].join(" ");

  // Label at midpoint of total path — fade in at 40-60% draw
  const labelOpacity = interpolate(anim.drawProgress, [0.4, 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let lx = 0;
  let ly = 0;
  if (label) {
    let accum = 0;
    const half = totalLen / 2;
    for (let i = 0; i < segs.length; i++) {
      if (accum + segs[i] >= half) {
        const t = (half - accum) / segs[i];
        const mx = points[i].x + t * (points[i + 1].x - points[i].x);
        const my = points[i].y + t * (points[i + 1].y - points[i].y);
        const sdx = points[i + 1].x - points[i].x;
        const sdy = points[i + 1].y - points[i].y;
        // Horizontal → label above. Vertical → label to the right.
        lx = Math.abs(sdx) > Math.abs(sdy) ? mx : mx + 20;
        ly = Math.abs(sdx) > Math.abs(sdy) ? my - 16 : my;
        break;
      }
      accum += segs[i];
    }
    // Apply optional label offset from the connection definition
    const offset = connection.def.labelOffset;
    if (offset) {
      lx += offset.x ?? 0;
      ly += offset.y ?? 0;
    }
  }

  return (
    <g opacity={anim.opacity}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
      />
      <polygon points={head} fill={color} opacity={headOpacity} />
      {label && (
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={
            colorOverride ?? (highlighted ? color : theme.colors.text.secondary)
          }
          fontSize={labelFs}
          fontWeight={highlighted ? 600 : 500}
          fontFamily={theme.fonts.sans}
          opacity={labelOpacity}
        >
          {label.split("\n").map((line, i) => (
            <tspan key={i} x={lx} dy={i === 0 ? 0 : "1.3em"}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </g>
  );
};
