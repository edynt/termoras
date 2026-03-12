import type { ITheme } from "@xterm/xterm";

/** Light theme for xterm.js — VS Code Light+ inspired */
export const lightTheme: ITheme = {
  background: "#ffffff",
  foreground: "#1e1e1e",
  cursor: "#333333",
  cursorAccent: "#ffffff",
  selectionBackground: "#b5d5ff",
  selectionForeground: "#1e1e1e",
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

/** Dark theme for xterm.js — deep teal-navy aesthetic */
export const darkTheme: ITheme = {
  background: "#0d1b2a",
  foreground: "#d4dde8",
  cursor: "#8fa8c0",
  cursorAccent: "#0d1b2a",
  selectionBackground: "#1e3a55",
  selectionForeground: "#d4dde8",
  black: "#0d1b2a",
  red: "#f06f6f",
  green: "#5ec4a8",
  yellow: "#e0c285",
  blue: "#6ba1f1",
  magenta: "#c586c0",
  cyan: "#56c8d8",
  white: "#d4dde8",
  brightBlack: "#7089a0",
  brightRed: "#f28b8b",
  brightGreen: "#7ad4b8",
  brightYellow: "#f0d090",
  brightBlue: "#8ab8f5",
  brightMagenta: "#d898d8",
  brightCyan: "#78dce8",
  brightWhite: "#eaebef",
};

/** Get xterm theme based on resolved theme */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}
