import { create } from "zustand";
import type { ThemeMode } from "../types";
import { loadThemeMode, saveThemeMode } from "../lib/storage";

interface ThemeStore {
  mode: ThemeMode;
  isDark: boolean;
  init: () => Promise<void>;
  setMode: (mode: ThemeMode) => void;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return mode === "dark";
}

function applyTheme(isDark: boolean) {
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light",
  );
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: "system",
  isDark: false,

  init: async () => {
    const mode = await loadThemeMode();
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    set({ mode, isDark });

    // Listen for system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      const { mode } = get();
      if (mode === "system") {
        const isDark = resolveIsDark("system");
        applyTheme(isDark);
        set({ isDark });
      }
    });
  },

  setMode: (mode: ThemeMode) => {
    const isDark = resolveIsDark(mode);
    applyTheme(isDark);
    set({ mode, isDark });
    saveThemeMode(mode);
  },
}));
