mod commands;
mod git_commands;
mod pty_manager;

use pty_manager::AppState;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Kill all PTY sessions for the given window
fn kill_all_sessions(window: &tauri::Window) {
    let sessions_arc = {
        let state = window.state::<AppState>();
        state.sessions.clone()
    };
    let mut guard = match sessions_arc.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    let keys: Vec<String> = guard.keys().cloned().collect();
    for key in keys {
        if let Some(mut session) = guard.remove(&key) {
            let _ = session.child.kill();
        }
    }
    drop(guard);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::kill_terminal,
            commands::open_in_vscode,
            commands::save_temp_image,
            git_commands::is_git_repo,
            git_commands::git_status_summary,
            git_commands::git_changed_files,
            git_commands::git_file_diff,
            git_commands::git_last_commit_message,
            git_commands::git_stage_all,
            git_commands::git_stage_files,
            git_commands::git_unstage_files,
            git_commands::git_commit,
            git_commands::git_has_unpushed,
            git_commands::git_undo_commit,
            git_commands::git_push,
        ])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Prevent the default close — show confirmation dialog first
                    api.prevent_close();

                    let win = window.clone();
                    window
                        .dialog()
                        .message("All terminal sessions will be terminated.")
                        .title("Quit Termoras?")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::OkCancelCustom(
                            "Quit".to_string(),
                            "Cancel".to_string(),
                        ))
                        .show(move |confirmed| {
                            if confirmed {
                                kill_all_sessions(&win);
                                win.destroy().ok();
                            }
                        });
                }
                tauri::WindowEvent::Destroyed => {
                    // Fallback cleanup if window is destroyed without the dialog
                    kill_all_sessions(window);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
