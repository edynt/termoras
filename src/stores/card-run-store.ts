import { create } from "zustand";
import { getTerminalProcessName } from "../lib/tauri-commands";

type CardRunState = "running" | "done";

interface CardRunStore {
  /** Per-card run state — persists across component mount/unmount */
  states: Record<string, CardRunState>;
  /** Which terminal each running card is executing on */
  cardTerminals: Record<string, string>;
  /** Start tracking a card as running, poll terminal until idle */
  startRun: (cardId: string, terminalId: string) => void;
}

const POLL_INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1500;

/** Active poll timers — cleaned up automatically when done */
const activeTimers = new Map<string, { delay: number; interval: number }>();

export const useCardRunStore = create<CardRunStore>((set) => ({
  states: {},
  cardTerminals: {},

  startRun: (cardId, terminalId) => {
    // Clear any existing poll for this card
    const existing = activeTimers.get(cardId);
    if (existing) {
      clearTimeout(existing.delay);
      clearInterval(existing.interval);
      activeTimers.delete(cardId);
    }

    set((s) => ({
      states: { ...s.states, [cardId]: "running" },
      cardTerminals: { ...s.cardTerminals, [cardId]: terminalId },
    }));

    // Initial delay lets the command start before polling
    const delayId = window.setTimeout(() => {
      const intervalId = window.setInterval(async () => {
        try {
          const processName = await getTerminalProcessName(terminalId);
          // null = shell idle, command finished
          if (!processName) {
            clearInterval(intervalId);
            activeTimers.delete(cardId);
            set((s) => ({ states: { ...s.states, [cardId]: "done" } }));
            // Clear "done" state after 2s
            setTimeout(() => {
              set((s) => {
                const { [cardId]: _, ...restStates } = s.states;
                const { [cardId]: __, ...restTerminals } = s.cardTerminals;
                return { states: restStates, cardTerminals: restTerminals };
              });
            }, 2000);
          }
        } catch {
          // Terminal killed or errored
          clearInterval(intervalId);
          activeTimers.delete(cardId);
          set((s) => {
            const { [cardId]: _, ...restStates } = s.states;
            const { [cardId]: __, ...restTerminals } = s.cardTerminals;
            return { states: restStates, cardTerminals: restTerminals };
          });
        }
      }, POLL_INTERVAL_MS);

      activeTimers.set(cardId, { delay: delayId, interval: intervalId });
    }, INITIAL_DELAY_MS);

    activeTimers.set(cardId, { delay: delayId, interval: 0 });
  },
}));
