// src/components/Header.tsx — Title bar with accent color bar
import React from "react";
import { useTheme } from "../theme";

type HeaderProps = {
  title: string;
  subtitle?: string;
  opacity?: number;
};

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  opacity = 1,
}) => {
  const theme = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity,
        fontFamily: theme.fonts.sans,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 48,
          height: 4,
          background: theme.colors.accent.primary,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: theme.colors.text.primary,
          letterSpacing: -0.5,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: theme.colors.text.secondary,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
