import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import {
  useOnboardingStore,
  getPhaseSteps,
} from "../stores/onboarding-store";
import { useAppStore } from "../stores/app-store";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 288; // w-72 = 18rem
const TOOLTIP_HEIGHT_EST = 160; // approximate max height
const EDGE_MARGIN = 12; // min distance from viewport edge

/** Compute tooltip position with viewport clamping so it never overflows */
function getTooltipStyle(
  rect: Rect,
  position?: string,
): React.CSSProperties {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top: number | undefined;
  let left: number | undefined;
  let bottom: number | undefined;
  let transform: string | undefined;

  switch (position) {
    case "top":
      bottom = vh - rect.top + gap;
      left = rect.left;
      break;
    case "right":
      top = rect.top;
      left = rect.left + rect.width + gap;
      break;
    case "left":
      top = rect.top;
      left = rect.left - TOOLTIP_WIDTH - gap;
      break;
    case "center":
      top = rect.top + rect.height / 2;
      left = rect.left + rect.width / 2;
      transform = "translate(-50%, -50%)";
      break;
    case "bottom":
    default:
      top = rect.top + rect.height + gap;
      left = rect.left;
      break;
  }

  // Clamp to viewport (skip for center transform)
  if (!transform) {
    if (left !== undefined) {
      left = Math.max(EDGE_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - EDGE_MARGIN));
    }
    if (top !== undefined) {
      top = Math.max(EDGE_MARGIN, Math.min(top, vh - TOOLTIP_HEIGHT_EST - EDGE_MARGIN));
    }
    if (bottom !== undefined) {
      bottom = Math.max(EDGE_MARGIN, bottom);
    }
  }

  const style: React.CSSProperties = {};
  if (top !== undefined) style.top = top;
  if (left !== undefined) style.left = left;
  if (bottom !== undefined) style.bottom = bottom;
  if (transform) style.transform = transform;
  return style;
}

export function OnboardingOverlay() {
  const isActive = useOnboardingStore((s) => s.isActive);
  const activePhase = useOnboardingStore((s) => s.activePhase);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const next = useOnboardingStore((s) => s.next);
  const skip = useOnboardingStore((s) => s.skip);
  const [rect, setRect] = useState<Rect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = getPhaseSteps(activePhase);
  const step = steps[currentStep];

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [step]);

  // Handle navigation + optional skip + measurement on step change
  useEffect(() => {
    if (!isActive || !step) return;

    // Navigate to required view before showing spotlight
    if (step.navigate) {
      useAppStore.getState().setActiveView(step.navigate);
    }

    // Wait for render, then check target / measure
    timerRef.current = setTimeout(
      () => {
        if (step.target) {
          const el = document.querySelector(step.target);
          if (!el && step.optional) {
            next();
            return;
          }
        }
        measureTarget();
      },
      step.navigate ? 300 : 0,
    );

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep, activePhase]);

  // Resize listener
  useEffect(() => {
    if (!isActive) return;
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [isActive, measureTarget]);

  // Keyboard: Enter/ArrowRight = next, Escape = skip
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, next, skip]);

  if (!isActive || !step) return null;

  const isLast = currentStep === steps.length - 1;
  const hasTarget = !!rect;
  // Show "Get Started" only on phase 1 welcome, otherwise "Next"
  const isWelcome = step.target === null && currentStep === 0;

  // Step indicator dots
  const dots = (
    <div className="flex items-center justify-center gap-1.5 mt-3">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            i === currentStep
              ? "bg-[var(--accent-blue)]"
              : "bg-[var(--text-secondary)]/30"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Spotlight: box-shadow creates dimmed backdrop with a transparent hole */}
      {hasTarget ? (
        <div
          className="absolute rounded-lg pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            transition: "all 0.3s ease-out",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* Tooltip — centered or positioned near target */}
      {!hasTarget ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl p-6 max-w-sm text-center animate-[fadeIn_0.3s_ease-out]">
            <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {step.description}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={skip}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5"
              >
                Skip tour
              </button>
              <button
                onClick={next}
                className="flex items-center gap-1 text-sm px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
              >
                {isWelcome ? "Get Started" : isLast ? "Done" : "Next"}{" "}
                <ChevronRight size={14} />
              </button>
            </div>
            {dots}
          </div>
        </div>
      ) : (
        <div
          className="absolute animate-[fadeIn_0.2s_ease-out]"
          style={getTooltipStyle(rect, step.position)}
        >
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl p-4 w-72 max-w-[calc(100vw-24px)]">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <button
                onClick={skip}
                className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              {step.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">
                {currentStep + 1} / {steps.length}
              </span>
              <button
                onClick={next}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
              >
                {isLast ? "Done" : "Next"}{" "}
                {!isLast && <ChevronRight size={12} />}
              </button>
            </div>
            {dots}
          </div>
        </div>
      )}
    </div>
  );
}
