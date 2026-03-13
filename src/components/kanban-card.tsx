import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, Trash2, Check, ChevronDown, Play, Tag, Loader2, Clock, AlertCircle } from "lucide-react";
import type { KanbanCard as KanbanCardType } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { useAppStore } from "../stores/app-store";
import { useTagStore } from "../stores/tag-store";
import { getTagStyles, UNTAGGED_STYLES } from "../lib/tag-colors";
import { writeTerminal } from "../lib/tauri-commands";
import { useAutoRunStore } from "../stores/auto-run-store";
import { KanbanCardEditor } from "./kanban-card-editor";


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
  const [expanded, setExpanded] = useState(false);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const removeCard = useKanbanStore((s) => s.removeCard);
  const updateCard = useKanbanStore((s) => s.updateCard);
  const autoRunStatus = useAutoRunStore((s) => s.cardStatus[card.id]);
  const terminals = useAppStore((s) => s.terminals);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
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

  const tags = useTagStore((s) => s.tags);
  const currentTag = card.type ? tags.find((t) => t.id === card.type) : null;
  const typeStyle = currentTag ? getTagStyles(currentTag.color) : UNTAGGED_STYLES;
  const hasType = card.type !== null;

  // Use tag command if available, otherwise fallback to /{type}
  const tagPrefix = currentTag?.command ?? (hasType ? `/${card.type}` : "");

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = tagPrefix ? `${tagPrefix} ${card.content}` : card.content;
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

    // Use the active terminal if it belongs to this project, otherwise fallback to first
    const activeTerminal = terminals.find((t) => t.id === activeTerminalId && t.projectId === activeProjectId);
    const projectTerminal = activeTerminal ?? terminals.find((t) => t.projectId === activeProjectId);
    if (!projectTerminal) return;

    const command = tagPrefix ? `${tagPrefix} ${card.content}` : card.content;

    setRunState("running");

    // If terminal panel is visible in dashboard, stay on dashboard
    const { activeView } = useAppStore.getState();
    const terminalVisibleInDashboard =
      activeView === "kanban" &&
      localStorage.getItem("termoras:terminal-panel-open") !== "false";

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
              className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={typeStyle.badge}
              title="Change type"
            >
              {hasType ? (
                <>
                  <span className="w-2 h-2 rounded-full" style={typeStyle.bar} />
                  {currentTag?.label ?? card.type}
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <Tag size={14} />
                  <ChevronDown size={14} />
                </>
              )}
            </button>

            {/* Type selector dropdown — fixed position to escape overflow clipping */}
            {showTypeMenu && menuPos && (
              <div
                className="fixed z-50 min-w-[130px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl py-1"
                style={{ left: menuPos.x, top: menuPos.y }}
              >
                {tags.map((tag) => {
                  const s = getTagStyles(tag.color);
                  const isSelected = card.type === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCard(card.id, { type: isSelected ? null : tag.id });
                        setShowTypeMenu(false);
                      }}
                      title={tag.description ?? ""}
                      className={`w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors ${
                        isSelected ? "font-semibold" : ""
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={s.bar} />
                      <span>{tag.label}</span>
                      {isSelected && (
                        <Check size={14} className="ml-auto text-[var(--accent-blue)]" />
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
                  <Loader2 size={18} className="animate-spin" />
                ) : runState === "done" ? (
                  <Check size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
              title="Copy command"
            >
              {copied ? (
                <Check size={18} className="text-[var(--accent-green)]" />
              ) : (
                <Copy size={18} />
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
              <Pencil size={18} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
              title="Delete card"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-medium leading-snug mb-1.5">
          {card.title}
        </p>

        {/* Content preview — click to expand/collapse */}
        {card.content && (
          <p
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`text-sm text-[var(--text-secondary)] leading-relaxed mb-2 cursor-pointer ${expanded ? "" : "line-clamp-3"}`}
          >
            {card.content}
          </p>
        )}

        {/* Command preview — monospace chip */}
        {card.content && (
          <div className="flex items-center gap-2">
            <span className="inline-block text-sm font-mono px-2 py-1 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] truncate max-w-full">
              {tagPrefix ? `${tagPrefix} ` : ""}{card.content.length > 40 ? card.content.slice(0, 40) + "…" : card.content}
            </span>
            {/* Auto-run status badge */}
            {autoRunStatus === "pending" && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded" title="Queued">
                <Clock size={12} /> Queue
              </span>
            )}
            {autoRunStatus === "running" && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded" title="Running">
                <Loader2 size={12} className="animate-spin" /> Running
              </span>
            )}
            {autoRunStatus === "done" && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--accent-green)] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded" title="Done">
                <Check size={12} /> Done
              </span>
            )}
            {autoRunStatus === "error" && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--accent-red)] bg-[var(--accent-red)]/10 px-1.5 py-0.5 rounded" title="Error">
                <AlertCircle size={12} /> Error
              </span>
            )}
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
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-5 w-[380px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold mb-2">Delete Card</p>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {card.title}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm rounded-md border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  removeCard(card.id);
                }}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
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
