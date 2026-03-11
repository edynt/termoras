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

/** Check if a directory is a git repository */
export async function isGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>("is_git_repo", { path });
}

/** Git status summary */
export interface GitStatusSummary {
  branch: string;
  staged: number;
  modified: number;
  untracked: number;
}

/** Get git status summary for a project */
export async function gitStatusSummary(path: string): Promise<GitStatusSummary> {
  return invoke<GitStatusSummary>("git_status_summary", { path });
}

/** Changed file entry */
export interface GitChangedFile {
  path: string;
  status: string;
  staged: boolean;
}

/** Get list of changed files */
export async function gitChangedFiles(path: string): Promise<GitChangedFile[]> {
  return invoke<GitChangedFile[]>("git_changed_files", { path });
}

/** Get diff for a specific file */
export async function gitFileDiff(path: string, filePath: string, staged: boolean): Promise<string> {
  return invoke<string>("git_file_diff", { path, filePath, staged });
}

/** Get the most recent commit message */
export async function gitLastCommitMessage(path: string): Promise<string> {
  return invoke<string>("git_last_commit_message", { path });
}

/** Stage all changes */
export async function gitStageAll(path: string): Promise<void> {
  return invoke("git_stage_all", { path });
}

/** Commit with message */
export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke<string>("git_commit", { path, message });
}

/** Push to remote */
export async function gitPush(path: string): Promise<string> {
  return invoke<string>("git_push", { path });
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
