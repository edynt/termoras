import { useEffect, useState, useCallback, useRef } from "react";
import { Sidebar } from "./components/sidebar";
import { MainPanel } from "./components/main-panel";
import { UpdateNotification } from "./components/update-notification";
import { OnboardingOverlay } from "./components/onboarding-overlay";
import { useAppStore } from "./stores/app-store";
import { useThemeStore } from "./stores/theme-store";
import { useTagStore } from "./stores/tag-store";
import { useOnboardingStore } from "./stores/onboarding-store";
import { useGlobalKeybindings } from "./hooks/use-global-keybindings";
import { useUpdateChecker } from "./hooks/use-update-checker";
import { startProcessPolling, stopProcessPolling } from "./stores/terminal-process-store";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 480;
const DEFAULT_SIDEBAR = 260;
const STORAGE_KEY = "termoras-sidebar-width";

export function App() {
  const init = useAppStore((s) => s.init);
  const initTheme = useThemeStore((s) => s.init);
  const loadTags = useTagStore((s) => s.loadTags);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, Number(stored))) : DEFAULT_SIDEBAR;
  });
  const dragging = useRef(false);

  // Phase 1: auto-start for first-time users
  const onboardingTriggered = useRef(false);
  useEffect(() => {
    if (!onboardingTriggered.current) {
      onboardingTriggered.current = true;
      const store = useOnboardingStore.getState();
      if (!store.isPhaseCompleted(1)) {
        setTimeout(() => store.startPhase(1), 400);
      }
    }
  }, []);

  // Phase 2: auto-start via three triggers
  useEffect(() => {
    function tryStartPhase2() {
      const store = useOnboardingStore.getState();
      const projects = useAppStore.getState().projects;
      if (store.isPhaseCompleted(1) && !store.isPhaseCompleted(2) && !store.isActive && projects.length > 0) {
        setTimeout(() => useOnboardingStore.getState().startPhase(2), 800);
      }
    }

    // Trigger 1: first project added during this session
    window.addEventListener("termoras:first-project-added", tryStartPhase2);

    // Trigger 2: Phase 1 just completed (user already has projects)
    const unsubOnboarding = useOnboardingStore.subscribe((state, prev) => {
      if (prev.isActive && !state.isActive && prev.activePhase === 1) {
        tryStartPhase2();
      }
    });

    // Trigger 3: returning user (Phase 1 done, Phase 2 pending, has projects)
    const initTimer = setTimeout(tryStartPhase2, 1000);

    return () => {
      window.removeEventListener("termoras:first-project-added", tryStartPhase2);
      unsubOnboarding();
      clearTimeout(initTimer);
    };
  }, []);

  useEffect(() => {
    init();
    initTheme();
    loadTags();
    startProcessPolling();
    return () => stopProcessPolling();
  }, [init, initTheme, loadTags]);

  useGlobalKeybindings();
  const { updateInfo, dismiss: dismissUpdate } = useUpdateChecker();

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
      {updateInfo && (
        <UpdateNotification info={updateInfo} onDismiss={dismissUpdate} />
      )}
      <OnboardingOverlay />
    </div>
  );
}
