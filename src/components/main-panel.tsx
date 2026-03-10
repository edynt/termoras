import { useAppStore } from "../stores/app-store";
import { TerminalPanel } from "./terminal-panel";
import { KanbanBoard } from "./kanban-board";

export function MainPanel() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <>
      {/* Terminal panel always rendered to keep PTY alive */}
      <div
        style={{ display: activeView === "terminal" ? "block" : "none" }}
        className="h-full"
      >
        <TerminalPanel />
      </div>
      {/* Kanban board */}
      {activeView === "kanban" && <KanbanBoard />}
    </>
  );
}
