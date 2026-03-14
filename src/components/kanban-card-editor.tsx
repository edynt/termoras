import { useState, useRef, useEffect } from "react";
import type { KanbanCard } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { useTagStore } from "../stores/tag-store";
import { getTagStyles } from "../lib/tag-colors";


interface Props {
  card?: KanbanCard;
  columnId?: string;
  onClose: () => void;
  /** Called with the new card ID after creation (not on edit) */
  onCardAdded?: (cardId: string) => void;
}

export function KanbanCardEditor({ card, columnId, onClose, onCardAdded }: Props) {
  const [content, setContent] = useState(card?.content ?? "");
  const [type, setType] = useState<string | null>(card?.type ?? null);
  const tags = useTagStore((s) => s.tags);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addCard = useKanbanStore((s) => s.addCard);
  const updateCard = useKanbanStore((s) => s.updateCard);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  /** Auto-resize textarea to fit content */
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(autoResize, [content]);

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) {
      onClose();
      return;
    }

    // Auto-generate title from content (first 60 chars)
    const title = trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;

    if (card) {
      updateCard(card.id, { title, content: trimmed, type });
    } else if (columnId) {
      const newId = addCard(columnId, title, trimmed, type);
      if (newId) onCardAdded?.(newId);
    }
    onClose();
  }

  /** Click outside editor → auto-save */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(e.target as Node)) {
        handleSave();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <div
      ref={editorRef}
      className="rounded-lg border border-[var(--accent-blue)]/40 bg-[var(--bg-primary)] p-3 shadow-lg"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      {/* Prompt textarea — click outside to save */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Enter prompt..."
        rows={2}
        className="w-full text-sm bg-[var(--bg-hover)] rounded-md p-2.5 border border-[var(--border-color)] outline-none resize-none mb-3 placeholder:text-[var(--text-secondary)]/60 leading-relaxed max-h-[40vh] overflow-y-auto focus:border-[var(--accent-blue)] transition-colors"
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
              className={`text-sm font-semibold px-2.5 py-1 rounded-md transition-all ${
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
        <span className="text-sm text-[var(--text-secondary)]/60">
          Click outside to save · Esc to cancel
        </span>
        <button
          onClick={handleSave}
          className="text-sm px-3.5 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:opacity-90 font-medium transition-opacity"
        >
          {card ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}
