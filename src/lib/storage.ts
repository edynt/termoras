import { load } from "@tauri-apps/plugin-store";
import type { Project, TerminalSession } from "../types";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("termoras-data.json");
  }
  return storeInstance;
}

// --- Projects ---

export async function loadProjects(): Promise<Project[]> {
  try {
    const store = await getStore();
    const projects = await store.get<Project[]>("projects");
    return projects ?? [];
  } catch {
    return [];
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set("projects", projects);
    await store.save();
  } catch (err) {
    console.error("Failed to save projects:", err);
  }
}

// --- Terminals ---

export async function loadTerminals(): Promise<TerminalSession[]> {
  try {
    const store = await getStore();
    const terminals = await store.get<TerminalSession[]>("terminals");
    // Reset isRunning — PTY sessions don't survive app restart
    return (terminals ?? []).map((t) => ({ ...t, isRunning: false }));
  } catch {
    return [];
  }
}

export async function saveTerminals(
  terminals: TerminalSession[],
): Promise<void> {
  try {
    const store = await getStore();
    await store.set("terminals", terminals);
    await store.save();
  } catch (err) {
    console.error("Failed to save terminals:", err);
  }
}

// --- Active IDs ---

interface ActiveIds {
  activeProjectId: string | null;
  activeTerminalId: string | null;
  activeView?: "terminal" | "kanban" | "git";
}

export async function loadActiveIds(): Promise<ActiveIds> {
  try {
    const store = await getStore();
    const ids = await store.get<ActiveIds>("activeIds");
    return ids ?? { activeProjectId: null, activeTerminalId: null, activeView: "terminal" };
  } catch {
    return { activeProjectId: null, activeTerminalId: null, activeView: "terminal" };
  }
}

export async function saveActiveIds(ids: ActiveIds): Promise<void> {
  try {
    const store = await getStore();
    await store.set("activeIds", ids);
    await store.save();
  } catch (err) {
    console.error("Failed to save active IDs:", err);
  }
}

// --- Last Terminal per Project ---

export async function loadLastTerminalMap(): Promise<Record<string, string>> {
  try {
    const store = await getStore();
    const map = await store.get<Record<string, string>>("lastTerminalByProject");
    return map ?? {};
  } catch {
    return {};
  }
}

export async function saveLastTerminalMap(map: Record<string, string>): Promise<void> {
  try {
    const store = await getStore();
    await store.set("lastTerminalByProject", map);
    await store.save();
  } catch (err) {
    console.error("Failed to save last terminal map:", err);
  }
}

