import { create } from "zustand";
import type { TagDefinition } from "../types/kanban";
import { loadTags, saveTags } from "../lib/kanban-storage";
import { DEFAULT_TAGS, slugify, randomColor } from "../lib/tag-colors";

interface TagStore {
  tags: TagDefinition[];
  loaded: boolean;
  loading: boolean;

  loadTags: () => Promise<void>;
  addTag: (label: string, color?: string, description?: string, command?: string) => void;
  updateTag: (id: string, updates: Partial<Omit<TagDefinition, "id">>) => void;
  removeTag: (id: string) => void;
}

export const useTagStore = create<TagStore>((set, get) => ({
  tags: [],
  loaded: false,
  loading: false,

  loadTags: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;
    set({ loading: true });
    const stored = await loadTags();
    const tags = stored ?? [...DEFAULT_TAGS];
    set({ tags, loaded: true, loading: false });
    if (!stored) {
      saveTags(tags);
    }
  },

  addTag: (label, color, description, command) => {
    const { tags } = get();
    const trimmed = label.trim();
    const baseSlug = slugify(trimmed) || "tag";
    let id = baseSlug;
    let counter = 1;
    while (tags.some((t) => t.id === id)) {
      id = `${baseSlug}-${counter++}`;
    }
    const newTag: TagDefinition = { id, label: trimmed, color: color ?? randomColor() };
    if (description) newTag.description = description;
    if (command) newTag.command = command;
    const newTags = [...tags, newTag];
    set({ tags: newTags });
    saveTags(newTags);
  },

  updateTag: (id, updates) => {
    const { tags } = get();
    const newTags = tags.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ tags: newTags });
    saveTags(newTags);
  },

  removeTag: (id) => {
    const { tags } = get();
    const newTags = tags.filter((t) => t.id !== id);
    set({ tags: newTags });
    saveTags(newTags);
  },
}));
