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

/**
 * Dark theme for xterm.js — matches Warp's default dark theme.
 * Background is near-black with very subtle warm tint.
 * ANSI colors use Warp's vibrant palette.
 */
export const darkTheme: ITheme = {
  background: "#09090b",
  foreground: "#d4d4d8",
  cursor: "#d4d4d8",
  cursorAccent: "#09090b",
  selectionBackground: "#27272a",
  selectionForeground: "#d4d4d8",
  black: "#09090b",
  red: "#ff5c57",
  green: "#5af78e",
  yellow: "#f3f99d",
  blue: "#57c7ff",
  magenta: "#ff6ac1",
  cyan: "#9aedfe",
  white: "#f1f1f0",
  brightBlack: "#686868",
  brightRed: "#ff5c57",
  brightGreen: "#5af78e",
  brightYellow: "#f3f99d",
  brightBlue: "#57c7ff",
  brightMagenta: "#ff6ac1",
  brightCyan: "#9aedfe",
  brightWhite: "#f1f1f0",
};

/** Get xterm theme based on resolved theme */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}
