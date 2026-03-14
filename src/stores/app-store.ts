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
  loadLastTerminalMap,
  saveLastTerminalMap,
} from "../lib/storage";

interface AppStore {
  // state
  projects: Project[];
  terminals: TerminalSession[];
  activeProjectId: string | null;
  activeTerminalId: string | null;
  activeView: "terminal" | "kanban" | "git";
  lastTerminalByProject: Record<string, string>;
  vietnameseInput: boolean;
  /** Per-terminal flag: true when the terminal is waiting for user input */
  terminalQuestioning: Record<string, boolean>;

  // app init
  init: () => Promise<void>;

  // project actions
  addProject: () => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => void;
  setProjectColor: (id: string, color: string | undefined) => void;
  reorderProjects: (fromIndex: number, toIndex: number) => void;
  setActiveProject: (id: string) => void;

  // view actions
  setActiveView: (view: "terminal" | "kanban" | "git") => void;
  toggleVietnameseInput: () => void;

  // terminal actions
  addTerminal: (terminal: TerminalSession) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  /** Set active terminal without switching view (for running commands in split view) */
  setActiveTerminalInPlace: (id: string) => void;
  setTerminalRunning: (id: string, running: boolean) => void;
  setTerminalQuestioning: (id: string, questioning: boolean) => void;
  renameTerminal: (id: string, name: string) => void;
  reorderTerminals: (fromId: string, toId: string) => void;
}

/** Persist terminals to disk (fire-and-forget) */
function persistTerminals(terminals: TerminalSession[]) {
  saveTerminals(terminals);
}

/** Persist last-terminal-per-project map (fire-and-forget) */
function persistLastTerminalMap(map: Record<string, string>) {
  saveLastTerminalMap(map);
}

/** Persist active IDs to disk (fire-and-forget) */
function persistActiveIds(
  activeProjectId: string | null,
  activeTerminalId: string | null,
  activeView: "terminal" | "kanban" | "git" = "terminal",
) {
  saveActiveIds({ activeProjectId, activeTerminalId, activeView });
}

