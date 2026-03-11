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

/// Push to remote (git push)
#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(["push"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        // git push writes progress to stderr even on success
        if output.status.code() != Some(0) {
            return Err(stderr);
        }
    }
    // git push outputs to stderr for progress info
    let result = String::from_utf8_lossy(&output.stderr).to_string();
    Ok(result)
}
