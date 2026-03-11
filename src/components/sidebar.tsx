import { useState } from "react";
import { FolderPlus, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "../stores/app-store";
import { ProjectItem } from "./project-item";
import { ThemeToggle } from "./theme-toggle";
import { TagSettingsModal } from "./tag-settings-modal";

export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);
  const [showTagSettings, setShowTagSettings] = useState(false);

  return (
    <aside className="flex flex-col h-screen border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] select-none">
      {/* header — draggable titlebar region with traffic light padding */}
      <div
        onMouseDown={(e) => {
          // Only drag if clicking on the header itself, not on buttons
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          getCurrentWindow().startDragging();
        }}
        className="flex items-center justify-between px-3 pb-2 pt-8 border-b border-[var(--border-color)] cursor-default"
      >
        <span className="text-sm font-semibold tracking-tight pointer-events-none">Projects</span>
        <button
          onClick={addProject}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors duration-150"
          title="Add project folder"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {/* project list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FolderPlus
              size={32}
              className="mb-2 text-[var(--text-secondary)]"
            />
            <p className="text-xs text-[var(--text-secondary)]">
              Click + to add your first project
            </p>
          </div>
        ) : (
          projects.map((p) => <ProjectItem key={p.id} project={p} />)
        )}
      </div>

      {/* footer — theme toggle + settings */}
      <div className="flex items-center justify-center gap-1 p-2 border-t border-[var(--border-color)]">
        <ThemeToggle />
        <button
          onClick={() => setShowTagSettings(true)}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Tag settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {showTagSettings && (
        <TagSettingsModal onClose={() => setShowTagSettings(false)} />
      )}
    </aside>
  );
}
