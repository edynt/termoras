import { load } from "@tauri-apps/plugin-store";
import type { Project, ThemeMode } from "../types";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("clcterm-data.json");
  }
  return storeInstance;
}

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
