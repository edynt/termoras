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

  // app init
  init: () => Promise<void>;

  // project actions
  addProject: () => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string) => void;

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
) {
  saveActiveIds({ activeProjectId, activeTerminalId });
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  terminals: [],
  activeProjectId: null,
  activeTerminalId: null,

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
    set({ projects: updated, activeProjectId: project.id });
    await saveProjects(updated);
    persistActiveIds(project.id, get().activeTerminalId);
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
    persistActiveIds(newActiveProjectId, newActiveTerminalId);
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
    persistActiveIds(id, get().activeTerminalId);
  },

  addTerminal: (terminal: TerminalSession) => {
    const updated = [...get().terminals, terminal];
    set({ terminals: updated, activeTerminalId: terminal.id });
    persistTerminals(updated);
    persistActiveIds(get().activeProjectId, terminal.id);
  },

  removeTerminal: (id: string) => {
    const { terminals, activeTerminalId, activeProjectId } = get();
    const updated = terminals.filter((t) => t.id !== id);
    const newActiveTerminalId =
      activeTerminalId === id ? null : activeTerminalId;
    set({ terminals: updated, activeTerminalId: newActiveTerminalId });
    persistTerminals(updated);
    persistActiveIds(activeProjectId, newActiveTerminalId);
  },

  setActiveTerminal: (id: string) => {
    set({ activeTerminalId: id });
    persistActiveIds(get().activeProjectId, id);
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
