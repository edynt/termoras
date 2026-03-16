import { useState } from "react";
import { FolderPlus, Terminal, Layout, GitBranch, ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "termoras:onboarding-done";

const steps = [
  {
    icon: FolderPlus,
    title: "Add Your Projects",
    description: "Click the + button in the sidebar to add project folders. Each project gets its own set of terminals.",
  },
  {
    icon: Terminal,
    title: "Multiple Terminals",
    description: "Create unlimited terminals per project. Switch between them without killing running processes.",
  },
  {
    icon: Layout,
    title: "Kanban Board",
    description: "Use the Board view to organize tasks as cards. Click Run to execute commands directly in the terminal.",
  },
  {
    icon: GitBranch,
    title: "Git Integration",
    description: "Stage, commit, and push changes from the Changes view. No need to leave the app.",
  },
];

export function OnboardingModal() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== "true",
  );
  const [step, setStep] = useState(0);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl w-[420px] overflow-hidden">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center px-8 pt-10 pb-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue)]/10 flex items-center justify-center mb-5">
            <Icon size={32} className="text-[var(--accent-blue)]" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {current.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Footer: dots + buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)]">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? "bg-[var(--accent-blue)]" : "bg-[var(--text-secondary)]/30"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="text-sm px-3 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={() => (isLast ? dismiss() : setStep(step + 1))}
              className="flex items-center gap-1 text-sm px-4 py-1.5 rounded-md bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
