# Termoras - Tech Stack

## Core
| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop Framework | Tauri | v2 |
| Frontend | React + TypeScript | React 19 |
| Build Tool | Vite | v6 |
| State Management | Zustand | v5 |
| Styling | Tailwind CSS | v4 |
| Terminal Renderer | xterm.js | v5 |
| PTY Management | portable-pty | v0.8+ |
| Icons | Lucide React | latest |
| Persistence | Tauri Store plugin | v2 |

## Architecture
- **Rust backend**: PTY session management, file system access, process lifecycle
- **React frontend**: UI rendering, xterm.js integration, state management
- **IPC**: Tauri commands (request/response) + Channels (streaming PTY data)
- **Theme**: Light theme only (initial release)
