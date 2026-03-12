import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { Plus, LayoutGrid, Columns3 } from "lucide-react";
import { useKanbanStore } from "../stores/kanban-store";
import { useAppStore } from "../stores/app-store";
import { useTagStore } from "../stores/tag-store";
import { useAutoRunStore } from "../stores/auto-run-store";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";

export function KanbanBoard() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projects = useAppStore((s) => s.projects);
  const board = useKanbanStore((s) => s.board);
  const projectId = useKanbanStore((s) => s.projectId);
  const loadBoard = useKanbanStore((s) => s.loadBoard);
  const moveCard = useKanbanStore((s) => s.moveCard);
  const addColumn = useKanbanStore((s) => s.addColumn);

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  /** Track which column the card was dragged FROM to detect auto-run column entry */
  const [dragSourceColId, setDragSourceColId] = useState<string | null>(null);
  const enqueue = useAutoRunStore((s) => s.enqueue);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const tagLoaded = useTagStore((s) => s.loaded);

  // Load tags once on mount
  useEffect(() => {
    if (!tagLoaded) {
      useTagStore.getState().loadTags();
    }
  }, [tagLoaded]);

  // Load board when project changes — clear auto-run queue
  useEffect(() => {
    if (activeProjectId && activeProjectId !== projectId) {
      loadBoard(activeProjectId);
      useAutoRunStore.getState().clearAll();
    }
  }, [activeProjectId, projectId, loadBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function findColumnByCardId(cardId: string) {
    return board?.columns.find((col) => col.cardIds.includes(cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    const cardId = event.active.id as string;
    setActiveCardId(cardId);
    // Remember source column for auto-run detection on drop
    const sourceCol = findColumnByCardId(cardId);
    setDragSourceColId(sourceCol?.id ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!board) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromCol = findColumnByCardId(activeId);
    const toCol =
      findColumnByCardId(overId) ??
      board.columns.find((c) => c.id === overId);

    if (!fromCol || !toCol || fromCol.id === toCol.id) return;

    const overIndex = toCol.cardIds.indexOf(overId);
    const newIndex = overIndex >= 0 ? overIndex : toCol.cardIds.length;
    moveCard(activeId, fromCol.id, toCol.id, newIndex);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!board) return;
    const { active, over } = event;
    const cardId = active.id as string;
    const sourceColId = dragSourceColId;
    setActiveCardId(null);
    setDragSourceColId(null);
    if (!over) return;

    const overId = over.id as string;
    if (cardId === overId) return;

    const col = findColumnByCardId(cardId);
    if (!col) return;

    if (col.cardIds.includes(overId)) {
      const oldIndex = col.cardIds.indexOf(cardId);
      const newIndex = col.cardIds.indexOf(overId);
      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(col.cardIds, oldIndex, newIndex);
        moveCard(cardId, col.id, col.id, newOrder.indexOf(cardId));
      }
    }

    // Auto-run: if card landed in a different auto-run column, enqueue it
    if (sourceColId && col.id !== sourceColId && col.autoRun) {
      enqueue(cardId);
    }
  }

  const activeCard =
    activeCardId && board ? board.cards[activeCardId] : null;

  // Empty state — no board loaded yet
  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--bg-primary)] gap-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
          <LayoutGrid size={24} className="text-[var(--text-secondary)]" />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Loading board...</p>
      </div>
    );
  }

  // Count total cards
  const totalCards = Object.keys(board.cards).length;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Board header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[var(--accent-blue)]/15 flex items-center justify-center">
            <LayoutGrid size={15} className="text-[var(--accent-blue)]" />
          </div>
          <div>
            <span className="text-sm font-semibold">
              {activeProject?.name ?? "Board"}
            </span>
            <span className="text-xs text-[var(--text-secondary)] ml-2">
              {board.columns.length} columns · {totalCards} cards
            </span>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => addColumn("New Column")}
          className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Plus size={15} />
          Column
        </button>
      </div>

      {/* Columns area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full">
            {board.columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={col.cardIds
                  .map((id) => board.cards[id])
                  .filter(Boolean)}
              />
            ))}

            {/* Empty state hint when no columns */}
            {board.columns.length === 0 && (
              <div className="flex flex-col items-center justify-center w-full gap-3 text-[var(--text-secondary)]">
                <Columns3 size={32} strokeWidth={1.5} />
                <p className="text-sm">No columns yet. Add one to get started.</p>
              </div>
            )}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeCard ? (
              <KanbanCard card={activeCard} isDragOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
