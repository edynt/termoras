import type { Terminal } from "@xterm/xterm";

/**
 * macOS-style keyboard shortcuts for xterm.js terminals.
 * Maps Cmd/Option key combos to ANSI escape sequences,
 * matching iTerm2/Warp behavior.
 */

// ANSI escape sequences for shell line editing
const SEQUENCES = {
  // Line navigation (readline)
  HOME: "\x01", // Ctrl+A — move to beginning of line
  END: "\x05", // Ctrl+E — move to end of line
  // Word navigation
  WORD_BACK: "\x1bb", // Alt+B — move word backward
  WORD_FWD: "\x1bf", // Alt+F — move word forward
  // Deletion
  KILL_LINE: "\x15", // Ctrl+U — delete from cursor to line start
  KILL_WORD: "\x17", // Ctrl+W — delete word backward
  KILL_TO_END: "\x0b", // Ctrl+K — delete from cursor to line end
} as const;

type WriteCallback = (data: string) => void;

/**
 * Attach macOS keybinding handler to an xterm Terminal instance.
 * Returns a cleanup function.
 *
 * Handled shortcuts:
 * - Cmd+Backspace  → delete entire line (Ctrl+U)
 * - Cmd+Left       → move to line start (Ctrl+A)
 * - Cmd+Right      → move to line end (Ctrl+E)
 * - Option+Left    → move word backward (Alt+B)
 * - Option+Right   → move word forward (Alt+F)
 * - Option+Backspace → delete word backward (Ctrl+W)
 * - Cmd+K          → clear terminal scrollback + screen
 * - Cmd+C          → copy selection (or send SIGINT if no selection)
 * - Cmd+V          → paste from clipboard
 */
export function attachMacKeybindings(
  term: Terminal,
  writeToPty: WriteCallback,
): void {
  term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    // Only handle keydown events
    if (event.type !== "keydown") return true;

    const { metaKey, altKey, key } = event;

    // --- Cmd (Meta) shortcuts ---
    if (metaKey && !altKey) {
      switch (key) {
        case "Backspace":
          // Cmd+Backspace → kill line (Ctrl+U)
          writeToPty(SEQUENCES.KILL_LINE);
          event.preventDefault();
          return false;

        case "ArrowLeft":
          // Cmd+Left → beginning of line
          writeToPty(SEQUENCES.HOME);
          event.preventDefault();
          return false;

        case "ArrowRight":
          // Cmd+Right → end of line
          writeToPty(SEQUENCES.END);
          event.preventDefault();
          return false;

        case "k":
          // Cmd+K → clear terminal
          term.clear();
          event.preventDefault();
          return false;

        case "c":
          // Cmd+C → copy if selection exists, otherwise let terminal send Ctrl+C
          if (term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            term.clearSelection();
            event.preventDefault();
            return false;
          }
          // No selection → let xterm handle as normal (sends SIGINT)
          return true;

        case "v":
          // Cmd+V → paste from clipboard
          navigator.clipboard.readText().then((text) => {
            if (text) writeToPty(text);
          });
          event.preventDefault();
          return false;

        case "a":
          // Cmd+A → select all terminal content
          term.selectAll();
          event.preventDefault();
          return false;
      }
    }

    // --- Option (Alt) shortcuts ---
    if (altKey && !metaKey) {
      switch (key) {
        case "ArrowLeft":
          // Option+Left → word backward
          writeToPty(SEQUENCES.WORD_BACK);
          event.preventDefault();
          return false;

        case "ArrowRight":
          // Option+Right → word forward
          writeToPty(SEQUENCES.WORD_FWD);
          event.preventDefault();
          return false;

        case "Backspace":
          // Option+Backspace → delete word backward
          writeToPty(SEQUENCES.KILL_WORD);
          event.preventDefault();
          return false;
      }
    }

    // Let xterm handle everything else
    return true;
  });
}
