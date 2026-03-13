import { useState } from "react";
import { ChevronDown, Package, Play, Trash2, Download, Loader2 } from "lucide-react";
import {
  gitStashApply,
  gitStashPop,
  gitStashDrop,
  gitStashDiff,
  type StashEntry,
} from "../lib/tauri-commands";

interface Props {
  stashes: StashEntry[];
  projectPath: string;
  /** Called after any stash operation to refresh parent state */
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  /** Show stash diff in the right panel */
  onPreviewDiff: (diff: string) => void;
}

export function GitStashSection({
  stashes,
  projectPath,
  onRefresh,
  onSuccess,
  onError,
  onPreviewDiff,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<StashEntry | null>(null);

  async function handleApply(entry: StashEntry) {
    setLoadingIdx(entry.index);
    try {
      await gitStashApply(projectPath, entry.index);
      onSuccess(`Applied stash: ${entry.message || `stash@{${entry.index}}`}`);
      onRefresh();
    } catch (e) {
      onError(`Apply failed: ${e}`);
    }
    setLoadingIdx(null);
  }

  async function handlePop(entry: StashEntry) {
    setLoadingIdx(entry.index);
    try {
      await gitStashPop(projectPath, entry.index);
      onSuccess(`Popped stash: ${entry.message || `stash@{${entry.index}}`}`);
      onRefresh();
    } catch (e) {
      onError(`Pop failed: ${e}`);
    }
    setLoadingIdx(null);
  }

  async function handleDrop(entry: StashEntry) {
    setLoadingIdx(entry.index);
    try {
      await gitStashDrop(projectPath, entry.index);
      onSuccess(`Dropped stash: ${entry.message || `stash@{${entry.index}}`}`);
      onRefresh();
    } catch (e) {
      onError(`Drop failed: ${e}`);
    }
    setLoadingIdx(null);
    setConfirmDrop(null);
  }

  async function handlePreview(entry: StashEntry) {
    try {
      const diff = await gitStashDiff(projectPath, entry.index);
      onPreviewDiff(diff);
    } catch (e) {
      onError(`Failed to load stash diff: ${e}`);
    }
  }

  return (
    <>
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1 group"
      >
        <span className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1">
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
          Stashes ({stashes.length})
        </span>
      </button>

      {/* Stash entries */}
      {expanded && (
        <div>
          {stashes.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--text-secondary)]/60 text-center">
              No stashes
            </div>
          ) : (
            stashes.map((entry) => {
              const isLoading = loadingIdx === entry.index;
              return (
                <div
                  key={entry.index}
                  className="group flex items-center gap-1.5 px-1.5 py-1 cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  onClick={() => handlePreview(entry)}
                >
                  {/* Icon */}
                  <Package size={14} className="shrink-0 text-[var(--accent-blue)]" />

                  {/* Message + branch */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate text-[var(--text-primary)]" title={entry.message || "(no message)"}>
                      {entry.message || <span className="italic text-[var(--text-secondary)]">no message</span>}
                    </div>
                    {entry.branch && (
                      <div className="text-[11px] text-[var(--text-secondary)]/70 truncate">
                        on {entry.branch}
                      </div>
                    )}
                  </div>

                  {/* Action buttons (visible on hover) */}
                  {isLoading ? (
                    <Loader2 size={14} className="shrink-0 animate-spin" />
                  ) : (
                    <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Apply (keep stash) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApply(entry); }}
                        className="p-0.5 rounded hover:bg-[var(--accent-blue)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                        title="Apply (keep stash)"
                      >
                        <Download size={14} />
                      </button>
                      {/* Pop (apply + remove) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePop(entry); }}
                        className="p-0.5 rounded hover:bg-[var(--accent-green)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-green)] transition-colors"
                        title="Pop (apply & remove)"
                      >
                        <Play size={14} />
                      </button>
                      {/* Drop */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDrop(entry); }}
                        className="p-0.5 rounded hover:bg-[var(--accent-red)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
                        title="Drop (delete)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Drop confirmation modal */}
      {confirmDrop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDrop(null)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Drop Stash</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Delete stash{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {confirmDrop.message || `stash@{${confirmDrop.index}}`}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDrop(null)}
                className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDrop(confirmDrop)}
                className="text-sm px-4 py-2 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
              >
                Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
