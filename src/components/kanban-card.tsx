import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, Trash2, Check } from "lucide-react";
import type { KanbanCard as KanbanCardType } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { KanbanCardEditor } from "./kanban-card-editor";

/** Left accent bar + badge colors per card type */
const TYPE_STYLES: Record<string, { bar: string; badge: string; icon: string }> = {
  cook:       { bar: "bg-blue-500",   badge: "bg-blue-500/15 text-blue-400 ring-blue-500/20",     icon: "🍳" },
  plan:       { bar: "bg-purple-500", badge: "bg-purple-500/15 text-purple-400 ring-purple-500/20", icon: "📋" },
  code:       { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20", icon: "⌨️" },
  test:       { bar: "bg-amber-500",  badge: "bg-amber-500/15 text-amber-400 ring-amber-500/20",   icon: "🧪" },
  brainstorm: { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-400 ring-orange-500/20", icon: "💡" },
  scout:      { bar: "bg-cyan-500",   badge: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/20",     icon: "🔍" },
  debug:      { bar: "bg-red-500",    badge: "bg-red-500/15 text-red-400 ring-red-500/20",       icon: "🐛" },
  watzup:     { bar: "bg-slate-500",  badge: "bg-slate-500/15 text-slate-400 ring-slate-500/20",   icon: "👀" },
};

interface Props {
  card: KanbanCardType;
  isDragOverlay?: boolean;
}

export function KanbanCard({ card, isDragOverlay }: Props) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const removeCard = useKanbanStore((s) => s.removeCard);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const typeStyle = TYPE_STYLES[card.type] ?? TYPE_STYLES.watzup;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = `/${card.type} ${card.content}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    removeCard(card.id);
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
      className={`group relative overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-[var(--text-secondary)]/30 ${
        isDragOverlay
          ? "shadow-2xl ring-2 ring-[var(--accent-blue)]/50 scale-[1.02]"
          : "shadow-sm hover:shadow-md"
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${typeStyle.bar}`} />

      <div className="pl-4 pr-3 py-3">
        {/* Header: type badge + actions */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ring-1 ring-inset ${typeStyle.badge}`}
          >
            <span className="text-xs">{typeStyle.icon}</span>
            {card.type}
          </span>
          <div className="flex-1" />

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
              /{card.type} {card.content.length > 40 ? card.content.slice(0, 40) + "…" : card.content}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
