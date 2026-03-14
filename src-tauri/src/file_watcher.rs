use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

/// Debounce interval in milliseconds — prevents flooding the frontend
const DEBOUNCE_MS: u64 = 300;

pub struct FileWatcherState {
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
}

impl FileWatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn start_file_watcher(
    app: AppHandle,
    path: String,
    state: tauri::State<'_, FileWatcherState>,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    if watchers.contains_key(&path) {
        return Ok(());
    }

    let watch_path = path.clone();
    let last_emit = Arc::new(AtomicU64::new(0));

    let watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        let event = match res {
            Ok(e) => e,
            Err(_) => return,
        };

        // Only react to file modifications, creations, deletions
        match event.kind {
            notify::EventKind::Modify(_)
            | notify::EventKind::Create(_)
            | notify::EventKind::Remove(_) => {}
            _ => return,
        }

        // Skip internal .git changes (except index and refs which track push/fetch state)
        let dominated_by_git_internal = event.paths.iter().all(|p| {
            let s = p.to_string_lossy();
            s.contains("/.git/")
                && !s.ends_with("/.git/index")
                && !s.contains("/.git/refs/")
        });
        if dominated_by_git_internal {
            return;
        }

        // Rate-limit: skip if we emitted within DEBOUNCE_MS
        let now = now_ms();
        let prev = last_emit.load(Ordering::Relaxed);
        if now.saturating_sub(prev) < DEBOUNCE_MS {
            return;
        }
        last_emit.store(now, Ordering::Relaxed);

        let _ = app.emit("fs-changed", &watch_path);
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    let mut w = watcher;
    w.watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch: {}", e))?;

    watchers.insert(path, w);
    Ok(())
}

#[tauri::command]
pub fn stop_file_watcher(
    path: String,
    state: tauri::State<'_, FileWatcherState>,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.remove(&path);
    Ok(())
}
