use crate::pty_manager::{AppState, PtySession};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::Read;
use std::process::Command;
use std::thread;
use tauri::ipc::Channel;
use tauri::State;

/// Create a new PTY terminal session. Accepts frontend-generated ID.
#[tauri::command]
pub fn create_terminal(
    id: String,
    project_path: String,
    rows: u16,
    cols: u16,
    on_data: Channel<Vec<u8>>,
    state: State<AppState>,
) -> Result<String, String> {

    // Detect default shell
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: if rows > 0 { rows } else { 24 },
            cols: if cols > 0 { cols } else { 80 },
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Start as login shell (-l) so user profile loads (PATH, nvm, cargo, etc.)
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l");
    cmd.cwd(&project_path);

    // Set TERM for color/TUI support (required by Claude Code CLI)
    cmd.env("TERM", "xterm-256color");
    // Propagate full locale chain for programs that check LC_* independently (vim, less, python)
    let locale = std::env::var("LANG").unwrap_or_else(|_| "en_US.UTF-8".to_string());
    cmd.env("LANG", &locale);
    cmd.env("LC_ALL", std::env::var("LC_ALL").unwrap_or_else(|_| locale.clone()));
    cmd.env("LC_CTYPE", std::env::var("LC_CTYPE").unwrap_or_else(|_| locale.clone()));

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Clone reader for output streaming thread
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Get writer for stdin
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    // Spawn a thread to read PTY output and send via channel
    let session_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // PTY closed
                Ok(n) => {
                    if on_data.send(buf[..n].to_vec()).is_err() {
                        break; // Channel closed
                    }
                }
                Err(e) => {
                    log::debug!("PTY reader error for {}: {}", session_id, e);
                    break;
                }
            }
        }
    });

    let session = PtySession {
        writer,
        master: pair.master,
        child,
    };

    state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?
        .insert(id.clone(), session);

    Ok(id)
}

/// Write user input to terminal PTY stdin
#[tauri::command]
pub fn write_terminal(
    id: String,
    data: String,
    state: State<AppState>,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("Session not found: {}", id))?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write error: {}", e))?;

    session
        .writer
        .flush()
        .map_err(|e| format!("Flush error: {}", e))?;

    Ok(())
}

/// Resize terminal PTY
#[tauri::command]
pub fn resize_terminal(
    id: String,
    rows: u16,
    cols: u16,
    state: State<AppState>,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Session not found: {}", id))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize error: {}", e))?;

    Ok(())
}

/// Kill a terminal session
#[tauri::command]
pub fn kill_terminal(id: String, state: State<AppState>) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }

    Ok(())
}

/// Save base64-encoded image data to a temp file. Returns absolute path.
#[tauri::command]
pub fn save_temp_image(data: String, extension: String) -> Result<String, String> {
    use base64::Engine;
    use std::io::Write;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let temp_dir = std::env::temp_dir().join("termoras-uploads");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let filename = format!(
        "image-{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        extension
    );

    let path = temp_dir.join(&filename);
    let mut file =
        std::fs::File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Open a directory in VS Code
#[tauri::command]
pub fn open_in_vscode(path: String) -> Result<(), String> {
    // Use macOS `open -a` instead of `code` CLI — production builds have minimal PATH
    // that doesn't include /usr/local/bin where `code` lives
    Command::new("open")
        .args(["-a", "Visual Studio Code", &path])
        .spawn()
        .map_err(|e| format!("Failed to open VS Code: {}", e))?;
    Ok(())
}
