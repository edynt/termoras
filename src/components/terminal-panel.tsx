import { Terminal } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { TerminalInstance } from "./terminal-instance";

export function TerminalPanel() {
  const terminals = useAppStore((s) => s.terminals);
  const projects = useAppStore((s) => s.projects);
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);

  // Get project path for each terminal
  function getProjectPath(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.path ?? "/";
  }

  if (terminals.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center h-full bg-[var(--bg-primary)]">
        <Terminal size={48} className="mb-3 text-[var(--text-secondary)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          Select a project and create a terminal to start
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-[var(--bg-primary)]">
      {terminals.map((t) => (
        <div
          key={t.id}
          className="absolute inset-0"
          style={{
            display: t.id === activeTerminalId ? "block" : "none",
          }}
        >
          <TerminalInstance
            terminalId={t.id}
            projectPath={getProjectPath(t.projectId)}
          />
        </div>
      ))}
    </main>
  );
}
