import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import type { TerminalSession } from "../types";
import { useAppStore } from "../stores/app-store";
import { killTerminal } from "../lib/tauri-commands";

interface Props {
  terminals: TerminalSession[];
  activeTerminalId: string | null;
  onCreateTerminal: () => void;
}

export function TerminalTabBar({ terminals, activeTerminalId, onCreateTerminal }: Props) {
  const setActiveTerminalInPlace = useAppStore((s) => s.setActiveTerminalInPlace);
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal);
  const removeTerminal = useAppStore((s) => s.removeTerminal);
  const setTerminalRunning = useAppStore((s) => s.setTerminalRunning);
  const renameTerminal = useAppStore((s) => s.renameTerminal);
  const reorderTerminals = useAppStore((s) => s.reorderTerminals);
  const activeView = useAppStore((s) => s.activeView);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmKillId, setConfirmKillId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag-to-reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<string | null>(null);
  const dragToRef = useRef<string | null>(null);
  const dragStartXRef = useRef(0);
  const isDragActiveRef = useRef(false);
  const justDraggedRef = useRef(false);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Listen for Cmd+W kill confirmation event from global keybindings
  useEffect(() => {
    function handleConfirmKill(e: Event) {
      const { terminalId } = (e as CustomEvent).detail;
      const { terminals: current } = useAppStore.getState();
      if (current.some((t) => t.id === terminalId)) {
        setConfirmKillId(terminalId);
      }
    }
    window.addEventListener("termoras:confirm-kill-terminal", handleConfirmKill);
    return () => window.removeEventListener("termoras:confirm-kill-terminal", handleConfirmKill);
  }, []);

  function handleTabClick(id: string) {
    // Suppress click if a drag just ended
    if (justDraggedRef.current) return;
    if (activeView === "kanban") {
      setActiveTerminalInPlace(id);
    } else {
      setActiveTerminal(id);
    }
  }

  function handleDoubleClick(t: TerminalSession) {
    if (justDraggedRef.current) return;
    setEditValue(t.name);
    setEditingId(t.id);
  }

  function commitRename(id: string) {
    const trimmed = editValue.trim();
    if (trimmed && editingId) {
      const terminal = terminals.find((t) => t.id === id);
      if (terminal && trimmed !== terminal.name) {
        renameTerminal(id, trimmed);
      }
    }
    setEditingId(null);
  }

  async function handleKill(id: string) {
    try {
      await killTerminal(id);
    } catch {
      /* may already be dead */
    }
    setTerminalRunning(id, false);
    removeTerminal(id);
    setConfirmKillId(null);
  }

  // Drag-to-reorder: pointer event handlers
  const startDrag = useCallback((terminalId: string, startX: number) => {
    if (editingId) return;

    dragFromRef.current = terminalId;
    dragToRef.current = null;
    dragStartXRef.current = startX;
    isDragActiveRef.current = false;

    function onMove(ev: PointerEvent) {
      // Activate drag after 5px horizontal threshold
      if (!isDragActiveRef.current) {
        if (Math.abs(ev.clientX - dragStartXRef.current) < 5) return;
        isDragActiveRef.current = true;
        setDraggingId(dragFromRef.current);
      }

      if (!tabBarRef.current) return;
      const tabs = tabBarRef.current.querySelectorAll<HTMLElement>("[data-tab-id]");
      let target: string | null = null;
      for (const tab of tabs) {
        const rect = tab.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          target = tab.dataset.tabId!;
          break;
        }
      }
      dragToRef.current = target;
      setDropTargetId(target);
    }

    function onUp() {
      const wasDragging = isDragActiveRef.current;
      const from = dragFromRef.current;
      const to = dragToRef.current;

      if (wasDragging && from && to && from !== to) {
        reorderTerminals(from, to);
      }

      // Suppress the click event that follows pointerup after a drag
      if (wasDragging) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }

      dragFromRef.current = null;
      dragToRef.current = null;
      isDragActiveRef.current = false;
      setDraggingId(null);
      setDropTargetId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [editingId, reorderTerminals]);

  if (terminals.length === 0) return null;

  return (
    <>
      <div
        ref={tabBarRef}
        className="flex items-center gap-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto"
      >
        {terminals.map((t) => {
          const isActive = t.id === activeTerminalId;
          const isDragging = t.id === draggingId;
          const isDropTarget = t.id === dropTargetId && dropTargetId !== draggingId;
          return (
            <div
              key={t.id}
              data-tab-id={t.id}
              onPointerDown={(e) => {
                // Only left button, skip if clicking close button or rename input
                if (e.button !== 0 || (e.target as HTMLElement).closest("button, input")) return;
                startDrag(t.id, e.clientX);
              }}
              onClick={() => handleTabClick(t.id)}
              onDoubleClick={() => handleDoubleClick(t)}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-colors select-none shrink-0 border-r border-[var(--border-color)] ${
                isActive
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              } ${isDragging ? "opacity-40" : ""}`}
              style={isDropTarget ? { boxShadow: "inset 2px 0 0 var(--accent-blue)" } : undefined}
            >
              {/* Active indicator line */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-blue)]" />
              )}

              {/* Running dot */}
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                  t.isRunning
                    ? "bg-[var(--accent-green,#22c55e)]"
                    : "bg-[var(--text-secondary)]/30"
                }`}
              />

              {/* Name / rename input */}
              {editingId === t.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(t.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs w-20 bg-[var(--bg-primary)] border border-[var(--accent-blue)] rounded px-1 py-0 outline-none text-[var(--text-primary)]"
                />
              ) : (
                <span className="truncate max-w-[100px]">{t.name}</span>
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmKillId(t.id);
                }}
                className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] transition-opacity"
                title="Kill terminal"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Add terminal button */}
        <button
          onClick={onCreateTerminal}
          className="shrink-0 p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-hover)] transition-colors"
          title="New terminal"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Kill confirmation modal */}
      {confirmKillId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmKillId(null)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Kill Terminal</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Are you sure you want to kill{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {terminals.find((t) => t.id === confirmKillId)?.name}
              </span>
              ? Any running process will be terminated.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKillId(null)}
                className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleKill(confirmKillId)}
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
