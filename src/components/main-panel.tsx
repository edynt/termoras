import { useEffect, useRef, useCallback, useState } from "react";
import { X, Terminal, Plus } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../stores/app-store";
import type { TerminalSession } from "../types";
import { TerminalPanel } from "./terminal-panel";
import { KanbanBoard } from "./kanban-board";
import { GitChangesView } from "./git-changes-view";

const DEFAULT_TERMINAL_HEIGHT = 300;
const MIN_TERMINAL_HEIGHT = 100;
const MIN_KANBAN_HEIGHT = 200;
const STORAGE_KEY = "termoras:terminal-panel-height";
const OPEN_KEY = "termoras:terminal-panel-open";

function loadSavedHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : DEFAULT_TERMINAL_HEIGHT;
  } catch {
    return DEFAULT_TERMINAL_HEIGHT;
  }
}

export function MainPanel() {
  const activeView = useAppStore((s) => s.activeView);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const terminals = useAppStore((s) => s.terminals);
  const addTerminal = useAppStore((s) => s.addTerminal);
  const [terminalHeight, setTerminalHeight] = useState(loadSavedHeight);
  const [terminalOpen, setTerminalOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== "false"; }
    catch { return true; }
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Check if the active project has any terminals
  const hasTerminals = activeProjectId
    ? terminals.some((t) => t.projectId === activeProjectId)
    : false;

  const toggleTerminal = useCallback(() => {
    setTerminalOpen((prev) => {
      const next = !prev;
      localStorage.setItem(OPEN_KEY, String(next));
      return next;
    });
  }, []);

  /** Create a new terminal for the active project and open the panel */
  const handleCreateTerminal = useCallback(() => {
    if (!activeProjectId) return;
    const count = terminals.filter((t) => t.projectId === activeProjectId).length;
    const terminal: TerminalSession = {
      id: crypto.randomUUID(),
      projectId: activeProjectId,
      name: `Terminal ${count + 1}`,
      isRunning: false,
    };
    addTerminal(terminal);
    setTerminalOpen(true);
    localStorage.setItem(OPEN_KEY, "true");
  }, [activeProjectId, terminals, addTerminal]);

  /* Ctrl+` to toggle terminal panel in kanban view (like VS Code) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`" && activeView === "kanban") {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, toggleTerminal]);

  /* Open terminal panel when a new terminal is created (from sidebar etc.) */
  useEffect(() => {
    const handleOpen = () => {
      setTerminalOpen(true);
      localStorage.setItem(OPEN_KEY, "true");
    };
    window.addEventListener("termoras:open-terminal-panel", handleOpen);
    return () => window.removeEventListener("termoras:open-terminal-panel", handleOpen);
  }, []);

  /* No synthetic resize dispatch needed — ResizeObserver in TerminalInstance handles it */

  /* Divider drag handler */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - ev.clientY;
      const clamped = Math.max(
        MIN_TERMINAL_HEIGHT,
        Math.min(newHeight, rect.height - MIN_KANBAN_HEIGHT),
      );
      setTerminalHeight(clamped);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // Persist height (ResizeObserver handles terminal refit)
      setTerminalHeight((h) => {
        localStorage.setItem(STORAGE_KEY, String(h));
        return h;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Titlebar drag region — matches macOS traffic light height */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          getCurrentWindow().startDragging();
        }}
        onDoubleClick={() => getCurrentWindow().toggleMaximize()}
        className="h-8 shrink-0 cursor-default"
      />

      {/* Kanban board */}
      {activeView === "kanban" && (
        <div className="flex-1 min-h-0 overflow-auto">
          <KanbanBoard />
        </div>
      )}

      {/* Git changes view */}
      {activeView === "git" && (
        <div className="flex-1 min-h-0 overflow-auto">
          <GitChangesView />
        </div>
      )}

      {/* Terminal divider bar — visible only in split view */}
      {activeView === "kanban" && (
        <div className="flex items-center flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
          {terminalOpen ? (
            <>
              {/* Drag handle — takes most of the bar */}
              <div
                onMouseDown={handleMouseDown}
                className="flex-1 h-6 cursor-row-resize flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="w-8 h-0.5 rounded-full bg-[var(--text-secondary)]/30" />
              </div>
              {/* Close terminal panel (PTY keeps running) */}
              <button
                onClick={toggleTerminal}
                className="px-2 h-6 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Hide terminal"
              >
                <X size={12} />
              </button>
            </>
          ) : hasTerminals ? (
            <button
              onClick={toggleTerminal}
              className="w-full h-6 flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Show terminal"
            >
              <Terminal size={12} />
              <span>Terminal</span>
            </button>
          ) : (
            <button
              onClick={handleCreateTerminal}
              className="w-full h-6 flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Create a new terminal"
            >
              <Plus size={12} />
              <span>New Terminal</span>
            </button>
          )}
        </div>
      )}

      {/* Terminal — always mounted to keep PTY alive */}
      <div
        className={
          activeView === "terminal"
            ? "flex-1 min-h-0"
            : "flex-shrink-0 overflow-hidden"
        }
        style={{
          height: activeView === "kanban" && terminalOpen ? terminalHeight : undefined,
          display: (activeView === "kanban" && !terminalOpen) || activeView === "git" ? "none" : undefined,
        }}
      >
        <TerminalPanel />
      </div>
    </div>
  );
}
