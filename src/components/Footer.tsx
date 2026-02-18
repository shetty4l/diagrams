// src/components/Footer.tsx — Optional footer text
import React from "react";
import { useTheme } from "../theme";

type FooterProps = {
  text?: string;
  opacity?: number;
};

export const Footer: React.FC<FooterProps> = ({ text, opacity = 1 }) => {
  const theme = useTheme();

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: opacity * 0.5,
        fontFamily: theme.fonts.sans,
        fontSize: 11,
        color: theme.colors.text.tertiary,
      }}
    >
      {text}
    </div>
  );
};
