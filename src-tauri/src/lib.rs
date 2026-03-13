mod commands;
mod git_commands;
mod pty_manager;

use pty_manager::AppState;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Kill all PTY sessions (accepts Window, WebviewWindow, or AppHandle)
fn kill_all_sessions(handle: &impl tauri::Manager<tauri::Wry>) {
    let sessions_arc = {
        let state = handle.state::<AppState>();
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
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // App submenu (macOS application menu)
            let app_submenu = Submenu::with_items(
                app,
                "Termoras",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("About Termoras"), None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "quit-app", "Quit Termoras", true, Some("CmdOrCtrl+Q"))?,
                ],
            )?;

            // Terminal submenu
            let close_tab_item =
                MenuItem::with_id(app, "close-tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
            let new_tab_item =
                MenuItem::with_id(app, "new-tab", "New Tab", true, Some("CmdOrCtrl+T"))?;
            let terminal_submenu = Submenu::with_items(
                app,
                "Terminal",
                true,
                &[&close_tab_item, &new_tab_item],
            )?;

            // Edit submenu
            let edit_submenu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            // Window submenu (no close_window — Cmd+W is handled by Terminal > Close Tab)
            let window_submenu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &app_submenu,
                    &terminal_submenu,
                    &edit_submenu,
                    &window_submenu,
                ],
            )?;

            app.set_menu(menu)?;

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
            commands::get_terminal_process_name,
            git_commands::is_git_repo,
            git_commands::git_status_summary,
            git_commands::git_changed_files,
            git_commands::read_file_content,
            git_commands::git_file_diff,
            git_commands::git_last_commit_message,
            git_commands::git_stage_all,
            git_commands::git_stage_files,
            git_commands::git_unstage_files,
            git_commands::git_commit,
            git_commands::git_has_unpushed,
            git_commands::git_undo_commit,
            git_commands::git_revert_file,
            git_commands::git_push,
            git_commands::git_list_branches,
            git_commands::git_merge,
            git_commands::git_merge_abort,
            git_commands::git_fetch,
            git_commands::git_stash_list,
            git_commands::git_stash_save,
            git_commands::git_stash_apply,
            git_commands::git_stash_pop,
            git_commands::git_stash_drop,
            git_commands::git_stash_diff,
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
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "close-tab" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.emit("close-active-terminal", ()).ok();
                    }
                }
                "new-tab" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.emit("create-new-terminal", ()).ok();
                    }
                }
                "quit-app" => {
                    // Show quit confirmation dialog (same as red X button)
                    if let Some(window) = app.get_webview_window("main") {
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
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
