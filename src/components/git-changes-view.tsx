import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, GitBranch, GitMerge, Upload, Check, Loader2, Undo2, Plus, Minus, X, ChevronDown, AlertTriangle, ExternalLink, Download, Package } from "lucide-react";
import { FileIcon } from "./file-icon";
import { useAppStore } from "../stores/app-store";
import {
  gitChangedFiles,
  gitFileDiff,
  readFileContent,
  gitStatusSummary,
  gitStageAll,
  gitStageFiles,
  gitUnstageFiles,
  gitCommit,
  gitHasUnpushed,
  gitUndoCommit,
  gitRevertFile,
  gitPush,
  gitListBranches,
  gitMerge,
  gitMergeAbort,
  gitCheckoutBranch,
  gitFetch,
  gitStashList,
  gitStashSave,
  openInVscode,
  startFileWatcher,
  stopFileWatcher,
  type GitChangedFile,
  type GitStatusSummary,
  type BranchInfo,
  type MergeResult,
  type StashEntry,
} from "../lib/tauri-commands";
import { listen } from "@tauri-apps/api/event";
import { GitDiffViewer } from "./git-diff-viewer";
import { GitStashSection } from "./git-stash-section";

const MIN_PANEL = 200;
const MAX_PANEL = 500;
const DEFAULT_PANEL = 260;
const PANEL_STORAGE_KEY = "termoras-git-panel-width";

