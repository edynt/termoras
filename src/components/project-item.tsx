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
  MessageCircleQuestion,
} from "lucide-react";
import type { Project } from "../types";
import { useAppStore } from "../stores/app-store";
import { isGitRepo, gitStatusSummary, openInVscode, type GitStatusSummary } from "../lib/tauri-commands";
import { TerminalItem } from "./terminal-item";

/** Outline color presets for folder icons */
const FOLDER_COLORS = [
  { value: undefined, label: "Default" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#06b6d4", label: "Teal" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
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

  // Check if any terminal in this project is waiting for user input
  const terminalQuestioning = useAppStore((s) => s.terminalQuestioning);
  const hasQuestioningTerminal = projectTerminals.some(
    (t) => terminalQuestioning[t.id],
  );

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
      name: projectTerminals.length === 0 ? "Terminal" : `Terminal ${projectTerminals.length + 1}`,
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
          className={`group flex items-center gap-1.5 mx-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors duration-150 ${
            isActive
              ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
              : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          } ${isDragOver ? "ring-1 ring-[var(--accent-blue)]" : ""} ${isDragging ? "opacity-40" : ""}`}
        >
          {/* Drag handle — pointer-based */}
          <span title="Drag to reorder" onPointerDown={(e) => { e.stopPropagation(); onGripPointerDown(); }}>
            <GripVertical
              size={14}
              className="shrink-0 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing transition-opacity"
            />
          </span>
          <span className="shrink-0 text-[var(--text-tertiary)] transition-transform duration-150">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Folder size={14} className="shrink-0" color={project.color || "var(--accent-blue)"} />
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
              className="flex-1 text-sm bg-[var(--bg-primary)] rounded-md px-1.5 py-0.5 border border-[var(--accent-blue)] outline-none min-w-0"
              autoFocus
            />
          ) : (
            <span className="text-sm truncate flex-1" title={project.path}>{project.name}</span>
          )}

          {/* Needs Input indicator */}
          {hasQuestioningTerminal && (
            <span className="shrink-0 text-[var(--accent-amber)] animate-pulse" title="A terminal needs input">
              <MessageCircleQuestion size={14} />
            </span>
          )}

          {/* quick actions (show on hover) */}
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenBoard(); }}
            className="shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
            title="Open board"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNewTerminal(); }}
            className="shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
            title="New terminal"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* expanded items: board tab + terminal list */}
        {expanded && (
          <div className="ml-10 mr-1">
            {/* Board tab */}
            <div
              data-onboarding="board-tab"
              onClick={() => handleOpenBoard()}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors duration-150 ${
                isBoardActive
                  ? "bg-[var(--accent-blue)]/8 text-[var(--accent-blue)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayoutGrid size={14} className="shrink-0" />
              <span className="text-sm truncate flex-1">Board</span>
            </div>

            {/* Git Changes tab — only if git repo */}
            {hasGit && (
              <div
                data-onboarding="changes-tab"
                onClick={() => handleOpenGitView()}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors duration-150 ${
                  isGitViewActive
                    ? "bg-[var(--accent-blue)]/8 text-[var(--accent-blue)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <GitBranch size={14} className="shrink-0" />
                <span className="text-sm truncate flex-1">Changes</span>
                {gitStatus && (gitStatus.modified + gitStatus.untracked + gitStatus.staged) > 0 && (
                  <span className="text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]">
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
          className="fixed z-50 min-w-[180px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y, boxShadow: "var(--shadow-lg)" }}
        >
          <button
            onClick={() => { setCtxMenu(null); handleOpenBoard(); }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            <LayoutGrid size={14} className="text-[var(--text-secondary)]" />
            Create Board
          </button>
          <button
            onClick={() => { setCtxMenu(null); handleNewTerminal(); }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            <Terminal size={14} className="text-[var(--text-secondary)]" />
            Create Terminal
          </button>
          <button
            onClick={() => { setCtxMenu(null); openInVscode(project.path); }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            <Code2 size={14} className="text-[var(--text-secondary)]" />
            Open in VS Code
          </button>
          <button
            onClick={() => { setCtxMenu(null); setRenameName(project.name); setRenaming(true); }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            <Pencil size={14} className="text-[var(--text-secondary)]" />
            Rename
          </button>
          <div className="my-1 border-t border-[var(--border-color)]" />
          {/* Folder color picker */}
          <div className="px-3 py-1.5">
            <span className="text-xs text-[var(--text-tertiary)] mb-1.5 block uppercase tracking-wider">Color</span>
            <div className="flex items-center gap-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectColor(project.id, c.value);
                    setCtxMenu(null);
                  }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                    (project.color || undefined) === c.value ? "scale-110 ring-2 ring-offset-1 ring-[var(--accent-blue)]" : ""
                  }`}
                  style={{
                    borderColor: c.value || "var(--text-tertiary)",
                    background: "transparent",
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-[var(--border-color)]" />
          <button
            onClick={() => { setCtxMenu(null); setConfirmDelete(true); }}
            className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--accent-red)]/8 text-[var(--accent-red)] transition-colors"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-6 w-[380px]"
            style={{ boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Delete Project</p>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {project.name}
              </span>
              ? All terminals in this project will be killed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  removeProject(project.id);
                }}
                className="text-sm px-4 py-2 rounded-lg bg-[var(--accent-red)] text-white hover:opacity-90 transition-opacity"
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
