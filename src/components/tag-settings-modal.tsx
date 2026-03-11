import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useTagStore } from "../stores/tag-store";
import { COLOR_PALETTE, getTagStyles, randomColor } from "../lib/tag-colors";
import type { TagDefinition } from "../types/kanban";

interface Props {
  onClose: () => void;
}

export function TagSettingsModal({ onClose }: Props) {
  const tags = useTagStore((s) => s.tags);
  const addTag = useTagStore((s) => s.addTag);
  const updateTag = useTagStore((s) => s.updateTag);
  const removeTag = useTagStore((s) => s.removeTag);
  const [paletteOpenFor, setPaletteOpenFor] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="w-[420px] max-h-[80vh] flex flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold">Tag Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {tags.map((tag) => {
            const styles = getTagStyles(tag.color);
            return (
              <div key={tag.id}>
                <TagRow
                  tag={tag}
                  styles={styles}
                  isPaletteOpen={paletteOpenFor === tag.id}
                  onTogglePalette={() =>
                    setPaletteOpenFor(paletteOpenFor === tag.id ? null : tag.id)
                  }
                  onUpdate={(updates) => updateTag(tag.id, updates)}
                  onDelete={() => removeTag(tag.id)}
                />
              </div>
            );
          })}
        </div>

        {/* Add tag button */}
        <div className="px-4 py-3 border-t border-[var(--border-color)]">
          <button
            onClick={() => addTag("New Tag", randomColor())}
            className="flex items-center gap-1.5 w-full justify-center py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-hover)]/50 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add Tag
          </button>
        </div>
      </div>
    </div>
  );
}

/** Single tag row with inline editing, description, command, color picker */
function TagRow({
  tag,
  styles,
  isPaletteOpen,
  onTogglePalette,
  onUpdate,
  onDelete,
}: {
  tag: TagDefinition;
  styles: ReturnType<typeof getTagStyles>;
  isPaletteOpen: boolean;
  onTogglePalette: () => void;
  onUpdate: (updates: Partial<Omit<TagDefinition, "id">>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(tag.label);
  const [description, setDescription] = useState(tag.description ?? "");
  const [command, setCommand] = useState(tag.command ?? "");

  function handleLabelBlur() {
    const trimmed = label.trim();
    if (trimmed && trimmed !== tag.label) {
      onUpdate({ label: trimmed });
    } else {
      setLabel(tag.label);
    }
  }

  function handleDescriptionBlur() {
    const trimmed = description.trim();
    if (trimmed !== (tag.description ?? "")) {
      onUpdate({ description: trimmed || undefined });
    }
  }

  function handleCommandBlur() {
    const trimmed = command.trim();
    if (trimmed !== (tag.command ?? "")) {
      onUpdate({ command: trimmed || undefined });
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 py-1.5 group">
        {/* Color dot — clickable */}
        <button
          onClick={onTogglePalette}
          className="w-5 h-5 rounded-full shrink-0 hover:ring-2 hover:ring-offset-1 hover:ring-[var(--text-secondary)]/30 transition-all cursor-pointer"
          style={styles.bar}
          title="Change color"
        />
        {/* Label input */}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          maxLength={30}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setLabel(tag.label);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="flex-1 text-xs font-medium bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] transition-colors"
        />
        {/* Delete button */}
        <button
          onClick={onDelete}
          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-all"
          title="Delete tag"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Description + command fields — always visible */}
      <div className="pl-7 pr-2 pb-2 space-y-1.5">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          maxLength={100}
          placeholder="Description..."
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)]/50 rounded px-2 py-1 border-none outline-none placeholder:text-[var(--text-secondary)]/40 focus:bg-[var(--bg-hover)] transition-colors"
        />
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onBlur={handleCommandBlur}
          maxLength={100}
          placeholder="Command (e.g. /cook)..."
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-hover)]/50 rounded px-2 py-1 border-none outline-none placeholder:text-[var(--text-secondary)]/40 focus:bg-[var(--bg-hover)] transition-colors"
        />
      </div>

      {/* Color palette — inline below row */}
      {isPaletteOpen && (
        <div className="grid grid-cols-6 gap-1.5 py-2 px-8">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              onClick={() => onUpdate({ color: c.hex })}
              className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${
                tag.color === c.hex ? "ring-2 ring-offset-1 ring-[var(--text-primary)]" : ""
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      )}
    </>
  );
}
