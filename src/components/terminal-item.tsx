import { useState, useRef, useEffect } from "react";
import { Terminal, Loader2, X } from "lucide-react";
import type { TerminalSession } from "../types";
import { useAppStore } from "../stores/app-store";
import { killTerminal } from "../lib/tauri-commands";

interface Props {
  terminal: TerminalSession;
}

export function TerminalItem({ terminal }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(terminal.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal);
  const removeTerminal = useAppStore((s) => s.removeTerminal);
  const setTerminalRunning = useAppStore((s) => s.setTerminalRunning);
  const renameTerminal = useAppStore((s) => s.renameTerminal);

  const isActive = activeTerminalId === terminal.id;

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditValue(terminal.name);
    setEditing(true);
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

  async function handleKill(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await killTerminal(terminal.id);
    } catch {
      /* may already be dead */
    }
    setTerminalRunning(terminal.id, false);
    removeTerminal(terminal.id);
  }

  return (
    <div
      onClick={() => setActiveTerminal(terminal.id)}
      onDoubleClick={handleDoubleClick}
      className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors duration-150 ${
        isActive
          ? "text-[var(--accent-blue)]"
          : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      }`}
    >
      <Terminal size={12} className="shrink-0" />

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="text-xs flex-1 bg-[var(--bg-primary)] border border-[var(--accent-blue)] rounded px-1 py-0 outline-none text-[var(--text-primary)]"
        />
      ) : (
        <span className="text-xs truncate flex-1">{terminal.name}</span>
      )}

      {terminal.isRunning && (
        <Loader2
          size={12}
          className="shrink-0 animate-spin text-[var(--accent-blue)]"
        />
      )}

      <button
        onClick={handleKill}
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
        title="Kill terminal"
      >
        <X size={10} />
      </button>
    </div>
  );
}