export function GitChangesView() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projects = useAppStore((s) => s.projects);
  const project = projects.find((p) => p.id === activeProjectId);

  const [files, setFiles] = useState<GitChangedFile[]>([]);
  const [status, setStatus] = useState<GitStatusSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean; status?: string } | null>(null);
  const [diff, setDiff] = useState<string>("");
  /** True when viewing a new/untracked file (raw content, not diff) */
  const [isNewFile, setIsNewFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [staging, setStaging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [hasUnpushed, setHasUnpushed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<
    | { type: "file"; path: string; status: string; staged: boolean }
    | { type: "all"; files: GitChangedFile[] }
    | null
  >(null);

  // Stash state
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [stashMsg, setStashMsg] = useState("");
  const [showStashInput, setShowStashInput] = useState(false);
  const [stashing, setStashing] = useState(false);
  /** When viewing a stash diff (not a file diff) */
  const [stashDiffPreview, setStashDiffPreview] = useState<string | null>(null);

  // Merge state
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [confirmMergeBranch, setConfirmMergeBranch] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [mergeConflicts, setMergeConflicts] = useState<string[]>([]);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [branchPickerFilter, setBranchPickerFilter] = useState("");
  const branchPickerRef = useRef<HTMLDivElement>(null);

  // Resizable panel
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY);
    return stored ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, Number(stored))) : DEFAULT_PANEL;
  });
  const draggingPanel = useRef(false);

  const handlePanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingPanel.current = true;
    const containerLeft = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().left;
    const onMove = (ev: MouseEvent) => {
      if (!draggingPanel.current) return;
      const w = Math.min(MAX_PANEL, Math.max(MIN_PANEL, ev.clientX - containerLeft));
      setPanelWidth(w);
    };
    const onUp = () => {
      draggingPanel.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setPanelWidth((w) => {
        localStorage.setItem(PANEL_STORAGE_KEY, String(w));
        return w;
      });
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Load branches when project changes
  const loadBranches = useCallback(async () => {
    if (!project) return;
    try {
      const b = await gitListBranches(project.path);
      setBranches(b);
    } catch {
      setBranches([]);
    }
  }, [project]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Close branch picker on outside click
  useEffect(() => {
    if (!showBranchPicker) return;
    function handleClick(e: MouseEvent) {
      if (branchPickerRef.current && !branchPickerRef.current.contains(e.target as Node)) {
        setShowBranchPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBranchPicker]);

  const refresh = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [f, s, unpushed, stashList] = await Promise.all([
        gitChangedFiles(project.path),
        gitStatusSummary(project.path),
        gitHasUnpushed(project.path).catch(() => false),
        gitStashList(project.path).catch(() => [] as StashEntry[]),
      ]);
      setFiles(f);
      setStatus(s);
      setHasUnpushed(unpushed);
      setStashes(stashList);
      // Notify sidebar to sync git badge count
      window.dispatchEvent(new CustomEvent("termoras:git-changed", { detail: { path: project.path, status: s } }));
    } catch {
      setFiles([]);
      setStatus(null);
      setHasUnpushed(false);
      setStashes([]);
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // File watcher: start watching project dir, auto-refresh on fs changes
  useEffect(() => {
    if (!project) return;
    const projectPath = project.path;

    // Start the native file watcher
    startFileWatcher(projectPath).catch(() => {});

    // Listen for fs-changed events from the Rust backend (debounced further)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen<string>("fs-changed", (event) => {
      if (event.payload !== projectPath) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refresh(), 500);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unlisten.then((fn) => fn());
      stopFileWatcher(projectPath).catch(() => {});
    };
  }, [project?.path, refresh]);

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

  /** Commit staged files; auto-stage all only when nothing is staged */
  async function handleCommit() {
    if (!project || !commitMsg.trim() || files.length === 0) return;
    setCommitting(true);
    setActionError(null);
    try {
      // Only auto-stage all if user hasn't manually staged anything
      const hasStagedFiles = files.some((f) => f.staged);
      if (!hasStagedFiles) {
        await gitStageAll(project.path);
      }
      await gitCommit(project.path, commitMsg.trim());
      setCommitMsg("");
      await refresh();
      setSuccessMsg("Committed!");
      setTimeout(() => setSuccessMsg(null), 3000);
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
      setSelectedFile(null);
      setDiff("");
      await refresh();
      setSuccessMsg("Pushed successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
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
      await refresh();
    } catch (e) {
      setActionError(`Undo failed: ${e}`);
    }
    setUndoing(false);
  }

  /** Revert (discard) a single file's changes */
  async function handleRevertFile(filePath: string, status: string) {
    if (!project) return;
    setActionError(null);
    try {
      const msg = await gitRevertFile(project.path, filePath, status);
      if (selectedFile?.path === filePath) setSelectedFile(null);
      await refresh();
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setActionError(`Revert failed: ${e}`);
    }
    setConfirmRevert(null);
  }

  /** Revert (discard) all files in a list */
  async function handleRevertAll(filesToRevert: GitChangedFile[]) {
    if (!project || filesToRevert.length === 0) return;
    setActionError(null);
    try {
      let errors = 0;
      for (const f of filesToRevert) {
        try {
          await gitRevertFile(project.path, f.path, f.status);
        } catch {
          errors++;
        }
      }
      setSelectedFile(null);
      await refresh();
      if (errors > 0) {
        setActionError(`Reverted with ${errors} error(s)`);
      } else {
        setSuccessMsg(`Reverted ${filesToRevert.length} file(s)`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      setActionError(`Revert failed: ${e}`);
    }
    setConfirmRevert(null);
  }

  /** Fetch from remote and refresh branch list */
  async function handleCheckoutBranch(branchName: string) {
    if (!project) return;
    setCheckingOut(true);
    setActionError(null);
    try {
      const msg = await gitCheckoutBranch(project.path, branchName);
      setShowBranchPicker(false);
      setBranchPickerFilter("");
      await loadBranches();
      await refresh();
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setActionError(`${e}`);
    }
    setCheckingOut(false);
  }

  async function handleFetch() {
    if (!project) return;
    setFetching(true);
    setActionError(null);
    try {
      await gitFetch(project.path);
      await loadBranches();
      await refresh();
      setSuccessMsg("Fetched from remote");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setActionError(`Fetch failed: ${e}`);
    }
    setFetching(false);
  }

  /** Merge confirmed branch into current */
  async function handleMerge() {
    if (!project || !confirmMergeBranch) return;
    const branchName = confirmMergeBranch;
    setConfirmMergeBranch(null);
    setMerging(true);
    setActionError(null);
    setMergeConflicts([]);
    try {
      const result: MergeResult = await gitMerge(project.path, branchName);
      if (result.success) {
        setShowMergePanel(false);
        await refresh();
        await loadBranches();
        setSuccessMsg(`Merged ${branchName}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        // Merge conflicts
        setMergeConflicts(result.conflicts);
        setActionError(result.message);
        await refresh();
      }
    } catch (e) {
      setActionError(`Merge failed: ${e}`);
    }
    setMerging(false);
  }

  /** Abort in-progress merge */
  async function handleMergeAbort() {
    if (!project) return;
    setActionError(null);
    try {
      await gitMergeAbort(project.path);
      setMergeConflicts([]);
      await refresh();
      setSuccessMsg("Merge aborted");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setActionError(`Abort failed: ${e}`);
    }
  }

  /** Stash all changes with a custom message */
  async function handleStashSave() {
    if (!project || !stashMsg.trim()) return;
    setStashing(true);
    setActionError(null);
    try {
      await gitStashSave(project.path, stashMsg.trim());
      setStashMsg("");
      setShowStashInput(false);
      await refresh();
      setSuccessMsg("Stashed changes!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setActionError(`Stash failed: ${e}`);
    }
    setStashing(false);
  }

  /** Open project in VSCode for conflict resolution */
  async function handleOpenVscode() {
    if (!project) return;
    try {
      await openInVscode(project.path);
    } catch (e) {
      setActionError(`Failed to open VS Code: ${e}`);
    }
  }

  // Load diff (or raw content for new files) when a file is selected
  useEffect(() => {
    if (!project || !selectedFile) {
      setDiff("");
      setIsNewFile(false);
      return;
    }
    // New/untracked files have no diff — load raw content instead
    const isUntracked = selectedFile.status === "?" || (selectedFile.status === "A" && !selectedFile.staged);
    if (isUntracked) {
      setIsNewFile(true);
      readFileContent(project.path, selectedFile.path)
        .then(setDiff)
        .catch(() => setDiff(""));
    } else {
      setIsNewFile(false);
      gitFileDiff(project.path, selectedFile.path, selectedFile.staged)
        .then(setDiff)
        .catch(() => setDiff(""));
    }
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
    <div className="flex h-full relative">
      {/* File list sidebar */}
      <div className="shrink-0 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-sidebar)]" style={{ width: panelWidth }}>
        {/* Header — branch picker + actions */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
          <div ref={branchPickerRef} className="relative flex items-center gap-2 min-w-0">
            <button
              onClick={() => { setShowBranchPicker(!showBranchPicker); setBranchPickerFilter(""); }}
              disabled={checkingOut}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--accent-blue)]/10 min-w-0 hover:bg-[var(--accent-blue)]/20 transition-colors cursor-pointer"
              title="Switch branch"
            >
              <GitBranch size={16} className={`shrink-0 text-[var(--accent-blue)] ${checkingOut ? "animate-pulse" : ""}`} />
              <span className="text-sm font-semibold text-[var(--accent-blue)] truncate">
                {status?.branch ?? "—"}
              </span>
              <ChevronDown size={12} className={`shrink-0 text-[var(--accent-blue)] transition-transform ${showBranchPicker ? "rotate-180" : ""}`} />
            </button>

            {/* Branch picker dropdown */}
            {showBranchPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 w-[260px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl overflow-hidden">
                <div className="px-2 py-1.5">
                  <input
                    type="text"
                    value={branchPickerFilter}
                    onChange={(e) => setBranchPickerFilter(e.target.value)}
                    placeholder="Switch to branch..."
                    autoFocus
                    className="w-full text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  {(() => {
                    const filtered = branches
                      .filter((b) => !b.is_current)
                      .filter((b) => !branchPickerFilter || b.name.toLowerCase().includes(branchPickerFilter.toLowerCase()));
                    if (filtered.length === 0) {
                      return (
                        <div className="px-3 py-3 text-sm text-[var(--text-secondary)] text-center">
                          {branchPickerFilter ? "No matching branches" : "No other branches"}
                        </div>
                      );
                    }
                    return filtered.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => handleCheckoutBranch(b.name)}
                        disabled={checkingOut}
                        className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                      >
                        <GitBranch size={12} className={`shrink-0 ${b.is_remote ? "text-[var(--accent-red)]" : "text-[var(--text-secondary)]"}`} />
                        <span className="truncate flex-1">{b.name}</span>
                        {b.is_remote && (
                          <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-[var(--accent-red)]/10 text-[var(--accent-red)]">remote</span>
                        )}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="shrink-0 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              title="Fetch from remote"
            >
              <Download size={16} className={fetching ? "animate-pulse" : ""} />
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="shrink-0 p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Merge toggle + conflict banner */}
        <div className="border-b border-[var(--border-color)]">
          {/* Merge panel toggle */}
          <button
            onClick={() => { setShowMergePanel(!showMergePanel); setBranchFilter(""); }}
            className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              showMergePanel
                ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/5"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <GitMerge size={14} />
            Merge
            {merging && <Loader2 size={12} className="animate-spin ml-auto" />}
            <ChevronDown size={14} className={`ml-auto transition-transform ${showMergePanel ? "rotate-180" : ""}`} />
          </button>

          {/* Branch list panel */}
          {showMergePanel && (
            <div className="border-t border-[var(--border-color)]">
              {/* Search filter */}
              <div className="px-2 py-1.5">
                <input
                  type="text"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  placeholder="Search branches..."
                  className="w-full text-sm px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>

              {/* Branch list */}
              <div className="max-h-[200px] overflow-y-auto">
                {(() => {
                  const filtered = branches
                    .filter((b) => !b.is_current)
                    .filter((b) => !branchFilter || b.name.toLowerCase().includes(branchFilter.toLowerCase()));
                  if (filtered.length === 0) {
                    return (
                      <div className="px-3 py-3 text-sm text-[var(--text-secondary)] text-center">
                        {branchFilter ? "No matching branches" : "No other branches"}
                      </div>
                    );
                  }
                  return filtered.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => setConfirmMergeBranch(b.name)}
                      disabled={merging}
                      className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                    >
                      <GitBranch size={12} className={`shrink-0 ${b.is_remote ? "text-[var(--accent-red)]" : "text-[var(--text-secondary)]"}`} />
                      <span className="truncate flex-1">{b.name}</span>
                      {b.is_remote && (
                        <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-[var(--accent-red)]/10 text-[var(--accent-red)]">remote</span>
                      )}
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Merge conflict banner — always visible when conflicts exist */}
          {mergeConflicts.length > 0 && (
            <div className="border-t border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5 p-2 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-red)]">
                <AlertTriangle size={14} />
                Merge conflicts in {mergeConflicts.length} file{mergeConflicts.length > 1 ? "s" : ""}
              </div>
              <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                {mergeConflicts.map((f) => (
                  <div key={f} className="text-xs text-[var(--text-secondary)] font-mono truncate pl-1">
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenVscode}
                  className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25 transition-colors"
                >
                  <ExternalLink size={12} />
                  Open in VSCode
                </button>
                <button
                  onClick={handleMergeAbort}
                  className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25 transition-colors"
                >
                  <X size={12} />
                  Abort Merge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 && !loading && (
            <div className="px-3 py-4 text-sm text-[var(--text-secondary)] text-center">
              No changes
            </div>
          )}

          {/* Staged section */}
          {stagedFiles.length > 0 && (
            <FileSection
              title="Staged"
              files={stagedFiles}
              selectedFile={selectedFile}
              onSelect={(f) => { setSelectedFile(f); setStashDiffPreview(null); }}
              actionIcon="unstage"
              onFileAction={handleUnstageFile}
              onSectionAction={handleUnstageAll}
              sectionActionTitle="Unstage all"
              disabled={staging}
              onRevertFile={(f) => setConfirmRevert({ type: "file", ...f })}
              onRevertAll={() => setConfirmRevert({ type: "all", files: stagedFiles })}
            />
          )}

          {/* Unstaged section */}
          {unstagedFiles.length > 0 && (
            <FileSection
              title="Changes"
              files={unstagedFiles}
              selectedFile={selectedFile}
              onSelect={(f) => { setSelectedFile(f); setStashDiffPreview(null); }}
              actionIcon="stage"
              onFileAction={handleStageFile}
              onSectionAction={handleStageAll}
              sectionActionTitle="Stage all"
              disabled={staging}
              onRevertFile={(f) => setConfirmRevert({ type: "file", ...f })}
              onRevertAll={() => setConfirmRevert({ type: "all", files: unstagedFiles })}
            />
          )}

        </div>

        {/* Stash section — pinned to footer */}
        {stashes.length > 0 && (
          <div className="border-t border-[var(--border-color)] max-h-[150px] overflow-y-auto">
            <GitStashSection
              stashes={stashes}
              projectPath={project.path}
              onRefresh={refresh}
              onSuccess={(msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); }}
              onError={(msg) => setActionError(msg)}
              onPreviewDiff={(diff) => { setSelectedFile(null); setStashDiffPreview(diff); }}
            />
          </div>
        )}


        {/* Action bar */}
        <div className="border-t border-[var(--border-color)] p-2 space-y-1.5">
          {/* Success toast */}
          {successMsg && (
            <div className="text-sm text-[var(--accent-green)] bg-[var(--accent-green)]/10 rounded px-2 py-1 flex items-center gap-1">
              <Check size={14} />
              {successMsg}
            </div>
          )}

          {/* Error message */}
          {actionError && (
            <div className="text-sm text-[var(--accent-red)] bg-[var(--accent-red)]/10 rounded px-2 py-1 break-words">
              {actionError}
            </div>
          )}

          {/* Stash input (shown when stash button clicked) */}
          {showStashInput && (
            <div className="flex gap-1">
              <input
                type="text"
                value={stashMsg}
                onChange={(e) => setStashMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && stashMsg.trim()) handleStashSave();
                  if (e.key === "Escape") { setShowStashInput(false); setStashMsg(""); }
                }}
                placeholder="Stash name..."
                autoFocus
                className="flex-1 text-sm px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
              />
              <button
                onClick={handleStashSave}
                disabled={stashing || !stashMsg.trim()}
                className="shrink-0 text-sm px-2 py-1.5 rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25 transition-colors disabled:opacity-40"
              >
                {stashing ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => { setShowStashInput(false); setStashMsg(""); }}
                className="shrink-0 text-sm px-1.5 py-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Commit message input */}
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commitMsg.trim() && files.length > 0) handleCommit();
            }}
            placeholder="Commit message..."
            className="w-full text-sm px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)]"
          />

          {/* Action buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={handleCommit}
              disabled={committing || !commitMsg.trim() || files.length === 0}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded transition-colors ${
                committing
                  ? "bg-[var(--accent-blue)]/25 text-[var(--accent-blue)] cursor-wait"
                  : !commitMsg.trim() || files.length === 0
                    ? "bg-[var(--text-secondary)]/8 text-[var(--text-secondary)]/60 cursor-not-allowed"
                    : "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25"
              }`}
              title={files.length === 0 ? "No changes" : !commitMsg.trim() ? "Enter a commit message" : stagedFiles.length > 0 ? "Commit staged files" : "Stage all and commit"}
            >
              {committing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {committing ? "Committing..." : "Commit"}
            </button>
            <button
              onClick={handlePush}
              disabled={!hasUnpushed || pushing}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded transition-colors ${
                pushing
                  ? "bg-[var(--accent-red)]/25 text-[var(--accent-red)] cursor-wait"
                  : !hasUnpushed
                    ? "bg-[var(--text-secondary)]/8 text-[var(--text-secondary)]/60 cursor-not-allowed"
                    : "bg-[var(--accent-red)]/15 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/25"
              }`}
              title={!hasUnpushed ? "No unpushed commits" : "Push to remote"}
            >
              {pushing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {pushing ? "Pushing..." : "Push"}
            </button>
            <button
              onClick={() => setShowStashInput(!showStashInput)}
              disabled={files.length === 0}
              className={`shrink-0 flex items-center justify-center gap-1 text-sm font-medium px-2 py-1.5 rounded transition-colors ${
                files.length === 0
                  ? "bg-[var(--text-secondary)]/8 text-[var(--text-secondary)]/60 cursor-not-allowed"
                  : "bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] hover:bg-[var(--text-secondary)]/20"
              }`}
              title="Stash changes"
            >
              <Package size={14} />
              Stash
            </button>
          </div>

          {/* Undo last commit — always visible to prevent layout shift */}
          <button
            onClick={handleUndoCommit}
            disabled={!hasUnpushed || undoing}
            className={`w-full flex items-center justify-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded transition-colors ${
              undoing
                ? "bg-[var(--text-secondary)]/15 text-[var(--text-secondary)] cursor-wait"
                : !hasUnpushed
                  ? "bg-[var(--text-secondary)]/8 text-[var(--text-secondary)]/30 cursor-not-allowed"
                  : "bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] hover:bg-[var(--text-secondary)]/20"
            }`}
            title={!hasUnpushed ? "No unpushed commits" : "Undo last commit (git reset --soft HEAD~1) — changes stay staged"}
          >
            {undoing ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Undo Last Commit
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handlePanelResize}
        className="w-1 shrink-0 cursor-col-resize hover:bg-[var(--accent-blue)]/30 active:bg-[var(--accent-blue)]/50 transition-colors"
      />

      {/* Diff viewer / File content viewer / Stash diff preview */}
      <div className="flex-1 min-w-0 overflow-auto bg-[var(--bg-primary)]">
        {stashDiffPreview != null ? (
          <GitDiffViewer diff={stashDiffPreview} filePath="Stash Preview" isNewFile={false} />
        ) : selectedFile ? (
          <GitDiffViewer diff={diff} filePath={selectedFile.path} isNewFile={isNewFile} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-secondary)]">
            Select a file to view changes
          </div>
        )}
      </div>

      {/* Revert confirmation dialog */}
      {confirmRevert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmRevert(null)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Discard Changes</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {confirmRevert.type === "file" ? (
                <>
                  Discard all changes to{" "}
                  <span className="font-medium text-[var(--text-primary)] break-all">
                    {confirmRevert.path}
                  </span>
                  ? This cannot be undone.
                </>
              ) : (
                <>
                  Discard changes to{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {confirmRevert.files.length} file(s)
                  </span>
                  ? This cannot be undone.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRevert(null)}
                className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmRevert.type === "file") {
                    handleRevertFile(confirmRevert.path, confirmRevert.status);
                  } else {
                    handleRevertAll(confirmRevert.files);
                  }
                }}
                className="text-sm px-4 py-2 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge confirmation modal */}
      {confirmMergeBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmMergeBranch(null)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[420px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <GitMerge size={20} className="text-[var(--accent-blue)]" />
              <p className="text-base font-semibold">Merge Branch</p>
            </div>

            <div className="mb-5 space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Are you sure you want to merge:
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)]">
                <GitBranch size={14} className="shrink-0 text-[var(--accent-blue)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{confirmMergeBranch}</span>
              </div>
              <div className="flex justify-center">
                <span className="text-xs text-[var(--text-secondary)]">into</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/20">
                <GitBranch size={14} className="shrink-0 text-[var(--accent-blue)]" />
                <span className="text-sm font-semibold text-[var(--accent-blue)] truncate">{status?.branch ?? "—"}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">current</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmMergeBranch(null)}
                className="text-sm px-4 py-2 rounded-md border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                className="text-sm px-4 py-2 rounded-md bg-[var(--accent-blue)] text-white hover:opacity-90 transition-colors flex items-center gap-1.5"
              >
                <GitMerge size={14} />
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
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
  onRevertFile,
  onRevertAll,
}: {
  title: string;
  files: GitChangedFile[];
  selectedFile: { path: string; staged: boolean; status?: string } | null;
  onSelect: (f: { path: string; staged: boolean; status?: string }) => void;
  actionIcon: "stage" | "unstage";
  onFileAction: (filePath: string) => void;
  onSectionAction: () => void;
  sectionActionTitle: string;
  disabled: boolean;
  onRevertFile?: (f: { path: string; status: string; staged: boolean }) => void;
  onRevertAll?: () => void;
}) {
  return (
    <div>
      {/* Section header with bulk actions */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title} ({files.length})
        </span>
        <div className="flex items-center gap-0.5">
          {/* Revert all button */}
          {onRevertAll && (
            <button
              onClick={(e) => { e.stopPropagation(); onRevertAll(); }}
              disabled={disabled}
              className="p-0.5 rounded hover:bg-[var(--accent-red)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors disabled:opacity-40"
              title="Discard all changes"
            >
              <Undo2 size={16} />
            </button>
          )}
          {/* Stage/Unstage all button */}
          <button
            onClick={(e) => { e.stopPropagation(); onSectionAction(); }}
            disabled={disabled}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
            title={sectionActionTitle}
          >
            {actionIcon === "stage" ? <Plus size={16} /> : <Minus size={16} />}
          </button>
        </div>
      </div>

      {/* File rows */}
      {files.map((f) => {
        const isSelected = selectedFile?.path === f.path && selectedFile?.staged === f.staged;
        return (
          <div
            key={`${f.staged ? "s" : "u"}-${f.path}`}
            className={`group flex items-center gap-1.5 px-1.5 py-1 cursor-pointer transition-all ${
              isSelected
                ? "bg-[var(--bg-active)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--accent-blue)] rounded"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {/* Stage/Unstage button */}
            <button
              onClick={(e) => { e.stopPropagation(); onFileAction(f.path); }}
              disabled={disabled}
              className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40"
              title={actionIcon === "stage" ? `Stage ${f.path}` : `Unstage ${f.path}`}
            >
              {actionIcon === "stage" ? <Plus size={14} /> : <Minus size={14} />}
            </button>

            {/* Revert button */}
            {onRevertFile && (
              <button
                onClick={(e) => { e.stopPropagation(); onRevertFile({ path: f.path, status: f.status, staged: f.staged }); }}
                disabled={disabled}
                className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--accent-red)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-all disabled:opacity-40"
                title={`Discard changes: ${f.path}`}
              >
                <Undo2 size={14} />
              </button>
            )}

            {/* File row — clickable to view diff */}
            <button
              onClick={() => onSelect({ path: f.path, staged: f.staged, status: f.status })}
              className="flex-1 flex items-center gap-1.5 py-0.5 text-left text-sm min-w-0 cursor-pointer"
            >
              <FileIcon filename={f.path} size={16} />
              <span className="truncate flex-1" title={f.path}>{f.path}</span>
              <StatusBadge status={f.status} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Colored tag badge for file status */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    M: { label: "M", color: "text-[var(--accent-blue)]", bg: "bg-[var(--accent-blue)]/12" },
    A: { label: "A", color: "text-[var(--accent-green)]", bg: "bg-[var(--accent-green)]/12" },
    D: { label: "D", color: "text-[var(--accent-red)]", bg: "bg-[var(--accent-red)]/12" },
    R: { label: "R", color: "text-[var(--accent-blue)]", bg: "bg-[var(--accent-blue)]/12" },
    "?": { label: "U", color: "text-[var(--accent-green)]", bg: "bg-[var(--accent-green)]/12" },
  };
  const { label, color, bg } = config[status] ?? { label: status, color: "text-[var(--text-secondary)]", bg: "bg-[var(--text-secondary)]/10" };

  return (
    <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${color} ${bg}`}>
      {label}
    </span>
  );
}
