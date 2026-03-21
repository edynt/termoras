import type { ITheme } from "@xterm/xterm";

/** Dark theme for xterm.js — deep navy with vibrant colors */
export const terminalTheme: ITheme = {
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

/** Get xterm theme — always dark */
export function getTerminalTheme(): ITheme {
  return terminalTheme;
}
