import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../stores/app-store";
import type { TerminalSession } from "../types";
import { killTerminal } from "../lib/tauri-commands";

/**
 * Global keyboard shortcuts for the app.
 *
 * - Listens for Tauri menu events: "close-active-terminal", "create-new-terminal"
 * - Handles Cmd+1-9 to switch terminal tabs within the current project
 */
export function useGlobalKeybindings() {
  // Tauri menu events: Cmd+W (close tab) and Cmd+T (new tab)
  useEffect(() => {
    let cancelled = false;
    const unlisteners: (() => void)[] = [];

    // Cmd+W → close active terminal
    const p1 = listen("close-active-terminal", () => {
      const { activeTerminalId, terminals } = useAppStore.getState();
      if (!activeTerminalId) return;

      const terminal = terminals.find((t) => t.id === activeTerminalId);
      if (!terminal) return;

      // If process is running, show confirmation modal; otherwise close immediately
      if (terminal.isRunning) {
        window.dispatchEvent(
          new CustomEvent("termoras:confirm-kill-terminal", {
            detail: { terminalId: activeTerminalId },
          }),
        );
      } else {
        killTerminal(activeTerminalId).catch(() => {});
        useAppStore.getState().removeTerminal(activeTerminalId);
      }
    });

    // Cmd+T → create new terminal
    const p2 = listen("create-new-terminal", () => {
      const { activeProjectId, terminals, addTerminal } = useAppStore.getState();
      if (!activeProjectId) return;

      const count = terminals.filter((t) => t.projectId === activeProjectId).length;
      const terminal: TerminalSession = {
        id: crypto.randomUUID(),
        projectId: activeProjectId,
        name: count === 0 ? "Terminal" : `Terminal ${count + 1}`,
        isRunning: false,
      };
      addTerminal(terminal);
    });

    // Handle cleanup with cancellation flag for fast-unmount safety
    Promise.all([p1, p2]).then(([u1, u2]) => {
      if (cancelled) {
        u1();
        u2();
      } else {
        unlisteners.push(u1, u2);
      }
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  // Cmd+1-9 → switch terminal tabs (all terminals, matching tab bar order)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;

      const digit = parseInt(e.key, 10);
      if (isNaN(digit) || digit < 1 || digit > 9) return;

      e.preventDefault();

      const { terminals, setActiveTerminal } = useAppStore.getState();
      const target = terminals[digit - 1];
      if (target) {
        setActiveTerminal(target.id);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
