import type { ITheme } from "@xterm/xterm";

/** Light theme for xterm.js — soft warm terminal */
export const lightTheme: ITheme = {
  background: "#fafafa",
  foreground: "#1a1a2e",
  cursor: "#6366f1",
  cursorAccent: "#fafafa",
  selectionBackground: "#6366f140",
  selectionForeground: "#1a1a2e",
  black: "#1a1a2e",
  red: "#e11d48",
  green: "#059669",
  yellow: "#d97706",
  blue: "#2563eb",
  magenta: "#7c3aed",
  cyan: "#0891b2",
  white: "#64748b",
  brightBlack: "#94a3b8",
  brightRed: "#fb7185",
  brightGreen: "#34d399",
  brightYellow: "#fbbf24",
  brightBlue: "#60a5fa",
  brightMagenta: "#a78bfa",
  brightCyan: "#22d3ee",
  brightWhite: "#334155",
};

/** Dark theme for xterm.js — Warp-inspired vibrant dark */
export const darkTheme: ITheme = {
  background: "#010b18",
  foreground: "#e4e4e7",
  cursor: "#6366f1",
  cursorAccent: "#010b18",
  selectionBackground: "#6366f130",
  selectionForeground: "#e4e4e7",
  black: "#1e293b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e2e8f0",
  brightBlack: "#64748b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};

/** Get xterm theme based on resolved theme */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}
