// src/components/StepIndicator.tsx — Step badge (flex-positioned, no x/y)
import React from "react";
import { useTheme } from "../theme";

type StepIndicatorProps = {
  step: number;
  label: string;
  active?: boolean;
  opacity?: number;
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  label,
  active = false,
  opacity = 1,
}) => {
  const theme = useTheme();
  const bgColor = active
    ? theme.colors.accent.primary
    : theme.colors.surfaceBright;
  const textColor = active ? "#FFFFFF" : theme.colors.text.secondary;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.tight,
        opacity,
        fontFamily: theme.fonts.sans,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: theme.radii.full,
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          color: textColor,
          flexShrink: 0,
          boxShadow: active
            ? `0 0 12px ${theme.colors.accent.primary}40`
            : "none",
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: active
            ? theme.colors.text.primary
            : theme.colors.text.secondary,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
    </div>
  );
};
