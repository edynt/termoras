export type CardType =
  | "cook"
  | "plan"
  | "code"
  | "test"
  | "brainstorm"
  | "scout"
  | "debug"
  | "watzup";

export const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: "cook", label: "Cook" },
  { value: "plan", label: "Plan" },
  { value: "code", label: "Code" },
  { value: "test", label: "Test" },
  { value: "brainstorm", label: "Brainstorm" },
  { value: "scout", label: "Scout" },
  { value: "debug", label: "Debug" },
  { value: "watzup", label: "Watzup" },
];

export interface KanbanCard {
  id: string;
  title: string;
  content: string;
  type: CardType;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
}
