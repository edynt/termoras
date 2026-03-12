/** Tag definition for customizable card types */
export interface TagDefinition {
  id: string;          // unique slug, e.g., "cook", "my-tag"
  label: string;       // display name, e.g., "Cook", "My Tag"
  color: string;       // hex color, e.g., "#3b82f6"
  description?: string; // short description, e.g., "Implement a feature step by step"
  command?: string;     // associated command, e.g., "/cook"
}

export interface KanbanCard {
  id: string;
  title: string;
  content: string;
  type: string | null;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
  autoRun?: boolean;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
}
