import type { ITheme } from "@xterm/xterm";

/** Light theme for xterm.js — macOS-native aligned */
export const lightTheme: ITheme = {
  background: "#ffffff",
  foreground: "#1c1c1e",
  cursor: "#1c1c1e",
  cursorAccent: "#ffffff",
  selectionBackground: "#b5d5ff",
  selectionForeground: "#1c1c1e",
  black: "#1e1e1e",
  red: "#cd3131",
  green: "#00bc7c",
  yellow: "#b5a000",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#424242",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#c4a500",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#525252",
};

/** Dark theme for xterm.js — Warp-inspired vibrant dark */
export const darkTheme: ITheme = {
  background: "#0b1622",
  foreground: "#d8dee9",
  cursor: "#f8f8f2",
  cursorAccent: "#0b1622",
  selectionBackground: "#3d5a80",
  selectionForeground: "#d8dee9",
  black: "#0b1622",
  red: "#ff6b6b",
  green: "#69db7c",
  yellow: "#ffd43b",
  blue: "#74c0fc",
  magenta: "#da77f2",
  cyan: "#66d9ef",
  white: "#d8dee9",
  brightBlack: "#5c7089",
  brightRed: "#ff8787",
  brightGreen: "#8ce99a",
  brightYellow: "#ffe066",
  brightBlue: "#a5d8ff",
  brightMagenta: "#e599f7",
  brightCyan: "#99e9f2",
  brightWhite: "#eceff4",
};

/** Get xterm theme based on resolved theme */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}
