import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, Trash2, Check, ChevronDown, Play, Tag, Loader2 } from "lucide-react";
import type { KanbanCard as KanbanCardType } from "../types/kanban";
import { CARD_TYPES } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { useAppStore } from "../stores/app-store";
import { writeTerminal } from "../lib/tauri-commands";
import { KanbanCardEditor } from "./kanban-card-editor";

/** Dot + badge colors per card type */
const TYPE_STYLES: Record<string, { bar: string; badge: string }> = {
  cook:       { bar: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-600 ring-blue-500/25" },
  plan:       { bar: "bg-purple-500",  badge: "bg-purple-500/10 text-purple-600 ring-purple-500/25" },
  code:       { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25" },
  test:       { bar: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-600 ring-amber-500/25" },
  brainstorm: { bar: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-600 ring-orange-500/25" },
  scout:      { bar: "bg-cyan-500",    badge: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/25" },
  debug:      { bar: "bg-red-500",     badge: "bg-red-500/10 text-red-600 ring-red-500/25" },
  watzup:     { bar: "bg-slate-500",   badge: "bg-slate-500/10 text-slate-600 ring-slate-500/25" },
};

/** Fallback style when type is null */
const UNTAGGED_STYLE = { bar: "bg-neutral-400", badge: "bg-neutral-500/10 text-neutral-400 ring-neutral-500/20" };

interface Props {
  card: KanbanCardType;
  isDragOverlay?: boolean;
}

export function KanbanCard({ card, isDragOverlay }: Props) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const removeCard = useKanbanStore((s) => s.removeCard);
  const updateCard = useKanbanStore((s) => s.updateCard);
  const terminals = useAppStore((s) => s.terminals);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal);
  const setActiveTerminalInPlace = useAppStore((s) => s.setActiveTerminalInPlace);

  // Close type menu on outside click
  useEffect(() => {
    if (!showTypeMenu) return;
    const close = () => setShowTypeMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [showTypeMenu]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: editing || showTypeMenu });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const typeStyle = card.type ? (TYPE_STYLES[card.type] ?? UNTAGGED_STYLE) : UNTAGGED_STYLE;
  const hasType = card.type !== null;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = hasType ? `/${card.type} ${card.content}` : card.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(true);
  }

  async function handleRun(e: React.MouseEvent) {
    e.stopPropagation();
    if (!card.content || runState !== "idle") return;

    // Find a terminal for the current project
    const projectTerminal = terminals.find((t) => t.projectId === activeProjectId);
    if (!projectTerminal) return;

    const command = hasType ? `/${card.type} ${card.content}` : card.content;

    setRunState("running");

    // If terminal panel is visible in dashboard, stay on dashboard
    const { activeView } = useAppStore.getState();
    const terminalVisibleInDashboard =
      activeView === "kanban" &&
      localStorage.getItem("clcterm:terminal-panel-open") !== "false";

    if (terminalVisibleInDashboard) {
      setActiveTerminalInPlace(projectTerminal.id);
    } else {
      setActiveTerminal(projectTerminal.id);
    }

    // Write command + enter to the PTY
    await writeTerminal(projectTerminal.id, command + "\r");

    // Show done state after command is sent
    setRunState("done");
    setTimeout(() => setRunState("idle"), 2000);
  }

  if (editing) {
    return (
      <div ref={setNodeRef} style={style}>
        <KanbanCardEditor card={card} onClose={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      className={`group relative rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-[var(--text-secondary)]/30 ${
        isDragOverlay
          ? "shadow-2xl ring-2 ring-[var(--accent-blue)]/50 scale-[1.02]"
          : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className="px-3 py-3">
        {/* Header: type selector + actions */}
        <div className="flex items-center gap-2 mb-2">
          <div>
            <button
              ref={tagBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                if (showTypeMenu) {
                  setShowTypeMenu(false);
                } else {
                  const rect = tagBtnRef.current?.getBoundingClientRect();
                  if (rect) setMenuPos({ x: rect.left, y: rect.bottom + 4 });
                  setShowTypeMenu(true);
                }
              }}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ring-1 ring-inset cursor-pointer hover:opacity-80 transition-opacity ${typeStyle.badge}`}
              title="Change type"
            >
              {hasType ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${typeStyle.bar}`} />
                  {card.type}
                  <ChevronDown size={10} />
                </>
              ) : (
                <>
                  <Tag size={10} />
                  <ChevronDown size={10} />
                </>
              )}
            </button>

            {/* Type selector dropdown — fixed position to escape overflow clipping */}
            {showTypeMenu && menuPos && (
              <div
                className="fixed z-50 min-w-[130px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl py-1"
                style={{ left: menuPos.x, top: menuPos.y }}
              >
                {CARD_TYPES.map((ct) => {
                  const s = TYPE_STYLES[ct.value] ?? UNTAGGED_STYLE;
                  const isSelected = card.type === ct.value;
                  return (
                    <button
                      key={ct.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle: click selected tag to untag, click other to set
                        updateCard(card.id, { type: isSelected ? null : ct.value });
                        setShowTypeMenu(false);
                      }}
                      title={ct.description}
                      className={`w-full flex items-center gap-2 text-left text-xs px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors ${
                        isSelected ? "font-semibold" : ""
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.bar}`} />
                      <span>{ct.label}</span>
                      {isSelected && (
                        <Check size={10} className="ml-auto text-[var(--accent-blue)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex-1" />

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {card.content && (
              <button
                onClick={handleRun}
                className={`p-1.5 rounded-md transition-colors ${
                  runState === "done"
                    ? "text-[var(--accent-green)]"
                    : runState === "running"
                    ? "text-[var(--accent-blue)]"
                    : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-green)]"
                }`}
                title="Run in terminal"
              >
                {runState === "running" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : runState === "done" ? (
                  <Check size={14} />
                ) : (
                  <Play size={14} />
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
              title="Copy command"
            >
              {copied ? (
                <Check size={14} className="text-[var(--accent-green)]" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Edit card"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
              title="Delete card"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-medium leading-snug mb-1.5">
          {card.title}
        </p>

        {/* Content preview */}
        {card.content && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3 mb-2">
            {card.content}
          </p>
        )}

        {/* Command preview — monospace chip */}
        {card.content && (
          <div className="flex">
            <span className="inline-block text-[11px] font-mono px-2 py-1 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] truncate max-w-full">
              {hasType ? `/${card.type} ` : ""}{card.content.length > 40 ? card.content.slice(0, 40) + "…" : card.content}
            </span>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-4 w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-1">Delete Card</p>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {card.title}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  removeCard(card.id);
                }}
                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
