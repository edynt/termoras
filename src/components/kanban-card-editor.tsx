import { useState, useRef, useEffect } from "react";
import type { KanbanCard } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { useTagStore } from "../stores/tag-store";
import { getTagStyles } from "../lib/tag-colors";


interface Props {
  card?: KanbanCard;
  columnId?: string;
  onClose: () => void;
}

export function KanbanCardEditor({ card, columnId, onClose }: Props) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [content, setContent] = useState(card?.content ?? "");
  const [type, setType] = useState<string | null>(card?.type ?? null);
  const tags = useTagStore((s) => s.tags);
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
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

      {/* Type selector — pill buttons (click to toggle) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tags.map((tag) => {
          const isActive = type === tag.id;
          const styles = getTagStyles(tag.color);
          return (
            <button
              key={tag.id}
              onClick={() => setType(isActive ? null : tag.id)}
              title={tag.description ? `${tag.command ?? `/${tag.id}`} — ${tag.description}` : (tag.command ?? `/${tag.id}`)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                isActive
                  ? ""
                  : "bg-transparent text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border-color)] hover:ring-[var(--text-secondary)]/40"
              }`}
              style={isActive ? { ...styles.badge, boxShadow: `inset 0 0 0 2px ${tag.color}40` } : undefined}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]/60">
          Enter to save
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
