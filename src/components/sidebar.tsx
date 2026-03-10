import { FolderPlus } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { ProjectItem } from "./project-item";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);

  return (
    <aside className="flex flex-col h-screen border-r border-[var(--border-color)] bg-[var(--bg-sidebar)]">
      {/* header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
        <span className="text-sm font-semibold tracking-tight">Projects</span>
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

      {/* footer — theme toggle */}
      <div className="flex items-center justify-center p-2 border-t border-[var(--border-color)]">
        <ThemeToggle />
      </div>
    </aside>
  );
}
