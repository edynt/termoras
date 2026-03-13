import { useEffect, useRef, useCallback, useState } from "react";
import { X, Terminal, Plus, PanelBottom, PanelRight } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../stores/app-store";
import type { TerminalSession } from "../types";
import { TerminalPanel } from "./terminal-panel";
import { KanbanBoard } from "./kanban-board";
import { GitChangesView } from "./git-changes-view";

const DEFAULT_TERMINAL_HEIGHT = 300;
const DEFAULT_TERMINAL_WIDTH = 400;
const MIN_TERMINAL_HEIGHT = 100;
const MIN_TERMINAL_WIDTH = 200;
const MIN_KANBAN_HEIGHT = 200;
const MIN_KANBAN_WIDTH = 300;
const HEIGHT_KEY = "termoras:terminal-panel-height";
const WIDTH_KEY = "termoras:terminal-panel-width";
const OPEN_KEY = "termoras:terminal-panel-open";
const POSITION_KEY = "termoras:terminal-panel-position";

type TerminalPosition = "bottom" | "right";

function loadNum(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    return saved ? Number(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function MainPanel() {
  const activeView = useAppStore((s) => s.activeView);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const terminals = useAppStore((s) => s.terminals);
  const addTerminal = useAppStore((s) => s.addTerminal);

  const [terminalHeight, setTerminalHeight] = useState(() => loadNum(HEIGHT_KEY, DEFAULT_TERMINAL_HEIGHT));
  const [terminalWidth, setTerminalWidth] = useState(() => loadNum(WIDTH_KEY, DEFAULT_TERMINAL_WIDTH));
  const [terminalOpen, setTerminalOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== "false"; }
    catch { return true; }
  });
  const [terminalPosition, setTerminalPosition] = useState<TerminalPosition>(() => {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      return saved === "right" ? "right" : "bottom";
    } catch { return "bottom"; }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isRight = terminalPosition === "right";

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

  const togglePosition = useCallback(() => {
    setTerminalPosition((prev) => {
      const next: TerminalPosition = prev === "bottom" ? "right" : "bottom";
      localStorage.setItem(POSITION_KEY, next);
      return next;
    });
  }, []);

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

  /* Ctrl+` to toggle terminal panel in kanban view */
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

  /* Open terminal panel when a new terminal is created */
  useEffect(() => {
    const handleOpen = () => {
      setTerminalOpen(true);
      localStorage.setItem(OPEN_KEY, "true");
    };
    window.addEventListener("termoras:open-terminal-panel", handleOpen);
    return () => window.removeEventListener("termoras:open-terminal-panel", handleOpen);
  }, []);

  /* Divider drag handler — adapts to terminal position */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const pos = terminalPosition;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (pos === "right") {
        const clamped = Math.max(MIN_TERMINAL_WIDTH, Math.min(rect.right - ev.clientX, rect.width - MIN_KANBAN_WIDTH));
        setTerminalWidth(clamped);
      } else {
        const clamped = Math.max(MIN_TERMINAL_HEIGHT, Math.min(rect.bottom - ev.clientY, rect.height - MIN_KANBAN_HEIGHT));
        setTerminalHeight(clamped);
      }
    };

    document.body.style.cursor = pos === "right" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (pos === "right") {
        setTerminalWidth((w) => { localStorage.setItem(WIDTH_KEY, String(w)); return w; });
      } else {
        setTerminalHeight((h) => { localStorage.setItem(HEIGHT_KEY, String(h)); return h; });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [terminalPosition]);

  // Shared button style for divider controls
  const divBtn = "flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors";

  return (
    <div ref={containerRef} className="flex flex-col h-full min-w-0 overflow-hidden">
      {/* Titlebar drag region — matches macOS traffic light height */}
      <div
        onMouseDown={(e) => { e.preventDefault(); getCurrentWindow().startDragging(); }}
        onDoubleClick={() => getCurrentWindow().toggleMaximize()}
        className="h-8 shrink-0 cursor-default"
      />

      {/* Content area — flex direction adapts to terminal position in kanban view */}
      <div className={`flex-1 min-h-0 min-w-0 flex overflow-hidden ${
        activeView === "kanban" && isRight ? "flex-row" : "flex-col"
      }`}>
        {/* Kanban board */}
        {activeView === "kanban" && (
          <div className="flex-1 min-h-0 min-w-0 overflow-auto">
            <KanbanBoard />
          </div>
        )}

        {/* Git changes view */}
        {activeView === "git" && (
          <div className="flex-1 min-h-0 min-w-0 overflow-auto">
            <GitChangesView />
          </div>
        )}

        {/* ── Terminal divider bar — kanban split view only ── */}
        {activeView === "kanban" && (
          isRight ? (
            /* Vertical divider (right position) */
            <div className="flex flex-col items-center flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-sidebar)]">
              {terminalOpen ? (
                <>
                  <button onClick={toggleTerminal} className={`${divBtn} p-1`} title="Hide terminal">
                    <X size={14} />
                  </button>
                  <button onClick={togglePosition} className={`${divBtn} p-1`} title="Move to bottom">
                    <PanelBottom size={14} />
                  </button>
                  <div
                    onMouseDown={handleMouseDown}
                    className="flex-1 w-6 cursor-col-resize flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="h-8 w-0.5 rounded-full bg-[var(--text-secondary)]/30" />
                  </div>
                </>
              ) : hasTerminals ? (
                <button
                  onClick={toggleTerminal}
                  className={`${divBtn} w-6 h-full justify-center`}
                  title="Show terminal"
                >
                  <Terminal size={14} />
                </button>
              ) : (
                <button
                  onClick={handleCreateTerminal}
                  className="flex items-center justify-center w-6 h-full text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="New terminal"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          ) : (
            /* Horizontal divider (bottom position) */
            <div className="flex items-center flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
              {terminalOpen ? (
                <>
                  <div
                    onMouseDown={handleMouseDown}
                    className="flex-1 h-6 cursor-row-resize flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="w-8 h-0.5 rounded-full bg-[var(--text-secondary)]/30" />
                  </div>
                  <button onClick={togglePosition} className={`${divBtn} px-2 h-6`} title="Move to right">
                    <PanelRight size={14} />
                  </button>
                  <button onClick={toggleTerminal} className={`${divBtn} px-2 h-6`} title="Hide terminal">
                    <X size={14} />
                  </button>
                </>
              ) : hasTerminals ? (
                <button
                  onClick={toggleTerminal}
                  className="w-full h-6 flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="Show terminal"
                >
                  <Terminal size={14} />
                  <span>Terminal</span>
                </button>
              ) : (
                <button
                  onClick={handleCreateTerminal}
                  className="w-full h-6 flex items-center justify-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="Create a new terminal"
                >
                  <Plus size={14} />
                  <span>New Terminal</span>
                </button>
              )}
            </div>
          )
        )}

        {/* Terminal — always mounted to keep PTY alive */}
        <div
          className={
            activeView === "terminal"
              ? "flex-1 min-h-0 min-w-0"
              : "flex-shrink-0 overflow-hidden"
          }
          style={{
            ...(activeView === "kanban" && terminalOpen
              ? isRight
                ? { width: terminalWidth }
                : { height: terminalHeight }
              : {}),
            display: (activeView === "kanban" && !terminalOpen) || activeView === "git"
              ? "none" : undefined,
          }}
        >
          <TerminalPanel />
        </div>
      </div>
    </div>
  );
}
