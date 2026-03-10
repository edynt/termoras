import { create } from "zustand";
import type { Project, TerminalSession } from "../types";
import { pickProjectFolder, killTerminal } from "../lib/tauri-commands";
import { loadProjects, saveProjects } from "../lib/storage";

interface AppStore {
  // state
  projects: Project[];
  terminals: TerminalSession[];
  activeProjectId: string | null;
  activeTerminalId: string | null;

  // project actions
  initProjects: () => Promise<void>;
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

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  terminals: [],
  activeProjectId: null,
  activeTerminalId: null,

  initProjects: async () => {
    const projects = await loadProjects();
    set({ projects });
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
    set({
      projects: updatedProjects,
      terminals: updatedTerminals,
      activeProjectId: activeProjectId === id ? null : activeProjectId,
      activeTerminalId:
        activeTerminalId && removedTerminalIds.includes(activeTerminalId)
          ? null
          : activeTerminalId,
    });
    await saveProjects(updatedProjects);
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  },

  addTerminal: (terminal: TerminalSession) => {
    set((state) => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.id,
    }));
  },

  removeTerminal: (id: string) => {
    set((state) => ({
      terminals: state.terminals.filter((t) => t.id !== id),
      activeTerminalId:
        state.activeTerminalId === id ? null : state.activeTerminalId,
    }));
  },

  setActiveTerminal: (id: string) => {
    set({ activeTerminalId: id });
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
  },
}));
