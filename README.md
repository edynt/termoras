# CLCTerm

Desktop terminal manager for multi-project workflows. Built with Tauri v2.

## Features

- **Project sidebar** — Add folders, see all projects at a glance
- **Running indicators** — Animated spinner shows which projects have active terminals
- **Multiple terminals** — Unlimited terminals per project
- **Non-destructive switching** — Switch between projects/terminals without killing processes
- **Light theme** — Clean, high-contrast light UI
- **Native performance** — Rust backend, ~5MB binary

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript |
| Build | Vite 6 |
| State | Zustand v5 |
| Styling | Tailwind CSS v4 |
| Terminal | xterm.js v5 (WebGL) |
| PTY | portable-pty |

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- Rust toolchain (rustc, cargo)
- macOS: Xcode Command Line Tools

## Getting Started

```bash
# Use correct Node version
nvm use

# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
src/                    # React frontend
├── components/         # UI components
├── stores/             # Zustand state
├── lib/                # Utilities, Tauri wrappers
└── types/              # TypeScript types

src-tauri/src/          # Rust backend
├── lib.rs              # App setup
├── commands.rs         # Tauri commands
└── pty_manager.rs      # PTY session management

docs/                   # Documentation
plans/                  # Implementation plans
```
