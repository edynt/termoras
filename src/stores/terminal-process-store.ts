import { create } from "zustand";
import { getTerminalProcessName } from "../lib/tauri-commands";
import { useAppStore } from "./app-store";

const POLL_INTERVAL_MS = 3000;

interface TerminalProcessStore {
  /** Maps terminalId → foreground process name (null = idle/shell) */
  processes: Record<string, string | null>;
}

let pollTimer: number | null = null;

/** Poll all terminals for their foreground process name */
async function pollProcesses() {
  const terminals = useAppStore.getState().terminals;
  const updates: Record<string, string | null> = {};

  await Promise.all(
    terminals.map(async (t) => {
      try {
        updates[t.id] = await getTerminalProcessName(t.id);
      } catch {
        updates[t.id] = null;
      }
    }),
  );

  useTerminalProcessStore.setState({ processes: updates });
}

export const useTerminalProcessStore = create<TerminalProcessStore>(() => ({
  processes: {},
}));

/** Start polling terminal processes. Call once on app mount. */
export function startProcessPolling() {
  if (pollTimer) return;
  // Initial poll
  pollProcesses();
  pollTimer = window.setInterval(pollProcesses, POLL_INTERVAL_MS);
}

/** Stop polling. Call on app unmount. */
export function stopProcessPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
