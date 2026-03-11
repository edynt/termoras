import { load } from "@tauri-apps/plugin-store";
import type { KanbanBoard, TagDefinition } from "../types/kanban";

let storeInstance: Awaited<ReturnType<typeof load>> | null = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load("clcterm-data.json");
  }
  return storeInstance;
}

export async function loadBoard(
  projectId: string,
): Promise<KanbanBoard | null> {
  try {
    const store = await getStore();
    return (await store.get<KanbanBoard>(`board:${projectId}`)) ?? null;
  } catch {
    return null;
  }
}

export async function saveBoard(
  projectId: string,
  board: KanbanBoard,
): Promise<void> {
  try {
    const store = await getStore();
    await store.set(`board:${projectId}`, board);
    await store.save();
  } catch (err) {
    console.error("Failed to save kanban board:", err);
  }
}

export async function loadTags(): Promise<TagDefinition[] | null> {
  try {
    const store = await getStore();
    return (await store.get<TagDefinition[]>("tags")) ?? null;
  } catch {
    return null;
  }
}

export async function saveTags(tags: TagDefinition[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set("tags", tags);
    await store.save();
  } catch (err) {
    console.error("Failed to save tags:", err);
  }
}
