use std::path::Path;
use std::process::Command;

/// Check if a directory is a git repository
#[tauri::command]
pub fn is_git_repo(path: String) -> bool {
    Path::new(&path).join(".git").exists()
}

/// Git status summary: counts of staged, modified, untracked files
#[derive(serde::Serialize)]
pub struct GitStatusSummary {
    pub branch: String,
    pub staged: u32,
    pub modified: u32,
    pub untracked: u32,
}

/// Get git status summary for a project directory
#[tauri::command]
pub fn git_status_summary(path: String) -> Result<GitStatusSummary, String> {
    // Get current branch
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    let branch = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    // Get porcelain status for machine-readable parsing
    let status_output = Command::new("git")
        .args(["status", "--porcelain=v1"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);

    let mut staged = 0u32;
    let mut modified = 0u32;
    let mut untracked = 0u32;

    for line in status_text.lines() {
        if line.len() < 2 {
            continue;
        }
        let x = line.as_bytes()[0]; // index (staged) status
        let y = line.as_bytes()[1]; // worktree status

        // Untracked
        if x == b'?' {
            untracked += 1;
            continue;
        }
        // Staged changes (added, modified, deleted, renamed in index)
        if x != b' ' && x != b'?' {
            staged += 1;
        }
        // Worktree modifications
        if y != b' ' && y != b'?' {
            modified += 1;
        }
    }

    Ok(GitStatusSummary {
        branch,
        staged,
        modified,
        untracked,
    })
}

/// Changed file entry for diff view
#[derive(serde::Serialize)]
pub struct GitChangedFile {
    pub path: String,
    pub status: String, // "M" modified, "A" added, "D" deleted, "?" untracked, "R" renamed
    pub staged: bool,
}

/// Get list of changed files with their status
#[tauri::command]
pub fn git_changed_files(path: String) -> Result<Vec<GitChangedFile>, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v1"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut files: Vec<GitChangedFile> = Vec::new();

    for line in text.lines() {
        if line.len() < 4 {
            continue;
        }
        let x = line.as_bytes()[0] as char; // index status
        let y = line.as_bytes()[1] as char; // worktree status
        let file_path = line[3..].to_string();

        // Staged change
        if x != ' ' && x != '?' {
            files.push(GitChangedFile {
                path: file_path.clone(),
                status: x.to_string(),
                staged: true,
            });
        }
        // Worktree change
        if y != ' ' && y != '?' {
            files.push(GitChangedFile {
                path: file_path,
                status: if x == '?' { "?".to_string() } else { y.to_string() },
                staged: false,
            });
        } else if x == '?' {
            files.push(GitChangedFile {
                path: file_path,
                status: "?".to_string(),
                staged: false,
            });
        }
    }

    Ok(files)
}