export const useAppStore = create<AppStore>((set, get) => ({
  projects: [],
  terminals: [],
  activeProjectId: null,
  activeTerminalId: null,
  activeView: "terminal",
  lastTerminalByProject: {},
  vietnameseInput: (() => { try { return localStorage.getItem("termoras:vi-input") === "true"; } catch { return false; } })(),
  terminalQuestioning: {},

  init: async () => {
    const [projects, terminals, activeIds, lastTerminalByProject] = await Promise.all([
      loadProjects(),
      loadTerminals(),
      loadActiveIds(),
      loadLastTerminalMap(),
    ]);
    set({
      projects,
      terminals,
      activeProjectId: activeIds.activeProjectId,
      activeTerminalId: activeIds.activeTerminalId,
      activeView: activeIds.activeView ?? "terminal",
      lastTerminalByProject,
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
      name: "Terminal",
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
    // Clean up remembered terminal for deleted project
    const { lastTerminalByProject } = get();
    const updatedMap = { ...lastTerminalByProject };
    delete updatedMap[id];
    set({
      projects: updatedProjects,
      terminals: updatedTerminals,
      activeProjectId: newActiveProjectId,
      activeTerminalId: newActiveTerminalId,
      lastTerminalByProject: updatedMap,
    });
    await saveProjects(updatedProjects);
    persistTerminals(updatedTerminals);
    persistLastTerminalMap(updatedMap);
    persistActiveIds(newActiveProjectId, newActiveTerminalId, get().activeView);
  },

  renameProject: (id, name) => {
    const { projects } = get();
    const updated = projects.map((p) => (p.id === id ? { ...p, name } : p));
    set({ projects: updated });
    saveProjects(updated);
  },

  setProjectColor: (id, color) => {
    const { projects } = get();
    const updated = projects.map((p) => (p.id === id ? { ...p, color } : p));
    set({ projects: updated });
    saveProjects(updated);
  },

  reorderProjects: (fromIndex, toIndex) => {
    const { projects } = get();
    if (fromIndex === toIndex) return;
    const updated = [...projects];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    set({ projects: updated });
    saveProjects(updated);
  },

  setActiveProject: (id: string) => {
    const { terminals, lastTerminalByProject, activeTerminalId, activeView } = get();
    // Restore last-used terminal for this project, fallback to first terminal
    const remembered = lastTerminalByProject[id];
    const terminalExists = remembered && terminals.some((t) => t.id === remembered);
    const fallback = terminals.find((t) => t.projectId === id)?.id ?? null;
    const newTerminalId = terminalExists ? remembered : fallback;
    set({ activeProjectId: id, activeTerminalId: newTerminalId });
    persistActiveIds(id, newTerminalId, activeView);
  },

  setActiveView: (view) => {
    set({ activeView: view });
    const { activeProjectId, activeTerminalId } = get();
    persistActiveIds(activeProjectId, activeTerminalId, view);
  },

  toggleVietnameseInput: () => {
    set((s) => {
      const next = !s.vietnameseInput;
      localStorage.setItem("termoras:vi-input", String(next));
      return { vietnameseInput: next };
    });
  },

  addTerminal: (terminal: TerminalSession) => {
    const { activeView } = get();
    const updated = [...get().terminals, terminal];
    // Keep current view — don't force switch to terminal tab
    set({ terminals: updated, activeTerminalId: terminal.id });
    persistTerminals(updated);
    persistActiveIds(get().activeProjectId, terminal.id, activeView);
    // Notify MainPanel to open the terminal panel (for split view)
    window.dispatchEvent(new CustomEvent("termoras:open-terminal-panel"));
  },

  removeTerminal: (id: string) => {
    const { terminals, activeTerminalId, activeProjectId, activeView, lastTerminalByProject } = get();
    const removed = terminals.find((t) => t.id === id);
    const updated = terminals.filter((t) => t.id !== id);
    const newActiveTerminalId =
      activeTerminalId === id ? null : activeTerminalId;
    // Clean up remembered terminal if it was the deleted one
    const updatedMap = { ...lastTerminalByProject };
    if (removed && updatedMap[removed.projectId] === id) {
      const fallback = updated.find((t) => t.projectId === removed.projectId)?.id;
      if (fallback) updatedMap[removed.projectId] = fallback;
      else delete updatedMap[removed.projectId];
      persistLastTerminalMap(updatedMap);
    }
    set({ terminals: updated, activeTerminalId: newActiveTerminalId, lastTerminalByProject: updatedMap });
    persistTerminals(updated);
    persistActiveIds(activeProjectId, newActiveTerminalId, activeView);
  },

  setActiveTerminal: (id: string) => {
    const { terminals, lastTerminalByProject } = get();
    const terminal = terminals.find((t) => t.id === id);
    if (terminal) {
      const updated = { ...lastTerminalByProject, [terminal.projectId]: id };
      set({ activeProjectId: terminal.projectId, activeTerminalId: id, activeView: "terminal", lastTerminalByProject: updated });
      persistLastTerminalMap(updated);
    } else {
      set({ activeTerminalId: id, activeView: "terminal" });
    }
    persistActiveIds(get().activeProjectId, id, "terminal");
  },

  setActiveTerminalInPlace: (id: string) => {
    const { terminals, lastTerminalByProject, activeView } = get();
    const terminal = terminals.find((t) => t.id === id);
    if (terminal) {
      const updated = { ...lastTerminalByProject, [terminal.projectId]: id };
      set({ activeTerminalId: id, lastTerminalByProject: updated });
      persistLastTerminalMap(updated);
    } else {
      set({ activeTerminalId: id });
    }
    persistActiveIds(get().activeProjectId, id, activeView);
  },

  setTerminalRunning: (id: string, running: boolean) => {
    set((state) => ({
      terminals: state.terminals.map((t) =>
        t.id === id ? { ...t, isRunning: running } : t,
      ),
    }));
  },

  setTerminalQuestioning: (id: string, questioning: boolean) => {
    set((state) => ({
      terminalQuestioning: { ...state.terminalQuestioning, [id]: questioning },
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

  reorderTerminals: (fromId: string, toId: string) => {
    const { terminals } = get();
    const fromIdx = terminals.findIndex((t) => t.id === fromId);
    const toIdx = terminals.findIndex((t) => t.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const updated = [...terminals];
    const [moved] = updated.splice(fromIdx, 1);
    // Insert before the target's current position
    const insertIdx = updated.findIndex((t) => t.id === toId);
    updated.splice(insertIdx, 0, moved);
    set({ terminals: updated });
    persistTerminals(updated);
  },
}));
