import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  LayoutGrid,
  Terminal,
  Trash2,
  GitBranch,
  Code2,
  Pencil,
  GripVertical,
} from "lucide-react";
import type { Project } from "../types";
import { useAppStore } from "../stores/app-store";
import { isGitRepo, gitStatusSummary, openInVscode, type GitStatusSummary } from "../lib/tauri-commands";
import { TerminalItem } from "./terminal-item";

/** Outline color presets for folder icons */
const FOLDER_COLORS = [
  { value: undefined, label: "Default" },
  { value: "#e94e4e", label: "Red" },
  { value: "#e88a3e", label: "Orange" },
  { value: "#d4b035", label: "Yellow" },
  { value: "#1aad8a", label: "Green" },
  { value: "#3ab5c2", label: "Teal" },
  { value: "#4a8ff5", label: "Blue" },
  { value: "#9b6fef", label: "Purple" },
  { value: "#e06aa0", label: "Pink" },
];

interface Props {
  project: Project;
  index: number;
  isDragOver: boolean;
  isDragging: boolean;
  onGripPointerDown: () => void;
}

export function ProjectItem({ project, index, isDragOver, isDragging, onGripPointerDown }: Props) {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const terminals = useAppStore((s) => s.terminals);
  const projectTerminals = terminals.filter(
    (t) => t.projectId === project.id,
  );
  const [expanded, setExpanded] = useState(
    activeProjectId === project.id,
  );
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(project.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const removeProject = useAppStore((s) => s.removeProject);
  const renameProject = useAppStore((s) => s.renameProject);
  const setProjectColor = useAppStore((s) => s.setProjectColor);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const addTerminal = useAppStore((s) => s.addTerminal);
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const isActive = activeProjectId === project.id;
  const isBoardActive = isActive && activeView === "kanban";
  const isGitViewActive = isActive && activeView === "git";

  const [hasGit, setHasGit] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);

  // Check git on mount
  useEffect(() => {
    isGitRepo(project.path).then((result) => {
      setHasGit(result);
      if (result) {
        gitStatusSummary(project.path).then(setGitStatus).catch(() => {});
      }
    }).catch(() => {});
  }, [project.path]);

  // Refresh git status when project becomes active
  useEffect(() => {
    if (hasGit && isActive) {
      gitStatusSummary(project.path).then(setGitStatus).catch(() => {});
    }
  }, [hasGit, isActive, project.path]);

  // Sync git status when Changes page refreshes (commit, stage, push, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path === project.path && detail?.status) {
        setGitStatus(detail.status);
      }
    };
    window.addEventListener("termoras:git-changed", handler);
    return () => window.removeEventListener("termoras:git-changed", handler);
  }, [project.path]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  function handleClick() {
    setActiveProject(project.id);
    setExpanded(!expanded);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function handleNewTerminal() {
    setActiveProject(project.id);
    addTerminal({
      id: crypto.randomUUID(),
      projectId: project.id,
      name: `Terminal ${projectTerminals.length + 1}`,
      isRunning: false,
    });
    setExpanded(true);
  }

  function handleOpenBoard() {
    setActiveProject(project.id);
    setActiveView("kanban");
  }

  function handleOpenGitView() {
    setActiveProject(project.id);
    setActiveView("git");
  }

  return (
    <>
      <div data-project-index={index}>
        {/* project row */}
        <div
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all duration-150 ${
            isActive
              ? "bg-[var(--bg-active)] border-l-3 glow-active"
              : "hover:bg-[var(--bg-hover)] border-l-3 border-l-transparent"
          } ${isDragOver ? "border-t-2 border-t-[var(--accent-blue)]" : "border-t-2 border-t-transparent"} ${isDragging ? "opacity-40" : ""}`}
          style={isActive ? { borderLeftColor: project.color || "var(--accent-blue)" } : undefined}
        >
          {/* Drag handle — pointer-based */}
          <span title="Drag to reorder" onPointerDown={(e) => { e.stopPropagation(); onGripPointerDown(); }}>
            <GripVertical
              size={16}
              className="shrink-0 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing transition-opacity"
            />
          </span>
          {expanded ? (
            <ChevronDown size={16} className="shrink-0" />
          ) : (
            <ChevronRight size={16} className="shrink-0" />
          )}
          <Folder size={16} className="shrink-0" color={project.color || "var(--accent-blue)"} />
          {renaming ? (
            <input
              ref={renameRef}
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onBlur={() => {
                const trimmed = renameName.trim();
                if (trimmed && trimmed !== project.name) renameProject(project.id, trimmed);
                else setRenameName(project.name);
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setRenameName(project.name); setRenaming(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm bg-[var(--bg-hover)] rounded px-1 py-0 border border-[var(--accent-blue)] outline-none min-w-0"
              autoFocus
            />
          ) : (
            <span className="text-sm truncate flex-1" title={project.path}>{project.name}</span>
          )}

          {/* git indicator */}
          {hasGit && (
            <span
              className="shrink-0 text-xs font-bold text-[var(--accent-red)] opacity-70"
              title={gitStatus ? `${gitStatus.branch} — ${gitStatus.modified + gitStatus.untracked} changed` : "git"}
            >
              git
            </span>
          )}

          {/* git changes count */}
          {gitStatus && (gitStatus.modified + gitStatus.untracked + gitStatus.staged) > 0 && (
            <span
              className="shrink-0 text-xs font-medium px-1 py-0.5 rounded-full bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
              title={`${gitStatus.staged} staged, ${gitStatus.modified} modified, ${gitStatus.untracked} untracked`}
            >
              {gitStatus.modified + gitStatus.untracked + gitStatus.staged}
            </span>
          )}

          {/* quick actions (show on hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenBoard();
            }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
            title="Open board"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewTerminal();
            }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
            title="New terminal"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* expanded items: board tab + terminal list */}
        {expanded && (
          <div className="ml-13">
            {/* Board tab */}
            <div
              onClick={() => handleOpenBoard()}
              className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-all duration-150 ${
                isBoardActive
                  ? "text-[var(--accent-blue)] glow-active bg-[var(--accent-blue)]/8"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <LayoutGrid size={16} className="shrink-0" />
              <span className="text-sm truncate flex-1">Board</span>
            </div>

            {/* Git Changes tab — only if git repo */}
            {hasGit && (
              <div
                onClick={() => handleOpenGitView()}
                className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-all duration-150 ${
                  isGitViewActive
                    ? "text-[var(--accent-blue)] glow-active bg-[var(--accent-blue)]/8"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <GitBranch size={16} className="shrink-0" />
                <span className="text-sm truncate flex-1">Changes</span>
                {gitStatus && (gitStatus.modified + gitStatus.untracked + gitStatus.staged) > 0 && (
                  <span className="text-xs font-medium px-1 rounded-full bg-[var(--accent-red)]/15 text-[var(--accent-red)]">
                    {gitStatus.modified + gitStatus.untracked + gitStatus.staged}
                  </span>
                )}
              </div>
            )}

            {/* Terminal items */}
            {projectTerminals.map((t) => (
              <TerminalItem key={t.id} terminal={t} />
            ))}
          </div>
        )}
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-lg py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => {
              setCtxMenu(null);
              handleOpenBoard();
            }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <LayoutGrid size={16} />
            Create Board
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              handleNewTerminal();
            }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <Terminal size={16} />
            Create Terminal
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              openInVscode(project.path);
            }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <Code2 size={16} />
            Open in VS Code
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              setRenameName(project.name);
              setRenaming(true);
            }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <Pencil size={16} />
            Rename
          </button>
          <div className="my-1 border-t border-[var(--border-color)]" />
          {/* Folder color picker */}
          <div className="px-3 py-1.5">
            <span className="text-sm text-[var(--text-secondary)] mb-1 block">Folder Color</span>
            <div className="flex items-center gap-1">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectColor(project.id, c.value);
                    setCtxMenu(null);
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-125 ${
                    (project.color || undefined) === c.value ? "scale-125 ring-1 ring-offset-1 ring-[var(--accent-blue)]" : ""
                  }`}
                  style={{
                    borderColor: c.value || "var(--text-secondary)",
                    background: "transparent",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-[var(--border-color)]" />
          <button
            onClick={() => {
              setCtxMenu(null);
              setConfirmDelete(true);
            }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--accent-red)]"
          >
            <Trash2 size={16} />
            Delete Project
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Delete Project</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {project.name}
              </span>
              ? All terminals in this project will be killed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  removeProject(project.id);
                }}
                className="text-sm px-4 py-2 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
