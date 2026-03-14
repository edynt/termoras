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
 */

/** Strip all ANSI escape sequences + control chars from raw PTY output */
// Comprehensive: CSI sequences, OSC, DCS, APC, PM, SOS, single-char escapes, and 8-bit C1
// eslint-disable-next-line no-control-regex
const ANSI_RE = /(?:\x1b\[[0-9;?]*[ -/]*[A-Za-z@`]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[()*/+\-.].|(?:\x1b[A-Z0-9=><#])|[\x00-\x08\x0b\x0c\x0e-\x1f]|\x7f)/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Patterns that indicate a CLI is waiting for user input.
 * IMPORTANT: Keep patterns specific to avoid false positives during throttled
 * checks (which fire while output is still streaming). Prefer patterns that
 * include structural indicators like (y/n), ?, option selectors, etc. */
const QUESTION_PATTERNS: RegExp[] = [
  // Claude Code — tool permission prompts
  /Allow .+ tool/i,
  /\(y\)es\s*\/\s*\(n\)o/i,
  /yes to \(a\)ll/i,
  // Claude Code — interrupted / waiting for input
  /What should Claude do/i,
  /Interrupted/,
  // Claude Code — explicit question prompts
  /Do you want to proceed\??/i,
  /Do you want to allow/i,
  /Do you want to continue\??/i,
  // Generic CLI yes/no prompts (structural indicators)
  /\(y\/n\)/i,
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /\(yes\/no\)/i,
  /Are you sure\??/i,
  /Continue\?/,
  /Confirm\?/i,
  /Overwrite\?/i,
  /Replace\?/i,
  /Proceed\?/i,
  // Generic CLI action prompts
  /Press Enter to/i,
  /Press any key/i,
  // npm / package managers
  /Is this OK\?/i,
  // git prompts
  /Please enter (?:a |the )?commit message/i,
  // Option selection prompts (numbered lists with ❯ selector)
  /❯/,
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

  constructor(onChange: (questioning: boolean) => void) {
    this.onChange = onChange;
  }

  private checkPatterns() {
    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(this.buffer));
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
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    if (this.currentState) {
      this.currentState = false;
      this.onChange(false);
    }
  }

  dispose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
  }
}
