import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, MoreHorizontal, Trash2, Pencil, Zap } from "lucide-react";
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType } from "../types/kanban";
import { useKanbanStore } from "../stores/kanban-store";
import { useAutoRunStore } from "../stores/auto-run-store";
import { KanbanCard } from "./kanban-card";
import { KanbanCardEditor } from "./kanban-card-editor";

interface Props {
  column: KanbanColumnType;
  cards: KanbanCardType[];
}

export function KanbanColumn({ column, cards }: Props) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameColumn = useKanbanStore((s) => s.renameColumn);
  const removeColumn = useKanbanStore((s) => s.removeColumn);
  const toggleAutoRun = useKanbanStore((s) => s.toggleAutoRun);
  const enqueue = useAutoRunStore((s) => s.enqueue);

  const { setNodeRef } = useDroppable({ id: column.id });

  function handleTitleSave() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== column.title) {
      renameColumn(column.id, trimmed);
    } else {
      setTitleDraft(column.title);
    }
    setIsEditingTitle(false);
  }

  return (
    <>
    <div className="flex flex-col flex-1 min-w-[280px] max-h-full bg-[var(--bg-sidebar)] rounded-xl border border-[var(--border-color)]/50">
      {/* Column header */}
      <div className="relative flex items-center gap-2 px-3 py-2.5 shrink-0">
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") {
                setTitleDraft(column.title);
                setIsEditingTitle(false);
              }
            }}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        ) : (
          <span
            className="text-sm font-semibold flex-1 cursor-default"
            onDoubleClick={() => setIsEditingTitle(true)}
          >
            {column.title}
          </span>
        )}

        {/* Auto-run indicator */}
        {column.autoRun && (
          <span className="text-[var(--accent-green)]" title="Auto-run enabled">
            <Zap size={15} />
          </span>
        )}

        {/* Card count badge */}
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">
          {cards.length}
        </span>

        {/* Column menu */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-0.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          title="Column menu"
        >
          <MoreHorizontal size={18} />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-2 top-9 z-50 min-w-[130px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] py-1">
              <button
                onClick={() => { setShowMenu(false); toggleAutoRun(column.id); }}
                className={`w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] ${
                  column.autoRun ? "text-[var(--accent-green)]" : "text-[var(--text-primary)]"
                }`}
              >
                <Zap size={16} />
                {column.autoRun ? "Auto-run ON" : "Auto-run"}
              </button>
              <button
                onClick={() => { setShowMenu(false); setIsEditingTitle(true); }}
                className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <Pencil size={16} />
                Rename
              </button>
              <button
                onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                className="w-full flex items-center gap-2 text-left text-sm px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--accent-red)]"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="mx-2 border-t border-[var(--border-color)]/50" />

      {/* Card list */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-[60px]"
      >
        <SortableContext
          items={column.cardIds}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {isAddingCard && (
          <KanbanCardEditor
            columnId={column.id}
            onClose={() => setIsAddingCard(false)}
            onCardAdded={(cardId) => {
              if (column.autoRun) enqueue(cardId);
            }}
          />
        )}
      </div>

      {/* Add card button */}
      {!isAddingCard && (
        <button
          onClick={() => setIsAddingCard(true)}
          className="flex items-center justify-center gap-1.5 mx-2 mb-2 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-hover)]/50 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add card
        </button>
      )}
    </div>

    {/* Delete column confirmation modal */}
    {confirmDelete && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => setConfirmDelete(false)}
      >
        <div
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-5 w-[380px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-base font-semibold mb-2">Delete Column</p>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {column.title}
            </span>
            ? All {cards.length} card{cards.length !== 1 ? "s" : ""} in this column will be removed.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-sm px-4 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                removeColumn(column.id);
              }}
              className="text-sm px-4 py-2 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
