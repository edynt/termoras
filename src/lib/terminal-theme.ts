import type { ITheme } from "@xterm/xterm";

/** Light theme for xterm.js — clean neutral */
export const lightTheme: ITheme = {
  background: "#ffffff",
  foreground: "#171717",
  cursor: "#171717",
  cursorAccent: "#ffffff",
  selectionBackground: "#bfdbfe",
  selectionForeground: "#171717",
  black: "#171717",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#525252",
  brightBlack: "#737373",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#404040",
};

/** Dark theme for xterm.js — pure dark neutral */
export const darkTheme: ITheme = {
  background: "#0a0a0a",
  foreground: "#ededed",
  cursor: "#a0a0a0",
  cursorAccent: "#0a0a0a",
  selectionBackground: "#2563eb40",
  selectionForeground: "#ededed",
  black: "#0a0a0a",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#ededed",
  brightBlack: "#737373",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#fafafa",
};

/** Get xterm theme based on resolved theme */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}
