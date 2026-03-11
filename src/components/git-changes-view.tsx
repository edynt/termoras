import { useState, useEffect, useCallback } from "react";
import { RefreshCw, FileText, GitBranch, Upload, Check, Loader2, Undo2, Plus, Minus } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import {
  gitChangedFiles,
  gitFileDiff,
  gitStatusSummary,
  gitLastCommitMessage,
  gitStageAll,
  gitStageFiles,
  gitUnstageFiles,
  gitCommit,
  gitHasUnpushed,
  gitUndoCommit,
  gitPush,
  type GitChangedFile,
  type GitStatusSummary,
} from "../lib/tauri-commands";
import { GitDiffViewer } from "./git-diff-viewer";

export function GitChangesView() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === activeProjectId);

  const [files, setFiles] = useState<GitChangedFile[]>([]);
  const [status, setStatus] = useState<GitStatusSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [staging, setStaging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [hasUnpushed, setHasUnpushed] = useState(false);
  const [confirmPush, setConfirmPush] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [f, s, unpushed] = await Promise.all([
        gitChangedFiles(project.path),
        gitStatusSummary(project.path),
        gitHasUnpushed(project.path).catch(() => false),
      ]);
      setFiles(f);
      setStatus(s);
      setHasUnpushed(unpushed);
      // Notify sidebar to sync git badge count
      window.dispatchEvent(new CustomEvent("kodeck:git-changed", { detail: { path: project.path, status: s } }));
    } catch {
      setFiles([]);
      setStatus(null);
      setHasUnpushed(false);
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    refresh();
  }, [refresh]);



  /** Stage a single file */
  async function handleStageFile(filePath: string) {
    if (!project) return;
    setStaging(true);
    setActionError(null);
    try {
      await gitStageFiles(project.path, [filePath]);
      await refresh();
    } catch (e) {
      setActionError(`Stage failed: ${e}`);
    }
    setStaging(false);
  }

  /** Unstage a single file */
  async function handleUnstageFile(filePath: string) {
    if (!project) return;
    setStaging(true);
    setActionError(null);
    try {
      await gitUnstageFiles(project.path, [filePath]);
      await refresh();
    } catch (e) {
      setActionError(`Unstage failed: ${e}`);
    }
    setStaging(false);
  }

  /** Stage all unstaged files */
  async function handleStageAll() {
    if (!project) return;
    setStaging(true);
    setActionError(null);
    try {
      await gitStageAll(project.path);
      await refresh();
    } catch (e) {
      setActionError(`Stage failed: ${e}`);
    }
    setStaging(false);
  }

  /** Unstage all staged files */
  async function handleUnstageAll() {
    if (!project) return;
    const stagedPaths = files.filter((f) => f.staged).map((f) => f.path);
    if (stagedPaths.length === 0) return;
    setStaging(true);
    setActionError(null);
    try {
      await gitUnstageFiles(project.path, stagedPaths);
      await refresh();
    } catch (e) {
      setActionError(`Unstage failed: ${e}`);
    }
    setStaging(false);
  }

  async function handleCommit() {
    if (!project || !commitMsg.trim()) return;
    setCommitting(true);
    setActionError(null);
    try {
      await gitCommit(project.path, commitMsg.trim());
      setCommitMsg("");
      await refresh();
    } catch (e) {
      setActionError(`Commit failed: ${e}`);
    }
    setCommitting(false);
  }

  async function handlePush() {
    if (!project) return;
    setPushing(true);
    setActionError(null);
    try {
      await gitPush(project.path);
      await refresh();
    } catch (e) {
      setActionError(`Push failed: ${e}`);
    }
    setPushing(false);
  }

  async function handleUndoCommit() {
    if (!project) return;
    setUndoing(true);
    setActionError(null);
    try {
      await gitUndoCommit(project.path);
      gitLastCommitMessage(project.path)
        .then((msg) => { if (msg) setCommitMsg(msg); })
        .catch(() => {});
      await refresh();
    } catch (e) {
      setActionError(`Undo failed: ${e}`);
    }
    setUndoing(false);
  }

  // Load diff when a file is selected
  useEffect(() => {
    if (!project || !selectedFile) {
      setDiff("");
      return;
    }
    gitFileDiff(project.path, selectedFile.path, selectedFile.staged)
      .then(setDiff)
      .catch(() => setDiff(""));
  }, [project, selectedFile]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
        Select a project
      </div>
    );
  }

  // Group files by staged vs unstaged
  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  return (
    <div className="flex h-full">
      {/* File list sidebar */}
      <div className="w-[260px] shrink-0 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-sidebar)]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-1.5">
            <GitBranch size={14} className="text-[var(--accent-blue)]" />
            <span className="text-xs font-semibold">
              {status?.branch ?? "—"}
            </span>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 && !loading && (
            <div className="px-3 py-4 text-xs text-[var(--text-secondary)] text-center">
              No changes
            </div>
          )}

          {/* Staged section */}
          {stagedFiles.length > 0 && (
            <FileSection
              title="Staged"
              files={stagedFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              actionIcon="unstage"
              onFileAction={handleUnstageFile}
              onSectionAction={handleUnstageAll}
              sectionActionTitle="Unstage all"
              disabled={staging}
            />
          )}

          {/* Unstaged section */}
          {unstagedFiles.length > 0 && (
            <FileSection
              title="Changes"
              files={unstagedFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
              actionIcon="stage"
              onFileAction={handleStageFile}
              onSectionAction={handleStageAll}
              sectionActionTitle="Stage all"
              disabled={staging}
            />
          )}
        </div>

        {/* Summary footer */}
        {status && (
          <div className="px-3 py-1.5 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">
            {status.staged > 0 && <span className="text-[var(--accent-green)]">{status.staged} staged</span>}
            {status.staged > 0 && (status.modified > 0 || status.untracked > 0) && " · "}
            {status.modified > 0 && <span className="text-[var(--accent-blue)]">{status.modified} modified</span>}
            {status.modified > 0 && status.untracked > 0 && " · "}
            {status.untracked > 0 && <span className="text-[var(--text-secondary)]">{status.untracked} untracked</span>}
          </div>
        )}

        {/* Action bar */}
        <div className="border-t border-[var(--border-color)] p-2 space-y-1.5">
          {/* Error message */}
          {actionError && (
            <div className="text-[10px] text-[var(--accent-red)] bg-[var(--accent-red)]/10 rounded px-2 py-1 break-words">
              {actionError}
            </div>
          )}

          {/* Commit message input */}
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commitMsg.trim()) handleCommit();
            }}
            placeholder="Commit message..."
            className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
          />

          {/* Action buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={handleCommit}
              disabled={committing || !commitMsg.trim() || !status?.staged}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded transition-colors ${
                committing
                  ? "bg-[var(--accent-blue)]/25 text-[var(--accent-blue)] cursor-wait"
                  : "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
              title="Commit staged changes"
            >
              {committing ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              {committing ? "Committing..." : "Commit"}
            </button>
            <button
              onClick={() => setConfirmPush(true)}
              disabled={!hasUnpushed || pushing}
              className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded transition-colors ${
                pushing
                  ? "bg-[var(--accent-red)]/25 text-[var(--accent-red)] cursor-wait"
                  : "bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
              title="Push to remote"
            >
              {pushing ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
              {pushing ? "Pushing..." : "Push"}
            </button>
          </div>

          {/* Undo last commit — only show when there are unpushed commits */}
          {hasUnpushed && (
            <button
              onClick={handleUndoCommit}
              disabled={undoing}
              className="w-full flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] hover:bg-[var(--text-secondary)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Undo last commit (git reset --soft HEAD~1) — changes stay staged"
            >
              {undoing ? <Loader2 size={10} className="animate-spin" /> : <Undo2 size={10} />}
              Undo Last Commit
            </button>
          )}
        </div>
      </div>

      {/* Diff viewer */}
      <div className="flex-1 min-w-0 overflow-auto bg-[var(--bg-primary)]">
        {selectedFile ? (
          <GitDiffViewer diff={diff} filePath={selectedFile.path} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--text-secondary)]">
            Select a file to view changes
          </div>
        )}
      {/* Push confirmation modal */}
      {confirmPush && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmPush(false)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-4 w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-1">Push to Remote</p>
            <p className="text-xs text-[var(--text-secondary)] mb-1">
              Push commits on <span className="font-medium text-[var(--text-primary)]">{status?.branch}</span> to remote?
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]/60 mb-4">
              This action will make your changes visible to others.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPush(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmPush(false);
                  handlePush();
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent-red)] text-white hover:opacity-90 font-medium transition-opacity"
              >
                Push
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/** Section header + file list with per-file stage/unstage buttons */
function FileSection({
  title,
  files,
  selectedFile,
  onSelect,
  actionIcon,
  onFileAction,
  onSectionAction,
  sectionActionTitle,
  disabled,
}: {
  title: string;
  files: GitChangedFile[];
  selectedFile: { path: string; staged: boolean } | null;
  onSelect: (f: { path: string; staged: boolean }) => void;
  actionIcon: "stage" | "unstage";
  onFileAction: (filePath: string) => void;
  onSectionAction: () => void;
  sectionActionTitle: string;
  disabled: boolean;
}) {
  return (
    <div>
      {/* Section header with bulk action */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title} ({files.length})
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onSectionAction(); }}
          disabled={disabled}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
          title={sectionActionTitle}
        >
          {actionIcon === "stage" ? <Plus size={12} /> : <Minus size={12} />}
        </button>
      </div>

      {/* File rows */}
      {files.map((f) => {
        const isSelected = selectedFile?.path === f.path && selectedFile?.staged === f.staged;
        return (
          <div
            key={`${f.staged ? "s" : "u"}-${f.path}`}
            className={`group flex items-center gap-1 px-1.5 py-0.5 transition-colors ${
              isSelected
                ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {/* Stage/Unstage button for this file */}
            <button
              onClick={(e) => { e.stopPropagation(); onFileAction(f.path); }}
              disabled={disabled}
              className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40"
              title={actionIcon === "stage" ? `Stage ${f.path}` : `Unstage ${f.path}`}
            >
              {actionIcon === "stage" ? <Plus size={10} /> : <Minus size={10} />}
            </button>

            {/* File row — clickable to view diff */}
            <button
              onClick={() => onSelect({ path: f.path, staged: f.staged })}
              className="flex-1 flex items-center gap-1.5 py-0.5 text-left text-xs min-w-0"
            >
              <FileText size={12} className="shrink-0" />
              <span className="truncate flex-1">{f.path}</span>
              <StatusBadge status={f.status} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Small colored badge for file status */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    M: "text-[var(--accent-blue)]",
    A: "text-[var(--accent-green)]",
    D: "text-[var(--accent-red)]",
    R: "text-[var(--accent-blue)]",
    "?": "text-[var(--text-secondary)]",
  };

  return (
    <span className={`text-[10px] font-bold shrink-0 ${colors[status] ?? "text-[var(--text-secondary)]"}`}>
      {status}
    </span>
  );
}
