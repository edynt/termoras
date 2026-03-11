import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Loader2,
  LayoutGrid,
  Terminal,
  Trash2,
  GitBranch,
} from "lucide-react";
import type { Project } from "../types";
import { useAppStore } from "../stores/app-store";
import { isGitRepo, gitStatusSummary, type GitStatusSummary } from "../lib/tauri-commands";
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
  const [expanded, setExpanded] = useState(
    activeProjectId === project.id,
  );
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeProject = useAppStore((s) => s.removeProject);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const addTerminal = useAppStore((s) => s.addTerminal);
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const runningCount = projectTerminals.filter((t) => t.isRunning).length;
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
      <div>
        {/* project row */}
        <div
          onClick={handleClick}
          onContextMenu={handleContextMenu}
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
          <span className="text-sm truncate flex-1" title={project.path}>{project.name}</span>

          {/* git indicator */}
          {hasGit && (
            <span
              className="shrink-0 text-[9px] font-bold text-[var(--accent-red)] opacity-70"
              title={gitStatus ? `${gitStatus.branch} — ${gitStatus.modified + gitStatus.untracked} changed` : "git"}
            >
              git
            </span>
          )}

          {/* git changes count */}
          {gitStatus && (gitStatus.modified + gitStatus.untracked + gitStatus.staged) > 0 && (
            <span
              className="shrink-0 text-[9px] font-medium px-1 py-0.5 rounded-full bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
              title={`${gitStatus.staged} staged, ${gitStatus.modified} modified, ${gitStatus.untracked} untracked`}
            >
              {gitStatus.modified + gitStatus.untracked + gitStatus.staged}
            </span>
          )}

          {/* running indicator */}
          {runningCount > 0 && (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-[var(--accent-blue)]"
            />
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
            <LayoutGrid size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewTerminal();
            }}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
            title="New terminal"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* expanded items: board tab + terminal list */}
        {expanded && (
          <div className="ml-5">
            {/* Board tab */}
            <div
              onClick={() => handleOpenBoard()}
              className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors duration-150 ${
                isBoardActive
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <LayoutGrid size={12} className="shrink-0" />
              <span className="text-xs truncate flex-1">Board</span>
            </div>

            {/* Git Changes tab — only if git repo */}
            {hasGit && (
              <div
                onClick={() => handleOpenGitView()}
                className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors duration-150 ${
                  isGitViewActive
                    ? "text-[var(--accent-blue)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <GitBranch size={12} className="shrink-0" />
                <span className="text-xs truncate flex-1">Changes</span>
                {gitStatus && (gitStatus.modified + gitStatus.untracked + gitStatus.staged) > 0 && (
                  <span className="text-[9px] font-medium px-1 rounded-full bg-[var(--accent-red)]/15 text-[var(--accent-red)]">
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
            className="w-full flex items-center gap-2 text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <LayoutGrid size={12} />
            Create Board
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              handleNewTerminal();
            }}
            className="w-full flex items-center gap-2 text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            <Terminal size={12} />
            Create Terminal
          </button>
          <div className="my-1 border-t border-[var(--border-color)]" />
          <button
            onClick={() => {
              setCtxMenu(null);
              setConfirmDelete(true);
            }}
            className="w-full flex items-center gap-2 text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--accent-red)]"
          >
            <Trash2 size={12} />
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
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-4 w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-1">Delete Project</p>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {project.name}
              </span>
              ? All terminals in this project will be killed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  removeProject(project.id);
                }}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
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
