import { create } from "zustand";
import { writeTerminal, getTerminalProcessName } from "../lib/tauri-commands";
import { useAppStore } from "./app-store";
import { useKanbanStore } from "./kanban-store";
import { useTagStore } from "./tag-store";

export type CardRunStatus = "pending" | "running" | "done" | "error";

interface AutoRunStore {
  /** Per-card run status (in-memory only, not persisted) */
  cardStatus: Record<string, CardRunStatus>;
  /** Whether the queue processor is currently running */
  processing: boolean;

  /** Enqueue a card for auto-run. Starts processing if idle. */
  enqueue: (cardId: string) => void;
  /** Remove a card from queue (e.g., dragged out of auto-run column) */
  dequeue: (cardId: string) => void;
  /** Clear all statuses (e.g., on project switch) */
  clearAll: () => void;
}

/** Poll interval and timeout for command completion detection */
const POLL_INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const MAX_WAIT_MS = 300000; // 5 min max wait per command

export const useAutoRunStore = create<AutoRunStore>((set, get) => ({
  cardStatus: {},
  processing: false,

  enqueue: (cardId) => {
    const { cardStatus } = get();
    // Skip if already queued/running/done
    if (cardStatus[cardId]) return;

    set({ cardStatus: { ...cardStatus, [cardId]: "pending" } });

    // Start processing if not already running
    if (!get().processing) {
      processQueue();
    }
  },

  dequeue: (cardId) => {
    const { cardStatus } = get();
    if (!cardStatus[cardId]) return;
    const { [cardId]: _, ...rest } = cardStatus;
    set({ cardStatus: rest });
  },

  clearAll: () => {
    set({ cardStatus: {}, processing: false });
  },
}));

/** Build the full command string for a card */
function buildCommand(cardId: string): string | null {
  const board = useKanbanStore.getState().board;
  if (!board) return null;

  const card = board.cards[cardId];
  if (!card || !card.content) return null;

  const tags = useTagStore.getState().tags;
  const tag = card.type ? tags.find((t) => t.id === card.type) : null;
  const prefix = tag?.command ?? (card.type ? `/${card.type}` : "");

  return prefix ? `${prefix} ${card.content}` : card.content;
}

/** Find the active terminal for the current project, fallback to first */
function findTerminal(): string | null {
  const { terminals, activeProjectId, activeTerminalId } = useAppStore.getState();
  const active = terminals.find((t) => t.id === activeTerminalId && t.projectId === activeProjectId);
  return active?.id ?? terminals.find((t) => t.projectId === activeProjectId)?.id ?? null;
}

/** Wait for terminal to become idle (no child process) */
async function waitForIdle(terminalId: string): Promise<boolean> {
  // Initial delay to let the command start
  await sleep(INITIAL_DELAY_MS);

  const startTime = Date.now();
  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const processName = await getTerminalProcessName(terminalId);
      // null = shell is idle, no foreground process
      if (!processName) return true;
    } catch {
      // Terminal may have been killed — treat as done
      return true;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  // Timed out
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Process queued cards sequentially */
async function processQueue() {
  const store = useAutoRunStore;
  store.setState({ processing: true });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find next pending card (respects column order since enqueue follows top-to-bottom)
    const { cardStatus } = store.getState();
    const nextCardId = Object.entries(cardStatus).find(
      ([, status]) => status === "pending",
    )?.[0];

    if (!nextCardId) break; // No more pending cards

    const command = buildCommand(nextCardId);
    const terminalId = findTerminal();

    if (!command || !terminalId) {
      // Can't run — mark error and continue
      store.setState({
        cardStatus: { ...store.getState().cardStatus, [nextCardId]: "error" },
      });
      continue;
    }

    // Mark as running
    store.setState({
      cardStatus: { ...store.getState().cardStatus, [nextCardId]: "running" },
    });

    // Set terminal active (in-place so kanban stays visible)
    const { setActiveTerminalInPlace } = useAppStore.getState();
    setActiveTerminalInPlace(terminalId);

    // Execute command
    try {
      await writeTerminal(terminalId, command + "\r");
      // Wait for completion
      const completed = await waitForIdle(terminalId);
      store.setState({
        cardStatus: {
          ...store.getState().cardStatus,
          [nextCardId]: completed ? "done" : "error",
        },
      });
    } catch {
      store.setState({
        cardStatus: { ...store.getState().cardStatus, [nextCardId]: "error" },
      });
    }

    // Small gap between commands
    await sleep(500);
  }

  store.setState({ processing: false });
}
