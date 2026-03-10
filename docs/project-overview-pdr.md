# CLCTerm - Product Development Requirements

## Product
**CLCTerm** — Desktop terminal manager for multi-project workflows

## Problem
Developers working on multiple projects need to manage many terminal sessions. Existing terminals (iTerm2, Terminal.app) don't organize terminals by project with status indicators.

## Solution
Tauri v2 desktop app with:
- Left sidebar showing project list with running indicators
- Click project → expand terminal list → create/select terminals
- Real PTY shell sessions (bash/zsh)
- Switching between projects/terminals keeps processes alive
- Light theme, native-fast performance

## Target User
Developers managing 2+ projects simultaneously who want organized terminal workflows.

## Core Requirements
1. Add projects by selecting folders
2. Create unlimited terminals per project
3. Running terminals show animated spinner
4. Switch terminals without killing processes
5. Persist project list across restarts

## Non-Requirements (MVP)
- Dark theme
- Split panes
- Custom shell configuration
- Remote SSH terminals
- Terminal recording/replay

## Tech Stack
See [tech-stack.md](./tech-stack.md)

## Architecture
```
React Frontend (xterm.js + Zustand)
        |
    Tauri IPC (Commands + Channels)
        |
Rust Backend (portable-pty sessions)
```
