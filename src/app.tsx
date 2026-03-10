import { useEffect } from "react";
import { Sidebar } from "./components/sidebar";
import { TerminalPanel } from "./components/terminal-panel";
import { useAppStore } from "./stores/app-store";
import { useThemeStore } from "./stores/theme-store";

export function App() {
  const init = useAppStore((s) => s.init);
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    init();
    initTheme();
  }, [init, initTheme]);

  return (
    <div className="grid grid-cols-[260px_1fr] h-screen">
      <Sidebar />
      <TerminalPanel />
    </div>
  );
}
