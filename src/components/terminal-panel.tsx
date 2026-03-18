import { Plus, Terminal } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { TerminalInstance } from "./terminal-instance";
import { TerminalTabBar } from "./terminal-tab-bar";
import type { TerminalSession } from "../types";

export function TerminalPanel() {
  const allTerminals = useAppStore((s) => s.terminals);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
  const activeView = useAppStore((s) => s.activeView);
  const addTerminal = useAppStore((s) => s.addTerminal);

  // Terminals for the active project
  const projectTerminals = activeProjectId
    ? allTerminals.filter((t) => t.projectId === activeProjectId)
    : [];

  // Terminal view: show all terminals; Kanban view: show only active project's terminals
  const terminals = activeView === "terminal" ? allTerminals : projectTerminals;

  // Get project path for each terminal
  function getProjectPath(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.path ?? "/";
  }

  function handleCreateTerminal() {
    if (!activeProjectId) return;
    const count = projectTerminals.length;
    const terminal: TerminalSession = {
      id: crypto.randomUUID(),
      projectId: activeProjectId,
      name: count === 0 ? "Terminal" : `Terminal ${count + 1}`,
      isRunning: false,
    };
    addTerminal(terminal);
  }

  if (allTerminals.length === 0 || terminals.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center h-full bg-[var(--bg-primary)]">
        {activeProjectId ? (
          <button
            onClick={handleCreateTerminal}
            className="flex flex-col items-center gap-3 px-6 py-4 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
          >
            <Plus size={36} className="text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)] transition-colors" />
            <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              New Terminal
            </span>
          </button>
        ) : (
          <>
            <Terminal size={48} className="mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Select a project to start
            </p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-col h-full w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* Tab bar — filtered by view context */}
      <TerminalTabBar
        terminals={terminals}
        activeTerminalId={activeTerminalId}
        onCreateTerminal={handleCreateTerminal}
      />

      {/* Terminal instances — ALL terminals stay mounted to keep PTYs alive */}
      <div className="relative flex-1 min-h-0 w-full">
        {allTerminals.map((t) => {
          const isActive = t.id === activeTerminalId;
          return (
            <div
              key={t.id}
              className="absolute inset-0"
              style={{
                visibility: isActive ? "visible" : "hidden",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              <TerminalInstance
                terminalId={t.id}
                projectPath={getProjectPath(t.projectId)}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}
