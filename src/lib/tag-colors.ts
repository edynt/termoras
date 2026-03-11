import type { CSSProperties } from "react";
import type { TagDefinition } from "../types/kanban";

/** 12-color preset palette */
export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: "blue", hex: "#3b82f6" },
  { name: "purple", hex: "#a855f7" },
  { name: "emerald", hex: "#10b981" },
  { name: "amber", hex: "#f59e0b" },
  { name: "orange", hex: "#f97316" },
  { name: "cyan", hex: "#06b6d4" },
  { name: "red", hex: "#ef4444" },
  { name: "slate", hex: "#64748b" },
  { name: "pink", hex: "#ec4899" },
  { name: "lime", hex: "#84cc16" },
  { name: "indigo", hex: "#6366f1" },
  { name: "teal", hex: "#14b8a6" },
];

/** Default tags matching slash commands */
export const DEFAULT_TAGS: TagDefinition[] = [
  { id: "bootstrap", label: "Bootstrap", color: "#6366f1", description: "Initialize a new project", command: "/bootstrap" },
  { id: "cook", label: "Cook", color: "#3b82f6", description: "Implement a feature step by step", command: "/cook" },
  { id: "plan", label: "Plan", color: "#a855f7", description: "Create an implementation plan", command: "/plan" },
  { id: "code", label: "Code", color: "#10b981", description: "Implement code from a plan", command: "/code" },
  { id: "test", label: "Test", color: "#f59e0b", description: "Run and analyze tests", command: "/test" },
  { id: "brainstorm", label: "Brainstorm", color: "#f97316", description: "Brainstorm ideas", command: "/brainstorm" },
  { id: "scout", label: "Scout", color: "#06b6d4", description: "Explore the codebase", command: "/scout" },
  { id: "debug", label: "Debug", color: "#ef4444", description: "Debug and fix issues", command: "/debug" },
  { id: "watzup", label: "Watzup", color: "#64748b", description: "Review recent changes", command: "/watzup" },
];

/** Runtime CSS style objects generated from hex color */
export function getTagStyles(hex: string) {
  return {
    bar: { backgroundColor: hex } as CSSProperties,
    badge: {
      backgroundColor: `${hex}14`,
      color: hex,
      boxShadow: `inset 0 0 0 1px ${hex}40`,
    } as CSSProperties,
  };
}

/** Fallback style for cards with no tag or deleted tag */
export const UNTAGGED_STYLES = getTagStyles("#a3a3a3");

/** Generate a slug from label: lowercase, alphanumeric + hyphens only */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Pick a random color from the palette */
export function randomColor(): string {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex;
}
