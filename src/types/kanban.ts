export type CardType =
  | "cook"
  | "plan"
  | "code"
  | "test"
  | "brainstorm"
  | "scout"
  | "debug"
  | "watzup";

export const CARD_TYPES: { value: CardType; label: string; description: string }[] = [
  { value: "cook", label: "Cook", description: "Implement a feature step by step" },
  { value: "plan", label: "Plan", description: "Create an implementation plan" },
  { value: "code", label: "Code", description: "Implement code from a plan" },
  { value: "test", label: "Test", description: "Run and analyze tests" },
  { value: "brainstorm", label: "Brainstorm", description: "Brainstorm ideas" },
  { value: "scout", label: "Scout", description: "Explore the codebase" },
  { value: "debug", label: "Debug", description: "Debug and fix issues" },
  { value: "watzup", label: "Watzup", description: "Review recent changes" },
];

export interface KanbanCard {
  id: string;
  title: string;
  content: string;
  type: CardType | null;
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
