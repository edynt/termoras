import { invoke, Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

/** Create a new PTY terminal session with given ID. Returns session ID. */
export async function createTerminal(
  id: string,
  projectPath: string,
  rows: number,
  cols: number,
  onData: Channel<number[]>,
): Promise<string> {
  return invoke<string>("create_terminal", { id, projectPath, rows, cols, onData });
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

/** Read raw file content (for new/untracked files) */
export async function readFileContent(path: string, filePath: string): Promise<string> {
  return invoke<string>("read_file_content", { path, filePath });
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

/** Stage specific files */
export async function gitStageFiles(path: string, files: string[]): Promise<void> {
  return invoke("git_stage_files", { path, files });
}

/** Unstage specific files */
export async function gitUnstageFiles(path: string, files: string[]): Promise<void> {
  return invoke("git_unstage_files", { path, files });
}

/** Commit with message */
export async function gitCommit(path: string, message: string): Promise<string> {
  return invoke<string>("git_commit", { path, message });
}

/** Check if there are unpushed commits */
export async function gitHasUnpushed(path: string): Promise<boolean> {
  return invoke<boolean>("git_has_unpushed", { path });
}

/** Undo last commit, keep changes staged (git reset --soft HEAD~1) */
export async function gitUndoCommit(path: string): Promise<string> {
  return invoke<string>("git_undo_commit", { path });
}

/** Revert (discard) changes for a single file */
export async function gitRevertFile(path: string, filePath: string, status: string): Promise<string> {
  return invoke<string>("git_revert_file", { path, filePath, status });
}

/** Push to remote */
export async function gitPush(path: string): Promise<string> {
  return invoke<string>("git_push", { path });
}

/** Open a directory in VS Code */
export async function openInVscode(path: string): Promise<void> {
  return invoke("open_in_vscode", { path });
}

/** Branch info for branch picker */
export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

/** List local and remote branches */
export async function gitListBranches(path: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>("git_list_branches", { path });
}

/** Result of a git merge operation */
export interface MergeResult {
  success: boolean;
  conflicts: string[];
  message: string;
}

/** Merge a branch into the current branch */
export async function gitMerge(path: string, branch: string): Promise<MergeResult> {
  return invoke<MergeResult>("git_merge", { path, branch });
}

/** Abort an in-progress merge */
export async function gitMergeAbort(path: string): Promise<string> {
  return invoke<string>("git_merge_abort", { path });
}

/** Fetch from all remotes */
export async function gitFetch(path: string): Promise<string> {
  return invoke<string>("git_fetch", { path });
}

// ── Git Stash Commands ──────────────────────────────────────────────

/** Stash entry from git stash list */
export interface StashEntry {
  index: number;
  branch: string;
  message: string;
}

/** List all git stashes */
export async function gitStashList(path: string): Promise<StashEntry[]> {
  return invoke<StashEntry[]>("git_stash_list", { path });
}

/** Stash all changes with a custom message */
export async function gitStashSave(path: string, message: string): Promise<string> {
  return invoke<string>("git_stash_save", { path, message });
}

/** Apply a stash without removing it */
export async function gitStashApply(path: string, index: number): Promise<string> {
  return invoke<string>("git_stash_apply", { path, index });
}

/** Apply and remove a stash */
export async function gitStashPop(path: string, index: number): Promise<string> {
  return invoke<string>("git_stash_pop", { path, index });
}

/** Delete a stash */
export async function gitStashDrop(path: string, index: number): Promise<string> {
  return invoke<string>("git_stash_drop", { path, index });
}

/** Get diff for a stash entry (preview) */
export async function gitStashDiff(path: string, index: number): Promise<string> {
  return invoke<string>("git_stash_diff", { path, index });
}

/** Get the foreground process name running inside a terminal's shell. */
export async function getTerminalProcessName(
  id: string,
): Promise<string | null> {
  return invoke<string | null>("get_terminal_process_name", { id });
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

/** Save base64-encoded image to temp file. Returns absolute path. */
export async function saveTempImage(
  data: string,
  extension: string,
): Promise<string> {
  return invoke<string>("save_temp_image", { data, extension });
}

/** Open native file picker for images. Returns path or null. */
export async function pickImageFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    title: "Select Image",
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"],
      },
    ],
  });
  return selected as string | null;
}
