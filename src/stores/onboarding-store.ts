import { create } from "zustand";

const STORAGE_PREFIX = "termoras:onboarding";

export interface OnboardingStep {
  id: string;
  /** CSS selector for target element, null = centered tooltip */
  target: string | null;
  title: string;
  description: string;
  position?: "top" | "right" | "bottom" | "left" | "center";
  /** View to navigate to before showing this step */
  navigate?: "kanban" | "git" | "terminal";
  /** If true, auto-skip when target element not found in DOM */
  optional?: boolean;
}

export const PHASE_1_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to Termoras!",
    description:
      "A quick tour to help you get started with your terminal workspace.",
  },
  {
    id: "add-project",
    target: "[data-onboarding='add-project']",
    title: "Add a Project",
    description:
      "Click here to add a project folder. Each project gets its own terminals and board.",
    position: "bottom",
  },
  {
    id: "main-area",
    target: "[data-onboarding='main-area']",
    title: "Your Workspace",
    description:
      "Terminals, kanban boards, and git changes appear here once you add a project.",
    position: "center",
  },
  {
    id: "sidebar-footer",
    target: "[data-onboarding='sidebar-footer']",
    title: "Quick Settings",
    description:
      "Toggle theme, view running terminals, and manage tag settings.",
    position: "top",
  },
];

export const PHASE_2_STEPS: OnboardingStep[] = [
  {
    id: "phase2-welcome",
    target: null,
    title: "More Features to Explore!",
    description:
      "Now that you have a project, let's discover more tools to boost your workflow.",
  },
  {
    id: "board-tab",
    target: "[data-onboarding='board-tab']",
    title: "Kanban Board",
    description:
      "Open the kanban board to manage tasks with drag-and-drop columns and cards.",
    position: "right",
  },
  {
    id: "kanban-create",
    target: "[data-onboarding='kanban-add-column']",
    title: "Create Cards",
    description:
      "Add columns and cards to organize your tasks. Cards can hold commands to run.",
    position: "bottom",
    navigate: "kanban",
  },
  {
    id: "auto-run",
    target: null,
    title: "Auto-Run",
    description:
      "Enable auto-run on a column — any card dropped there will automatically execute its command in the terminal.",
  },
  {
    id: "tag-settings",
    target: "[data-onboarding='tag-settings']",
    title: "Tag Settings",
    description:
      "Customize tags with colors and commands to categorize your cards.",
    position: "top",
  },
  {
    id: "changes-tab",
    target: "[data-onboarding='changes-tab']",
    title: "Git Changes",
    description:
      "View and manage git changes, stage files, and commit right from the sidebar.",
    position: "right",
    optional: true,
  },
];

export function getPhaseSteps(phase: 1 | 2): OnboardingStep[] {
  return phase === 1 ? PHASE_1_STEPS : PHASE_2_STEPS;
}

function storageKey(phase: 1 | 2): string {
  return `${STORAGE_PREFIX}:phase${phase}`;
}

interface OnboardingStore {
  activePhase: 1 | 2;
  currentStep: number;
  isActive: boolean;
  isPhaseCompleted: (phase: 1 | 2) => boolean;
  startPhase: (phase: 1 | 2) => void;
  next: () => void;
  skip: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  activePhase: 1,
  currentStep: 0,
  isActive: false,

  isPhaseCompleted: (phase) => {
    try {
      return localStorage.getItem(storageKey(phase)) === "true";
    } catch {
      return false;
    }
  },

  startPhase: (phase) =>
    set({ activePhase: phase, currentStep: 0, isActive: true }),

  next: () => {
    const { currentStep, activePhase } = get();
    const steps = getPhaseSteps(activePhase);
    if (currentStep >= steps.length - 1) {
      localStorage.setItem(storageKey(activePhase), "true");
      set({ isActive: false });
    } else {
      set({ currentStep: currentStep + 1 });
    }
  },

  skip: () => {
    const { activePhase } = get();
    localStorage.setItem(storageKey(activePhase), "true");
    set({ isActive: false });
  },

  reset: () => {
    localStorage.removeItem(storageKey(1));
    localStorage.removeItem(storageKey(2));
    set({ isActive: false, currentStep: 0, activePhase: 1 });
  },
}));
