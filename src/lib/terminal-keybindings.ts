import type { Terminal } from "@xterm/xterm";
import type { TelexEngine } from "./telex-engine";
import { useAppStore } from "../stores/app-store";
import { pasteImageFromClipboard } from "./image-upload";

/**
 * Terminal keyboard handler for xterm.js.
 * Handles macOS shortcuts (Cmd/Option combos) and Vietnamese input toggle.
 *
 * Vietnamese Telex input is processed in the onData handler (terminal-instance.tsx),
 * NOT here. This handler only manages the toggle shortcut and resets the Telex
 * buffer when navigation/editing shortcuts are used.
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
 * Attach keyboard handler to an xterm Terminal instance.
 *
 * Shortcuts:
 * - Cmd+Backspace  → delete entire line (Ctrl+U)
 * - Cmd+Left       → move to line start (Ctrl+A)
 * - Cmd+Right      → move to line end (Ctrl+E)
 * - Option+Left    → move word backward (Alt+B)
 * - Option+Right   → move word forward (Alt+F)
 * - Option+Backspace → delete word backward (Ctrl+W)
 * - Cmd+K          → clear terminal scrollback + screen
 * - Cmd+C          → copy selection (or send SIGINT if no selection)
 * - Cmd+V          → paste from clipboard
 * - Ctrl+Shift+Space → toggle Vietnamese input
 */
export function attachMacKeybindings(
  term: Terminal,
  writeToPty: WriteCallback,
  telex: TelexEngine,
): void {
  term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    // Only handle keydown events
    if (event.type !== "keydown") return true;

    // Skip during IME composition (system-level Vietnamese, Japanese, Chinese, etc.)
    // keyCode 229 is the universal IME processing signal in browsers
    if (event.isComposing || event.keyCode === 229) return true;

    const { metaKey, altKey, ctrlKey, shiftKey, key } = event;

    // --- Toggle Vietnamese input: Ctrl+Shift+Space ---
    if (ctrlKey && shiftKey && key === " ") {
      useAppStore.getState().toggleVietnameseInput();
      event.preventDefault();
      return false;
    }

    // --- Cmd (Meta) shortcuts ---
    if (metaKey && !altKey) {
      switch (key) {
        case "Backspace":
          // Cmd+Backspace → kill line (Ctrl+U)
          telex.reset();
          writeToPty(SEQUENCES.KILL_LINE);
          event.preventDefault();
          return false;

        case "ArrowLeft":
          // Cmd+Left → beginning of line
          telex.reset();
          writeToPty(SEQUENCES.HOME);
          event.preventDefault();
          return false;

        case "ArrowRight":
          // Cmd+Right → end of line
          telex.reset();
          writeToPty(SEQUENCES.END);
          event.preventDefault();
          return false;

        case "k":
          // Cmd+K → clear terminal
          telex.reset();
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
          telex.reset();
          return true;

        case "v":
          // Cmd+V → paste image from clipboard (if any), else paste text
          telex.reset();
          (async () => {
            const imagePath = await pasteImageFromClipboard();
            if (imagePath) {
              writeToPty(imagePath + " ");
            } else {
              const text = await navigator.clipboard.readText();
              if (text) writeToPty(text);
            }
          })();
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
          telex.reset();
          writeToPty(SEQUENCES.WORD_BACK);
          event.preventDefault();
          return false;

        case "ArrowRight":
          // Option+Right → word forward
          telex.reset();
          writeToPty(SEQUENCES.WORD_FWD);
          event.preventDefault();
          return false;

        case "Backspace":
          // Option+Backspace → delete word backward
          telex.reset();
          writeToPty(SEQUENCES.KILL_WORD);
          event.preventDefault();
          return false;
      }
    }

    // Let xterm handle everything else → fires onData where Telex processes input
    return true;
  });
}
