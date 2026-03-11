import { useState, useEffect, useCallback } from "react";
import { RefreshCw, FileText, GitBranch, Upload, Check, Loader2, Undo2 } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import {
  gitChangedFiles,
  gitFileDiff,
  gitStatusSummary,
  gitLastCommitMessage,
  gitStageAll,
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

  // Auto-fill commit message with latest commit on mount
  useEffect(() => {
    if (!project) return;
    gitLastCommitMessage(project.path)
      .then((msg) => {
        if (msg) setCommitMsg(msg);
      })
      .catch(() => {});
  }, [project?.path]);

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
      // Re-fill commit message with the undone commit's message (now it's the previous one)
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

          {stagedFiles.length > 0 && (
            <FileSection
              title="Staged"
              files={stagedFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
            />
          )}

          {unstagedFiles.length > 0 && (
            <FileSection
              title="Changes"
              files={unstagedFiles}
              selectedFile={selectedFile}
              onSelect={setSelectedFile}
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
              onClick={handleStageAll}
              disabled={staging || files.length === 0}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded bg-[var(--accent-green)]/15 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Stage all changes (git add -A)"
            >
              {staging ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Stage All
            </button>
            <button
              onClick={handleCommit}
              disabled={committing || !commitMsg.trim() || !status?.staged}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Commit staged changes"
            >
              {committing ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Commit
            </button>
            <button
              onClick={handlePush}
              disabled={pushing}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Push to remote"
            >
              {pushing ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
              Push
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
      </div>
    </div>
  );
}

/** Section header + file list group */
function FileSection({
  title,
  files,
  selectedFile,
  onSelect,
}: {
  title: string;
  files: GitChangedFile[];
  selectedFile: { path: string; staged: boolean } | null;
  onSelect: (f: { path: string; staged: boolean }) => void;
}) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        {title} ({files.length})
      </div>
      {files.map((f) => {
        const isSelected = selectedFile?.path === f.path && selectedFile?.staged === f.staged;
        return (
          <button
            key={`${f.staged ? "s" : "u"}-${f.path}`}
            onClick={() => onSelect({ path: f.path, staged: f.staged })}
            className={`w-full flex items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors ${
              isSelected
                ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <FileText size={12} className="shrink-0" />
            <span className="truncate flex-1">{f.path}</span>
            <StatusBadge status={f.status} />
          </button>
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
