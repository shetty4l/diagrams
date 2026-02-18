// src/components/DiagramBox.tsx — Flex-friendly box node (no absolute positioning)
//
// The box always renders its normal appearance. Visual highlighting is
// driven by `highlightProgress` (0→1) which smoothly interpolates all
// styling from normal → highlighted. Border draw-in animation is
// handled externally via the BorderDraw overlay.
import React from "react";
import { interpolateColors } from "remotion";
import { useTheme } from "../theme";

export type DrawOrigin = "left" | "right" | "top" | "bottom";

type DiagramBoxProps = {
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  highlightProgress?: number; // 0→1: smoothly interpolates normal → highlighted styling
  highlightColor?: string;
  opacity?: number;
  labelFontSize?: number;
  sublabelFontSize?: number;
  style?: React.CSSProperties;
};

export const DiagramBox: React.FC<DiagramBoxProps> = ({
  label,
  sublabel,
  icon,
  highlightProgress,
  highlightColor,
  opacity = 1,
  labelFontSize = 13,
  sublabelFontSize = 10,
  style,
}) => {
  const theme = useTheme();
  const hp = highlightProgress ?? 0;
  const effectiveHighlightColor = highlightColor ?? theme.colors.accent.primary;

  const borderColor = interpolateColors(
    hp,
    [0, 1],
    [theme.colors.border, effectiveHighlightColor],
  );
  const bgColor = interpolateColors(
    hp,
    [0, 1],
    [theme.colors.surface, theme.colors.accent.glow],
  );
  const iconColor = interpolateColors(
    hp,
    [0, 1],
    [theme.colors.text.secondary, effectiveHighlightColor],
  );

  // Box shadow: blend from subtle to glow. Use opacity on the glow portion.
  const glowOpacity = Math.round(hp * 0x40); // 0→64 in hex
  const glowHex = glowOpacity.toString(16).padStart(2, "0");
  const shadow =
    hp > 0.01
      ? `0 0 20px ${effectiveHighlightColor}${glowHex}, 0 2px 8px rgba(0,0,0,0.08)`
      : "0 1px 4px rgba(0,0,0,0.06)";

  const lines = label.split("\n");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: `${theme.spacing.tight}px ${theme.spacing.element}px`,
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: theme.radii.md,
        boxShadow: shadow,
        opacity,
        fontFamily: theme.fonts.sans,
        ...style,
      }}
    >
      {icon && <div style={{ color: iconColor }}>{icon}</div>}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize:
                i === 0 ? labelFontSize : Math.round(labelFontSize * 0.85),
              fontWeight: i === 0 ? 600 : 400,
              color:
                i === 0
                  ? theme.colors.text.primary
                  : theme.colors.text.secondary,
              textAlign: "center",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: sublabelFontSize,
            color: theme.colors.text.tertiary,
            textAlign: "center",
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

// ─── Border Draw Overlay ────────────────────────────────────────
//
// SVG path that traces a rounded-rect perimeter starting from the
// midpoint of `origin` edge, going clockwise. Rendered as a sibling
// overlay on top of DiagramBox.

const perimeterPath = (
  w: number,
  h: number,
  r: number,
  origin: DrawOrigin,
): string => {
  const cr = Math.min(r, w / 2, h / 2);

  switch (origin) {
    case "top":
      return `M ${w / 2} 0 L ${w - cr} 0 A ${cr} ${cr} 0 0 1 ${w} ${cr} L ${w} ${h - cr} A ${cr} ${cr} 0 0 1 ${w - cr} ${h} L ${cr} ${h} A ${cr} ${cr} 0 0 1 0 ${h - cr} L 0 ${cr} A ${cr} ${cr} 0 0 1 ${cr} 0 Z`;
    case "right":
      return `M ${w} ${h / 2} L ${w} ${h - cr} A ${cr} ${cr} 0 0 1 ${w - cr} ${h} L ${cr} ${h} A ${cr} ${cr} 0 0 1 0 ${h - cr} L 0 ${cr} A ${cr} ${cr} 0 0 1 ${cr} 0 L ${w - cr} 0 A ${cr} ${cr} 0 0 1 ${w} ${cr} Z`;
    case "bottom":
      return `M ${w / 2} ${h} L ${cr} ${h} A ${cr} ${cr} 0 0 1 0 ${h - cr} L 0 ${cr} A ${cr} ${cr} 0 0 1 ${cr} 0 L ${w - cr} 0 A ${cr} ${cr} 0 0 1 ${w} ${cr} L ${w} ${h - cr} A ${cr} ${cr} 0 0 1 ${w - cr} ${h} Z`;
    case "left":
    default:
      return `M 0 ${h / 2} L 0 ${cr} A ${cr} ${cr} 0 0 1 ${cr} 0 L ${w - cr} 0 A ${cr} ${cr} 0 0 1 ${w} ${cr} L ${w} ${h - cr} A ${cr} ${cr} 0 0 1 ${w - cr} ${h} L ${cr} ${h} A ${cr} ${cr} 0 0 1 0 ${h - cr} Z`;
  }
};

const perimeterLength = (w: number, h: number, r: number): number => {
  const cr = Math.min(r, w / 2, h / 2);
  return 2 * (w + h) - cr * (8 - 2 * Math.PI);
};

/**
 * Standalone SVG border draw overlay. Renders on top of DiagramBox as
 * a sibling in the same sized container. Traces the perimeter in accent
 * color from the `origin` edge midpoint going clockwise.
 */
export const BorderDraw: React.FC<{
  width: number;
  height: number;
  progress: number;
  origin: DrawOrigin;
  color: string;
  strokeWidth?: number;
  radius?: number;
}> = ({ width, height, progress, origin, color, strokeWidth = 2, radius }) => {
  const theme = useTheme();
  const r = radius ?? theme.radii.md;

  if (progress <= 0 || progress >= 1) return null;

  const totalLen = perimeterLength(width, height, r);
  const d = perimeterPath(width, height, r, origin);
  const dashOffset = totalLen * (1 - progress);

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={totalLen}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
};
