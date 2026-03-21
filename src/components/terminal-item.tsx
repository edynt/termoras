import { useState, useRef, useEffect } from "react";
import { Terminal, X } from "lucide-react";
import type { TerminalSession } from "../types";
import { useAppStore } from "../stores/app-store";
import { useTerminalProcessStore } from "../stores/terminal-process-store";
import { killTerminal, getTerminalProcessName } from "../lib/tauri-commands";

interface Props {
  terminal: TerminalSession;
}

export function TerminalItem({ terminal }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(terminal.name);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [confirmKill, setConfirmKill] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
  const activeView = useAppStore((s) => s.activeView);
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal);
  const removeTerminal = useAppStore((s) => s.removeTerminal);
  const setTerminalRunning = useAppStore((s) => s.setTerminalRunning);
  const renameTerminal = useAppStore((s) => s.renameTerminal);
  const isBusy = !!useTerminalProcessStore((s) => s.processes[terminal.id]);

  const isActive = activeTerminalId === terminal.id && activeView === "terminal";

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  function startRename() {
    setEditValue(terminal.name);
    setEditing(true);
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    startRename();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function commitRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== terminal.name) {
      renameTerminal(terminal.id, trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditing(false);
  }

  async function handleKill() {
    try {
      await killTerminal(terminal.id);
    } catch {
      /* may already be dead */
    }
    setTerminalRunning(terminal.id, false);
    removeTerminal(terminal.id);
    setConfirmKill(false);
  }

  return (
    <>
      <div
        onClick={() => setActiveTerminal(terminal.id)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={`group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors duration-150 ${
          isActive
            ? "bg-[var(--accent-blue)]/8 text-[var(--accent-blue)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        }`}
      >
        {/* Process status dot */}
        <span
          className={`shrink-0 w-1.5 h-1.5 rounded-full transition-colors ${
            isBusy
              ? "bg-[var(--accent-green)]"
              : "bg-[var(--text-tertiary)]/40"
          }`}
        />
        <Terminal size={14} className="shrink-0" />

        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-sm flex-1 bg-[var(--bg-primary)] border border-[var(--accent-blue)] rounded-md px-1.5 py-0.5 outline-none text-[var(--text-primary)]"
          />
        ) : (
          <span className="text-sm truncate flex-1">{terminal.name}</span>
        )}

        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const proc = await getTerminalProcessName(terminal.id);
              if (proc) { setConfirmKill(true); return; }
            } catch { /* terminal may be dead */ }
            handleKill();
          }}
          className="shrink-0 p-0.5 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
          title="Kill terminal"
        >
          <X size={12} />
        </button>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[120px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y, boxShadow: "var(--shadow-lg)" }}
        >
          <button
            onClick={() => { setCtxMenu(null); startRename(); }}
            className="w-full text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
          >
            Rename
          </button>
          <button
            onClick={() => { setCtxMenu(null); setConfirmKill(true); }}
            className="w-full text-left text-sm px-3 py-1.5 hover:bg-[var(--accent-red)]/8 text-[var(--accent-red)] transition-colors"
          >
            Kill
          </button>
        </div>
      )}

      {/* Kill confirmation modal */}
      {confirmKill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setConfirmKill(false)}
        >
          <div
            className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-6 w-[380px]"
            style={{ boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Kill Terminal</p>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Are you sure you want to kill{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {terminal.name}
              </span>
              ? Any running process will be terminated.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKill(false)}
                className="text-sm px-4 py-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKill}
                className="text-sm px-4 py-2 rounded-lg bg-[var(--accent-red)] text-white hover:opacity-90 transition-opacity"
              >
                Kill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
