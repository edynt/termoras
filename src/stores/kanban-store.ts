import { create } from "zustand";
import type { KanbanBoard, KanbanCard, CardType } from "../types/kanban";
import { loadBoard, saveBoard } from "../lib/kanban-storage";

function createDefaultBoard(): KanbanBoard {
  return {
    columns: [
      { id: crypto.randomUUID(), title: "Todo", cardIds: [] },
      { id: crypto.randomUUID(), title: "In Progress", cardIds: [] },
      { id: crypto.randomUUID(), title: "Done", cardIds: [] },
    ],
    cards: {},
  };
}

interface KanbanStore {
  board: KanbanBoard | null;
  projectId: string | null;

  loadBoard: (projectId: string) => Promise<void>;

  // Card actions
  addCard: (columnId: string, title: string, content: string, type: CardType) => void;
  updateCard: (cardId: string, updates: Partial<Omit<KanbanCard, "id">>) => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, fromColId: string, toColId: string, newIndex: number) => void;

  // Column actions
  addColumn: (title: string) => void;
  removeColumn: (colId: string) => void;
  renameColumn: (colId: string, title: string) => void;
}

function persist(state: KanbanStore) {
  if (state.projectId && state.board) {
    saveBoard(state.projectId, state.board);
  }
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  board: null,
  projectId: null,

  loadBoard: async (projectId: string) => {
    const existing = await loadBoard(projectId);
    const board = existing ?? createDefaultBoard();
    set({ board, projectId });
    if (!existing) {
      saveBoard(projectId, board);
    }
  },

  addCard: (columnId, title, content, type) => {
    const { board } = get();
    if (!board) return;

    const card: KanbanCard = {
      id: crypto.randomUUID(),
      title,
      content,
      type,
    };

    const newBoard: KanbanBoard = {
      cards: { ...board.cards, [card.id]: card },
      columns: board.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: [...col.cardIds, card.id] }
          : col,
      ),
    };
    set({ board: newBoard });
    persist(get());
  },

  updateCard: (cardId, updates) => {
    const { board } = get();
    if (!board || !board.cards[cardId]) return;

    const newBoard: KanbanBoard = {
      ...board,
      cards: {
        ...board.cards,
        [cardId]: { ...board.cards[cardId], ...updates },
      },
    };
    set({ board: newBoard });
    persist(get());
  },

  removeCard: (cardId) => {
    const { board } = get();
    if (!board) return;

    const { [cardId]: _, ...remainingCards } = board.cards;
    const newBoard: KanbanBoard = {
      cards: remainingCards,
      columns: board.columns.map((col) => ({
        ...col,
        cardIds: col.cardIds.filter((id) => id !== cardId),
      })),
    };
    set({ board: newBoard });
    persist(get());
  },

  moveCard: (cardId, fromColId, toColId, newIndex) => {
    const { board } = get();
    if (!board) return;

    const newBoard: KanbanBoard = {
      ...board,
      columns: board.columns.map((col) => {
        if (col.id === fromColId && fromColId === toColId) {
          // Reorder within same column
          const ids = col.cardIds.filter((id) => id !== cardId);
          ids.splice(newIndex, 0, cardId);
          return { ...col, cardIds: ids };
        }
        if (col.id === fromColId) {
          return { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) };
        }
        if (col.id === toColId) {
          const ids = [...col.cardIds];
          ids.splice(newIndex, 0, cardId);
          return { ...col, cardIds: ids };
        }
        return col;
      }),
    };
    set({ board: newBoard });
    persist(get());
  },

  addColumn: (title) => {
    const { board } = get();
    if (!board) return;

    const col = { id: crypto.randomUUID(), title, cardIds: [] as string[] };
    const newBoard: KanbanBoard = {
      ...board,
      columns: [...board.columns, col],
    };
    set({ board: newBoard });
    persist(get());
  },

  removeColumn: (colId) => {
    const { board } = get();
    if (!board) return;

    const col = board.columns.find((c) => c.id === colId);
    if (!col) return;

    // Remove column's cards from cards map
    const newCards = { ...board.cards };
    for (const cardId of col.cardIds) {
      delete newCards[cardId];
    }

    const newBoard: KanbanBoard = {
      cards: newCards,
      columns: board.columns.filter((c) => c.id !== colId),
    };
    set({ board: newBoard });
    persist(get());
  },

  renameColumn: (colId, title) => {
    const { board } = get();
    if (!board) return;

    const newBoard: KanbanBoard = {
      ...board,
      columns: board.columns.map((col) =>
        col.id === colId ? { ...col, title } : col,
      ),
    };
    set({ board: newBoard });
    persist(get());
  },
}));