/// Read raw file content (for new/untracked files that have no diff)
#[tauri::command]
pub fn read_file_content(path: String, file_path: String) -> Result<String, String> {
    let full = Path::new(&path).join(&file_path);
    std::fs::read_to_string(&full)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Get diff for a specific file
#[tauri::command]
pub fn git_file_diff(path: String, file_path: String, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(&file_path);

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get the most recent commit message
#[tauri::command]
pub fn git_last_commit_message(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["log", "-1", "--pretty=%s"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Stage all changes (git add -A)
#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Stage specific files (git add <files...>)
#[tauri::command]
pub fn git_stage_files(path: String, files: Vec<String>) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }
    let mut args = vec!["add", "--"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Unstage specific files (git reset HEAD <files...>)
#[tauri::command]
pub fn git_unstage_files(path: String, files: Vec<String>) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }
    let mut args = vec!["reset", "HEAD", "--"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);

    let output = Command::new("git")
        .args(&args)
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git reset: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Commit with message (git commit -m "...")
#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["commit", "-m", &message])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Check if there are unpushed commits (ahead of remote)
#[tauri::command]
pub fn git_has_unpushed(path: String) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["rev-list", "--count", "@{u}..HEAD"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git rev-list: {}", e))?;

    // If no upstream is set, rev-list will fail — treat as "no unpushed"
    if !output.status.success() {
        return Ok(false);
    }

    let count: u32 = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap_or(0);
    Ok(count > 0)
}

/// Undo the last commit, keeping changes staged (git reset --soft HEAD~1)
#[tauri::command]
pub fn git_undo_commit(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["reset", "--soft", "HEAD~1"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git reset: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok("Commit undone. Changes are back in staging.".to_string())
}

/// Revert (discard) changes for a single file.
/// - Untracked ("?"): deletes the file from disk
/// - Tracked (M/D/A): restores from HEAD; newly-added staged files use git rm -f
#[tauri::command]
pub fn git_revert_file(path: String, file_path: String, status: String) -> Result<String, String> {
    let repo_path = Path::new(&path);

    // Untracked file — just delete
    if status == "?" {
        let full = repo_path.join(&file_path);
        if full.is_dir() {
            std::fs::remove_dir_all(&full)
                .map_err(|e| format!("Failed to delete: {}", e))?;
        } else {
            std::fs::remove_file(&full)
                .map_err(|e| format!("Failed to delete: {}", e))?;
        }
        return Ok(format!("Deleted {}", file_path));
    }

    // Tracked file — restore from HEAD
    let output = Command::new("git")
        .args(["checkout", "HEAD", "--", &file_path])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        return Ok(format!("Reverted {}", file_path));
    }

    // Fallback for staged new files (status "A") — remove from index + working tree
    let output2 = Command::new("git")
        .args(["rm", "-f", "--", &file_path])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git rm: {}", e))?;

    if output2.status.success() {
        return Ok(format!("Removed {}", file_path));
    }

    Err(format!(
        "Failed to revert: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

/// Push to remote (git push) — async fn so Tauri v2 runs it on the
/// tokio thread pool instead of blocking the main/UI thread.
#[tauri::command]
pub async fn git_push(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["push"])
        // Prevent git from prompting for credentials (no TTY available).
        // Auth should be handled by SSH agent or credential helper.
        .env("GIT_TERMINAL_PROMPT", "0")
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    // git push writes progress info to stderr even on success
    Ok(String::from_utf8_lossy(&output.stderr).to_string())
}

/// Branch info for the branch picker
#[derive(serde::Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

/// List local and remote branches
#[tauri::command]
pub fn git_list_branches(path: String) -> Result<Vec<BranchInfo>, String> {
    let output = Command::new("git")
        .args(["branch", "-a", "--no-color"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git branch: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut branches: Vec<BranchInfo> = Vec::new();
    let mut seen_remote_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    // First pass: collect local branches
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let is_current = trimmed.starts_with('*');
        let name = trimmed.trim_start_matches('*').trim().to_string();

        // Skip HEAD pointer (e.g., "remotes/origin/HEAD -> origin/main")
        if name.contains("->") {
            continue;
        }

        if name.starts_with("remotes/") {
            continue; // Handle remote branches in second pass
        }

        seen_remote_names.insert(name.clone());
        branches.push(BranchInfo {
            name,
            is_current,
            is_remote: false,
        });
    }

    // Second pass: collect remote branches (skip if local equivalent exists)
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains("->") {
            continue;
        }
        let name = trimmed.trim_start_matches('*').trim();
        if !name.starts_with("remotes/") {
            continue;
        }
        // Strip "remotes/" prefix for display (keep origin/branch format)
        let short_name = name.strip_prefix("remotes/").unwrap_or(name).to_string();
        // Skip if we already have the local branch
        // e.g., skip "origin/main" if "main" exists locally
        let local_equivalent = short_name
            .split('/')
            .skip(1)
            .collect::<Vec<&str>>()
            .join("/");
        if seen_remote_names.contains(&local_equivalent) {
            continue;
        }
        branches.push(BranchInfo {
            name: short_name,
            is_current: false,
            is_remote: true,
        });
    }

    Ok(branches)
}

/// Result of a git merge operation
#[derive(serde::Serialize)]
pub struct MergeResult {
    pub success: bool,
    pub conflicts: Vec<String>,
    pub message: String,
}

/// Merge a branch into the current branch
#[tauri::command]
pub async fn git_merge(path: String, branch: String) -> Result<MergeResult, String> {
    let output = Command::new("git")
        .args(["merge", &branch])
        .env("GIT_TERMINAL_PROMPT", "0")
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git merge: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        return Ok(MergeResult {
            success: true,
            conflicts: vec![],
            message: stdout,
        });
    }

    // Check for merge conflicts — list unmerged files
    let unmerged = Command::new("git")
        .args(["diff", "--name-only", "--diff-filter=U"])
        .current_dir(&path)
        .output()
        .ok();

    let conflicts: Vec<String> = unmerged
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| l.to_string())
                .collect()
        })
        .unwrap_or_default();

    if !conflicts.is_empty() {
        return Ok(MergeResult {
            success: false,
            conflicts,
            message: format!("Merge conflicts detected.\n{}", stderr),
        });
    }

    // Non-conflict merge failure
    Err(format!("Merge failed: {}", stderr))
}

/// Abort an in-progress merge (git merge --abort)
#[tauri::command]
pub fn git_merge_abort(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["merge", "--abort"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git merge --abort: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok("Merge aborted.".to_string())
}

// ── Git Stash Commands ──────────────────────────────────────────────

/// Stash entry returned by git_stash_list
#[derive(serde::Serialize)]
pub struct StashEntry {
    pub index: usize,
    pub branch: String,
    pub message: String,
}

/// List all git stashes
#[tauri::command]
pub fn git_stash_list(path: String) -> Result<Vec<StashEntry>, String> {
    let output = Command::new("git")
        .args(["stash", "list"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash list: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<StashEntry> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Format: "stash@{N}: On <branch>: <message>"
        // or:     "stash@{N}: WIP on <branch>: <message>"
        let index = match trimmed.find('{').and_then(|start| {
            trimmed[start + 1..]
                .find('}')
                .and_then(|end| trimmed[start + 1..start + 1 + end].parse::<usize>().ok())
        }) {
            Some(i) => i,
            None => continue, // skip malformed lines
        };

        // Everything after "}: "
        let rest = trimmed
            .find("}: ")
            .map(|i| &trimmed[i + 3..])
            .unwrap_or("");

        // Parse "On <branch>: <message>" or "WIP on <branch>: <message>"
        let (branch, message) = if let Some(stripped) = rest.strip_prefix("On ") {
            match stripped.find(": ") {
                Some(i) => (stripped[..i].to_string(), stripped[i + 2..].to_string()),
                None => (stripped.to_string(), String::new()),
            }
        } else if let Some(stripped) = rest.strip_prefix("WIP on ") {
            match stripped.find(": ") {
                Some(i) => (stripped[..i].to_string(), stripped[i + 2..].to_string()),
                None => (stripped.to_string(), String::new()),
            }
        } else {
            (String::new(), rest.to_string())
        };

        entries.push(StashEntry { index, branch, message });
    }

    Ok(entries)
}

/// Stash all changes with a custom message
#[tauri::command]
pub fn git_stash_save(path: String, message: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["stash", "push", "--include-untracked", "-m", &message])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Apply a stash without removing it
#[tauri::command]
pub fn git_stash_apply(path: String, index: usize) -> Result<String, String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "apply", &stash_ref])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash apply: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Apply and remove a stash
#[tauri::command]
pub fn git_stash_pop(path: String, index: usize) -> Result<String, String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "pop", &stash_ref])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash pop: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Delete a stash
#[tauri::command]
pub fn git_stash_drop(path: String, index: usize) -> Result<String, String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "drop", &stash_ref])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash drop: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Get diff for a stash entry (preview)
#[tauri::command]
pub fn git_stash_diff(path: String, index: usize) -> Result<String, String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let output = Command::new("git")
        .args(["stash", "show", "-p", &stash_ref])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git stash show: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Fetch from remote (git fetch)
#[tauri::command]
pub async fn git_fetch(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["fetch", "--all", "--prune"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git fetch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stderr).to_string())
}
