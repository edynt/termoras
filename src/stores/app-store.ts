import { create } from "zustand";
import type { Project, TerminalSession } from "../types";
import { pickProjectFolder, killTerminal } from "../lib/tauri-commands";
import {
  loadProjects,
  saveProjects,
  loadTerminals,
  saveTerminals,
  loadActiveIds,
  saveActiveIds,
} from "../lib/storage";

interface AppStore {
  // state
  projects: Project[];
  terminals: TerminalSession[];
  activeProjectId: string | null;
  activeTerminalId: string | null;
  activeView: "terminal" | "kanban";

  // app init
  init: () => Promise<void>;

  // project actions
  addProject: () => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string) => void;

  // view actions
  setActiveView: (view: "terminal" | "kanban") => void;

  // terminal actions
  addTerminal: (terminal: TerminalSession) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  setTerminalRunning: (id: string, running: boolean) => void;
  renameTerminal: (id: string, name: string) => void;
}

/** Persist terminals to disk (fire-and-forget) */
function persistTerminals(terminals: TerminalSession[]) {
  saveTerminals(terminals);
}

/** Persist active IDs to disk (fire-and-forget) */
function persistActiveIds(
  activeProjectId: string | null,
  activeTerminalId: string | null,
  activeView: "terminal" | "kanban" = "terminal",
) {
  saveActiveIds({ activeProjectId, activeTerminalId, activeView });
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  terminals: [],
  activeProjectId: null,
  activeTerminalId: null,
  activeView: "terminal",

  init: async () => {
    const [projects, terminals, activeIds] = await Promise.all([
      loadProjects(),
      loadTerminals(),
      loadActiveIds(),
    ]);
    set({
      projects,
      terminals,
      activeProjectId: activeIds.activeProjectId,
      activeTerminalId: activeIds.activeTerminalId,
      activeView: activeIds.activeView ?? "terminal",
    });
  },

  addProject: async () => {
    const path = await pickProjectFolder();
    if (!path) return;

    const { projects } = get();
    if (projects.some((p) => p.path === path)) return;

    const name = path.split("/").pop() || path;
    const project: Project = { id: crypto.randomUUID(), name, path };
    const updated = [...projects, project];

    // Auto-create a default terminal for the new project
    const terminal: TerminalSession = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: "Terminal 1",
      isRunning: false,
    };
    const updatedTerminals = [...get().terminals, terminal];

    set({
      projects: updated,
      activeProjectId: project.id,
      terminals: updatedTerminals,
      activeTerminalId: terminal.id,
      activeView: "terminal",
    });
    await saveProjects(updated);
    persistTerminals(updatedTerminals);
    persistActiveIds(project.id, terminal.id, "terminal");
  },

  removeProject: async (id: string) => {
    const { projects, terminals, activeProjectId, activeTerminalId } = get();
    const projectTerminals = terminals.filter((t) => t.projectId === id);
    for (const t of projectTerminals) {
      try {
        await killTerminal(t.id);
      } catch {
        /* terminal may already be dead */
      }
    }
    const updatedProjects = projects.filter((p) => p.id !== id);
    const updatedTerminals = terminals.filter((t) => t.projectId !== id);
    const removedTerminalIds = projectTerminals.map((t) => t.id);
    const newActiveProjectId =
      activeProjectId === id ? null : activeProjectId;
    const newActiveTerminalId =
      activeTerminalId && removedTerminalIds.includes(activeTerminalId)
        ? null
        : activeTerminalId;
    set({
      projects: updatedProjects,
      terminals: updatedTerminals,
      activeProjectId: newActiveProjectId,
      activeTerminalId: newActiveTerminalId,
    });
    await saveProjects(updatedProjects);
    persistTerminals(updatedTerminals);
    persistActiveIds(newActiveProjectId, newActiveTerminalId, get().activeView);
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
    persistActiveIds(id, get().activeTerminalId, get().activeView);
  },

  setActiveView: (view) => {
    set({ activeView: view });
    const { activeProjectId, activeTerminalId } = get();
    persistActiveIds(activeProjectId, activeTerminalId, view);
  },

  addTerminal: (terminal: TerminalSession) => {
    const updated = [...get().terminals, terminal];
    set({ terminals: updated, activeTerminalId: terminal.id, activeView: "terminal" });
    persistTerminals(updated);
    persistActiveIds(get().activeProjectId, terminal.id, "terminal");
  },

  removeTerminal: (id: string) => {
    const { terminals, activeTerminalId, activeProjectId, activeView } = get();
    const updated = terminals.filter((t) => t.id !== id);
    const newActiveTerminalId =
      activeTerminalId === id ? null : activeTerminalId;
    set({ terminals: updated, activeTerminalId: newActiveTerminalId });
    persistTerminals(updated);
    persistActiveIds(activeProjectId, newActiveTerminalId, activeView);
  },

  setActiveTerminal: (id: string) => {
    set({ activeTerminalId: id, activeView: "terminal" });
    persistActiveIds(get().activeProjectId, id, "terminal");
  },

  setTerminalRunning: (id: string, running: boolean) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, isRunning: running } : t,
      ),
    }));
  },

  renameTerminal: (id: string, name: string) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, name } : t,
      ),
    }));
    persistTerminals(get().terminals);
  },
}));
