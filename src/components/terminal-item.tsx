import { useState, useRef, useEffect } from "react";
import { Terminal, X } from "lucide-react";
import type { TerminalSession } from "../types";
import { useAppStore } from "../stores/app-store";
import { killTerminal } from "../lib/tauri-commands";

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
        className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-all duration-150 ${
          isActive
            ? "text-[var(--accent-blue)] glow-active bg-[var(--accent-blue)]/8"
            : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        }`}
      >
        {/* Alive/dead dot indicator */}
        <span
          className={`shrink-0 w-2 h-2 rounded-full ${
            terminal.isRunning
              ? "bg-[var(--accent-green,#22c55e)]"
              : "bg-[var(--text-secondary)]/30"
          }`}
          title={terminal.isRunning ? "Running" : "Exited"}
        />
        <Terminal size={16} className="shrink-0" />

        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-sm flex-1 bg-[var(--bg-primary)] border border-[var(--accent-blue)] rounded px-1 py-0 outline-none text-[var(--text-primary)]"
          />
        ) : (
          <span className="text-sm truncate flex-1">{terminal.name}</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmKill(true);
          }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
          title="Kill terminal"
        >
          <X size={14} />
        </button>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[120px] rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-lg py-1"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => {
              setCtxMenu(null);
              startRename();
            }}
            className="w-full text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
          >
            Rename
          </button>
          <button
            onClick={() => {
              setCtxMenu(null);
              setConfirmKill(true);
            }}
            className="w-full text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--accent-red)]"
          >
            Kill
          </button>
        </div>
      )}

      {/* Kill confirmation modal */}
      {confirmKill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmKill(false)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Kill Terminal</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Are you sure you want to kill{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {terminal.name}
              </span>
              ? Any running process will be terminated.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKill(false)}
                className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleKill}
                className="text-sm px-4 py-2 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
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
