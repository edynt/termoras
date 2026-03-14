import { useState, useRef, useCallback } from "react";
import { FolderPlus, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../stores/app-store";
import { ProjectItem } from "./project-item";
import { ThemeToggle } from "./theme-toggle";
import { TerminalStatusButton } from "./terminal-status-button";
import { TagSettingsModal } from "./tag-settings-modal";


export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);
  const reorderProjects = useAppStore((s) => s.reorderProjects);
  const [showTagSettings, setShowTagSettings] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const dragToRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((index: number) => {
    dragFromRef.current = index;
    dragToRef.current = null;
    setDraggingIndex(index);
    setDropTargetIndex(null);

    function onMove(e: PointerEvent) {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll<HTMLElement>("[data-project-index]");
      let target: number | null = null;
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          target = parseInt(item.dataset.projectIndex!, 10);
          break;
        }
      }
      dragToRef.current = target;
      setDropTargetIndex(target);
    }

    function onUp() {
      const from = dragFromRef.current;
      const to = dragToRef.current;
      if (from !== null && to !== null && from !== to) {
        reorderProjects(from, to);
      }
      dragFromRef.current = null;
      dragToRef.current = null;
      setDraggingIndex(null);
      setDropTargetIndex(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [reorderProjects]);

  return (
    <aside className="flex flex-col h-screen border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] select-none">
      {/* header — draggable titlebar region with traffic light padding */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          getCurrentWindow().startDragging();
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          getCurrentWindow().toggleMaximize();
        }}
        className="flex items-center justify-between px-3 pb-2 pt-8 border-b border-[var(--border-color)] cursor-default"
      >
        <span className="text-sm font-semibold tracking-tight pointer-events-none">Projects</span>
        <button
          onClick={addProject}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors duration-150"
          title="Add project folder"
        >
          <FolderPlus size={20} />
        </button>
      </div>

      {/* project list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FolderPlus
              size={32}
              className="mb-2 text-[var(--text-secondary)]"
            />
            <p className="text-sm text-[var(--text-secondary)]">
              Click + to add your first project
            </p>
          </div>
        ) : (
          projects.map((p, i) => (
            <ProjectItem
              key={p.id}
              project={p}
              index={i}
              isDragOver={dropTargetIndex === i && draggingIndex !== i}
              isDragging={draggingIndex === i}
              onGripPointerDown={() => startDrag(i)}
            />
          ))
        )}
      </div>

      {/* footer — terminal status, theme toggle, settings */}
      <div className="flex items-center justify-center gap-1 p-2 border-t border-[var(--border-color)]">
        <TerminalStatusButton />
        <ThemeToggle />
        <button
          onClick={() => setShowTagSettings(true)}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Tag settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {showTagSettings && (
        <TagSettingsModal onClose={() => setShowTagSettings(false)} />
      )}
    </aside>
  );
}
