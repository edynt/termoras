mod commands;
mod pty_manager;

use pty_manager::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
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
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
