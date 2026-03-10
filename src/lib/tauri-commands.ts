import { invoke, Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/** Create a new PTY terminal session with given ID. Returns session ID. */
export async function createTerminal(
  id: string,
  projectPath: string,
  onData: Channel<number[]>,
): Promise<string> {
  return invoke<string>("create_terminal", { id, projectPath, onData });
}

/** Write user input to terminal PTY stdin */
export async function writeTerminal(
  id: string,
  data: string,
): Promise<void> {
  return invoke("write_terminal", { id, data });
}

/** Resize terminal PTY */
export async function resizeTerminal(
  id: string,
  rows: number,
  cols: number,
): Promise<void> {
  return invoke("resize_terminal", { id, rows, cols });
}

/** Kill a terminal session */
export async function killTerminal(id: string): Promise<void> {
  return invoke("kill_terminal", { id });
}

/** Open native folder picker. Returns path or null. */
export async function pickProjectFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Project Folder",
  });
  return selected as string | null;
}
