# Termoras - Codebase Summary

## Tech Stack
Tauri v2 + React 19 + TypeScript + Vite 6 + Zustand v5 + Tailwind CSS v4 + xterm.js v5 + portable-pty

## Architecture
- **Rust backend**: PTY session lifecycle (spawn, read, write, resize, kill)
- **React frontend**: Sidebar (projects/terminals), terminal panel (xterm.js)
- **IPC**: Tauri Commands (CRUD) + Channels (streaming PTY output)
- **State**: Zustand (frontend), `Arc<Mutex<HashMap>>` (backend)
- **Persistence**: Tauri Store plugin (JSON)

## Source Files (17 total)

### Frontend (13 files)
| File | Lines | Purpose |
|------|-------|---------|
| `src/main.tsx` | 9 | React entry point |
| `src/app.tsx` | 17 | Root layout (grid: sidebar + terminal) |
| `src/index.css` | 24 | Tailwind imports + CSS variables |
| `src/types/index.ts` | 12 | Project & TerminalSession types |
| `src/stores/app-store.ts` | 94 | Zustand store (all state + actions) |
| `src/lib/tauri-commands.ts` | 40 | Typed Tauri invoke wrappers |
| `src/lib/storage.ts` | 31 | Tauri Store persistence layer |
| `src/lib/terminal-theme.ts` | 27 | xterm.js light theme config |
| `src/components/sidebar.tsx` | 41 | Project list sidebar |
| `src/components/project-item.tsx` | 94 | Project row (expand, indicators, actions) |
| `src/components/terminal-item.tsx` | 53 | Terminal row (status, kill) |
| `src/components/terminal-instance.tsx` | 96 | xterm.js wrapper (PTY connection) |
| `src/components/terminal-panel.tsx` | 41 | Multi-terminal container (visibility) |

### Backend (4 files)
| File | Lines | Purpose |
|------|-------|---------|
| `src-tauri/src/main.rs` | 7 | Rust entry point |
| `src-tauri/src/lib.rs` | 47 | App setup, plugins, commands |
| `src-tauri/src/pty_manager.rs` | 35 | PtySession + AppState structs |
| `src-tauri/src/commands.rs` | 131 | 4 Tauri commands |
