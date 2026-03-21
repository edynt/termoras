import { create } from "zustand";

interface ThemeStore {
  isDark: boolean;
  init: () => void;
}

export const useThemeStore = create<ThemeStore>(() => ({
  isDark: true,
  init: () => {
    document.documentElement.setAttribute("data-theme", "dark");
  },
}));
