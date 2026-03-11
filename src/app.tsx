import { useEffect, useState, useCallback, useRef } from "react";
import { Sidebar } from "./components/sidebar";
import { MainPanel } from "./components/main-panel";
import { useAppStore } from "./stores/app-store";
import { useThemeStore } from "./stores/theme-store";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 480;
const DEFAULT_SIDEBAR = 260;
const STORAGE_KEY = "kodeck-sidebar-width";

export function App() {
  const init = useAppStore((s) => s.init);
  const initTheme = useThemeStore((s) => s.init);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, Number(stored))) : DEFAULT_SIDEBAR;
  });
  const dragging = useRef(false);

  useEffect(() => {
    init();
    initTheme();
  }, [init, initTheme]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, ev.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist on release
      setSidebarWidth((w) => {
        localStorage.setItem(STORAGE_KEY, String(w));
        return w;
      });
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div
      className="grid h-screen bg-[var(--bg-primary)]"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
    >
      <Sidebar />
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-[var(--accent-blue)]/30 active:bg-[var(--accent-blue)]/50 transition-colors"
        style={{ left: sidebarWidth - 2 }}
      />
      <MainPanel />
    </div>
  );
}
