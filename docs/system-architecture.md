# CLCTerm - System Architecture

## Overview
```
┌─────────────────────────────────────────────────────┐
│                  Tauri Window                        │
│  ┌──────────┐  ┌────────────────────────────────┐   │
│  │ Sidebar  │  │      Terminal Panel             │   │
│  │ (React)  │  │  ┌──────────────────────────┐   │   │
│  │          │  │  │    xterm.js Instance      │   │   │
│  │ Projects │  │  │    (WebGL renderer)       │   │   │
│  │   └ Terms│  │  └──────────────────────────┘   │   │
│  └──────────┘  └────────────────────────────────┘   │
│                         │                            │
│              Tauri IPC (Commands + Channels)          │
│                         │                            │
│  ┌──────────────────────────────────────────────┐   │
│  │           Rust Backend                        │   │
│  │  AppState { sessions: HashMap<UUID, PtySession> } │
│  │  portable-pty: spawn, read, write, resize     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Terminal Output (PTY → UI)
1. PTY stdout → reader thread reads 4KB buffer
2. Reader thread → `Channel::send(Vec<u8>)`
3. Channel → frontend `onmessage` callback
4. Callback → `terminal.write(Uint8Array)`

### User Input (UI → PTY)
1. xterm.js `onData(string)` fires on keypress
2. Frontend invokes `write_terminal(id, data)`
3. Rust command writes bytes to PTY stdin

### Terminal Resize
1. xterm.js `onResize({cols, rows})` fires
2. Frontend invokes `resize_terminal(id, rows, cols)`
3. Rust calls `master.resize(PtySize)`

## State Management

### Rust (Backend)
- `AppState.sessions`: `Arc<Mutex<HashMap<String, PtySession>>>`
- Thread-safe, shared across Tauri commands
- Each session owns: PTY master, writer, child process

### React (Frontend)
- Zustand store: projects, terminals, activeIds
- Terminal instances kept mounted (CSS `display` toggle)
- xterm.js refs persist across view switches

## Persistence
- Tauri Store plugin → `clcterm-data.json`
- Stores: project list (id, name, path)
- Loaded on app start, saved on project add/remove

## Key Files
| File | Purpose |
|------|---------|
| `src-tauri/src/commands.rs` | Tauri command handlers (create/write/resize/kill) |
| `src-tauri/src/pty_manager.rs` | PtySession struct, AppState |
| `src/stores/app-store.ts` | Zustand store (projects, terminals, actions) |
| `src/components/terminal-instance.tsx` | xterm.js wrapper, PTY connection |
| `src/components/terminal-panel.tsx` | Multi-terminal container (visibility toggle) |
| `src/lib/tauri-commands.ts` | Typed Tauri invoke wrappers |
