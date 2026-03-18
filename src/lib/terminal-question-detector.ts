/**
 * Detects when a CLI tool (Claude Code, npm, git, etc.) is asking for user input.
 *
 * Strategy: buffer the last ~1200 chars of ANSI-stripped PTY output.
 * Uses two detection mechanisms:
 *   1. Debounce (800ms): fires after output stops — fast detection for simple CLIs.
 *   2. Throttle (2s): fires periodically during continuous output — handles TUI
 *      frameworks (ink, inquirer) that redraw continuously even while waiting
 *      for user input (spinners, cursor repositioning, status updates).
 * ANSI-only PTY chunks (cursor moves, style changes) are ignored so they
 * don't reset timers or pollute the text buffer.
 *
 * Auto-confirm: confirmation/yes-no prompts are automatically answered with "y"
 * (or Enter for press-enter prompts). Only non-confirmation prompts (passwords,
 * selections, open-ended questions) trigger the "needs input" UI indicator.
 */

/** Strip all ANSI escape sequences + control chars from raw PTY output */
// Comprehensive: CSI sequences, OSC, DCS, APC, PM, SOS, single-char escapes, and 8-bit C1
// eslint-disable-next-line no-control-regex
const ANSI_RE = /(?:\x1b\[[0-9;?]*[ -/]*[A-Za-z@`]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[()*/+\-.].|(?:\x1b[A-Z0-9=><#])|[\x00-\x08\x0b\x0c\x0e-\x1f]|\x7f)/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Auto-confirmable patterns: yes/no and confirmation prompts.
 * These get automatically answered — no UI indicator shown. */
interface AutoConfirmPattern {
  pattern: RegExp;
  response: string;
}

const AUTO_CONFIRM_PATTERNS: AutoConfirmPattern[] = [
  // Claude Code — tool permission prompts
  { pattern: /Allow .+ tool/i, response: "y\n" },
  { pattern: /\(y\)es\s*\/\s*\(n\)o/i, response: "y\n" },
  { pattern: /yes to \(a\)ll/i, response: "y\n" },
  // Claude Code — explicit confirmation prompts
  { pattern: /Do you want to proceed\??/i, response: "y\n" },
  { pattern: /Do you want to allow/i, response: "y\n" },
  { pattern: /Do you want to continue\??/i, response: "y\n" },
  // Generic CLI yes/no prompts (structural indicators)
  { pattern: /\(y\/n\)/i, response: "y\n" },
  { pattern: /\[Y\/n\]/i, response: "y\n" },
  { pattern: /\[y\/N\]/i, response: "y\n" },
  { pattern: /\(yes\/no\)/i, response: "y\n" },
  { pattern: /Are you sure\??/i, response: "y\n" },
  { pattern: /Continue\?/, response: "y\n" },
  { pattern: /Confirm\?/i, response: "y\n" },
  { pattern: /Overwrite\?/i, response: "y\n" },
  { pattern: /Replace\?/i, response: "y\n" },
  { pattern: /Proceed\?/i, response: "y\n" },
  // Generic CLI action prompts
  { pattern: /Press Enter to/i, response: "\n" },
  { pattern: /Press any key/i, response: "\n" },
  // npm / package managers
  { pattern: /Is this OK\?/i, response: "y\n" },
];

/** Manual input patterns: need real user input (password, text, selection).
 * These trigger the "needs input" UI indicator and wait for user action. */
const MANUAL_PATTERNS: RegExp[] = [
  // Claude Code — interrupted / open-ended questions
  /What should Claude do/i,
  /Interrupted/,
  // git prompts requiring text input
  /Please enter (?:a |the )?commit message/i,
  // Password / credential prompts (colon-terminated)
  /Password\s*:/i,
  /passphrase\s*:/i,
];

const BUFFER_SIZE = 1200;
const DEBOUNCE_MS = 800;    // Check 800ms after last visible output
const THROTTLE_MS = 2000;   // Also check every 2s during continuous output

export class QuestionDetector {
  private buffer = "";
  private debounceTimer: number | null = null;
  private throttleTimer: number | null = null;
  private currentState = false;
  private onChange: (questioning: boolean) => void;
  private onAutoConfirm: ((response: string) => void) | null;

  constructor(
    onChange: (questioning: boolean) => void,
    onAutoConfirm?: (response: string) => void,
  ) {
    this.onChange = onChange;
    this.onAutoConfirm = onAutoConfirm ?? null;
  }

  private clearTimers() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.debounceTimer = null;
    this.throttleTimer = null;
  }

  private checkPatterns() {
    // Auto-confirm: check confirmation patterns first
    if (this.onAutoConfirm) {
      for (const { pattern, response } of AUTO_CONFIRM_PATTERNS) {
        if (pattern.test(this.buffer)) {
          this.onAutoConfirm(response);
          // Reset silently (no onChange callback) so next question is detected fresh
          this.buffer = "";
          this.currentState = false;
          this.clearTimers();
          return;
        }
      }
    }

    // Manual input: check patterns that need real user input
    const isQuestion = MANUAL_PATTERNS.some((p) => p.test(this.buffer));
    if (isQuestion !== this.currentState) {
      this.currentState = isQuestion;
      this.onChange(isQuestion);
    }
  }

  /** Feed raw PTY data (may contain ANSI codes) */
  feed(rawData: string) {
    const text = stripAnsi(rawData);

    // Skip ANSI-only chunks (cursor moves, style changes) — no visible content,
    // don't reset timers or pollute buffer with whitespace noise
    if (!text || !text.trim()) return;

    this.buffer = (this.buffer + text).slice(-BUFFER_SIZE);

    // Debounce: check shortly after output stops (fast for simple CLIs)
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.checkPatterns();
    }, DEBOUNCE_MS);

    // Throttle: also check periodically during continuous output.
    // TUI frameworks (ink, inquirer) redraw continuously even while waiting
    // for input — debounce alone would never fire in that case.
    if (!this.throttleTimer) {
      this.throttleTimer = window.setTimeout(() => {
        this.throttleTimer = null;
        this.checkPatterns();
      }, THROTTLE_MS);
    }
  }

  reset() {
    this.buffer = "";
    this.clearTimers();
    if (this.currentState) {
      this.currentState = false;
      this.onChange(false);
    }
  }

  dispose() {
    this.clearTimers();
  }
}
