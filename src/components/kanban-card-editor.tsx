import { useState, useRef, useEffect } from "react";
import type { KanbanCard, CardType } from "../types/kanban";
import { CARD_TYPES } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";

/** Color ring per type for the selector pills */
const TYPE_PILL_STYLES: Record<string, string> = {
  cook:       "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  plan:       "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  code:       "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  test:       "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  brainstorm: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  scout:      "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  debug:      "bg-red-500/15 text-red-400 ring-red-500/30",
  watzup:     "bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

interface Props {
  card?: KanbanCard;
  columnId?: string;
  onClose: () => void;
}

export function KanbanCardEditor({ card, columnId, onClose }: Props) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [content, setContent] = useState(card?.content ?? "");
  const [type, setType] = useState<CardType>(card?.type ?? "cook");
  const titleRef = useRef<HTMLInputElement>(null);
  const addCard = useKanbanStore((s) => s.addCard);
  const updateCard = useKanbanStore((s) => s.updateCard);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    if (card) {
      updateCard(card.id, { title: trimmedTitle, content: content.trim(), type });
    } else if (columnId) {
      addCard(columnId, trimmedTitle, content.trim(), type);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
  }

  return (
    <div
      className="rounded-lg border border-[var(--accent-blue)]/40 bg-[var(--bg-primary)] p-3 shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {/* Title input */}
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title..."
        className="w-full text-sm font-medium bg-[var(--bg-hover)] rounded-md px-2.5 py-2 border border-[var(--border-color)] outline-none mb-2.5 placeholder:text-[var(--text-secondary)]/60 focus:border-[var(--accent-blue)] transition-colors"
      />

      {/* Content textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content / command..."
        rows={4}
        className="w-full text-[13px] bg-[var(--bg-hover)] rounded-md p-2.5 border-none outline-none resize-none mb-3 placeholder:text-[var(--text-secondary)]/60 leading-relaxed"
      />

      {/* Type selector — pill buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CARD_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => setType(ct.value)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md ring-1 ring-inset transition-all ${
              type === ct.value
                ? `${TYPE_PILL_STYLES[ct.value]} ring-2`
                : "bg-transparent text-[var(--text-secondary)] ring-[var(--border-color)] hover:ring-[var(--text-secondary)]/40"
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]/60">
          ⌘+Enter to save
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-[13px] px-3 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-[13px] px-3.5 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:opacity-90 font-medium transition-opacity"
          >
            {card ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
