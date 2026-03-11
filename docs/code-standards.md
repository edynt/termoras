# Kodeck - Code Standards

## General
- File naming: kebab-case (`terminal-instance.tsx`, `pty_manager.rs`)
- Max file size: 200 lines
- Follow YAGNI/KISS/DRY

## TypeScript/React
- Strict mode enabled
- Named exports (no default exports)
- Zustand for state management
- Tailwind CSS v4 utility classes
- CSS variables for theme colors
- React refs for xterm.js instances

## Rust
- Edition 2021
- Error handling via `Result<T, String>` for Tauri commands
- `Arc<Mutex<>>` for shared state
- Dedicated threads for PTY reader loops
- Graceful cleanup in Drop/on_window_event

## Project Structure
```
src/
├── components/    # React components
├── stores/        # Zustand stores
├── lib/           # Utilities, Tauri wrappers
└── types/         # TypeScript type definitions

src-tauri/src/
├── lib.rs         # App setup, plugin/command registration
├── main.rs        # Entry point
├── commands.rs    # Tauri command handlers
└── pty_manager.rs # PTY session management
```

## Commit Convention
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- No AI references in messages
