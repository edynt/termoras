import { load } from "@tauri-apps/plugin-store";
import type { Project, TerminalSession, ThemeMode } from "../types";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("kodeck-data.json");
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

export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const store = await getStore();
    const mode = await store.get<ThemeMode>("themeMode");
    return mode ?? "system";
  } catch {
    return "system";
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    const store = await getStore();
    await store.set("themeMode", mode);
    await store.save();
  } catch (err) {
    console.error("Failed to save theme mode:", err);
  }
}
