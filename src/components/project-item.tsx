import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import type { Project } from "../types";
import { useAppStore } from "../stores/app-store";
import { TerminalItem } from "./terminal-item";

interface Props {
  project: Project;
}

export function ProjectItem({ project }: Props) {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const terminals = useAppStore((s) => s.terminals);
  const projectTerminals = terminals.filter(
    (t) => t.projectId === project.id,
  );
  // Auto-expand if this is the active project and has terminals (e.g. on restore)
  const [expanded, setExpanded] = useState(
    activeProjectId === project.id && projectTerminals.length > 0,
  );
  const removeProject = useAppStore((s) => s.removeProject);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const addTerminal = useAppStore((s) => s.addTerminal);

  const runningCount = projectTerminals.filter((t) => t.isRunning).length;
  const isActive = activeProjectId === project.id;

  function handleClick() {
    setActiveProject(project.id);
    setExpanded(!expanded);
  }

  function handleNewTerminal(e: React.MouseEvent) {
    e.stopPropagation();
    setActiveProject(project.id);
    addTerminal({
      id: crypto.randomUUID(),
      projectId: project.id,
      name: `Terminal ${projectTerminals.length + 1}`,
      isRunning: false,
    });
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    removeProject(project.id);
  }

  return (
    <div>
      {/* project row */}
      <div
        onClick={handleClick}
        className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors duration-150 ${
          isActive
            ? "bg-[var(--bg-active)] border-l-3 border-l-[var(--accent-blue)]"
            : "hover:bg-[var(--bg-hover)] border-l-3 border-l-transparent"
        }`}
      >
        {expanded ? (
          <ChevronDown size={14} className="shrink-0" />
        ) : (
          <ChevronRight size={14} className="shrink-0" />
        )}
        <Folder size={14} className="shrink-0 text-[var(--accent-blue)]" />
        <span className="text-sm truncate flex-1">{project.name}</span>

        {/* running indicator */}
        {runningCount > 0 && (
          <Loader2
            size={14}
            className="shrink-0 animate-spin text-[var(--accent-blue)]"
          />
        )}

        {/* actions (show on hover) */}
        <button
          onClick={handleNewTerminal}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
          title="New terminal"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={handleRemove}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
          title="Remove project"
        >
          <X size={12} />
        </button>
      </div>

      {/* terminal list */}
      {expanded && (
        <div className="ml-5">
          {projectTerminals.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] px-2 py-1">
              No terminals
            </p>
          ) : (
            projectTerminals.map((t) => (
              <TerminalItem key={t.id} terminal={t} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
