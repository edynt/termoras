/**
 * Vietnamese Telex input engine for terminal use.
 * Uses backspace-based composition to transform keystrokes
 * into Vietnamese characters in real-time.
 *
 * Supports: Telex input method (aa→â, dd→đ, tone marks s/f/r/x/j/z)
 * Convention: Old-style tone placement (hòa, thủy)
 *
 * NOTE: Uses DEL-based composition which works in readline (cooked) mode.
 * Should be disabled in raw-mode TUI apps (vim, nano, fzf) via Ctrl+Shift+Space.
 * Escape key resets the internal buffer as a safety measure.
 */

/** Tone indices: 0=ngang, 1=sắc, 2=huyền, 3=hỏi, 4=ngã, 5=nặng */
const TONE_KEYS: Record<string, number> = {
  s: 1, f: 2, r: 3, x: 4, j: 5, z: 0,
};

/** Base vowel → tonal variants [ngang, sắc, huyền, hỏi, ngã, nặng] */
const VOWELS: Record<string, string[]> = {
  a: ["a", "á", "à", "ả", "ã", "ạ"],
  ă: ["ă", "ắ", "ằ", "ẳ", "ẵ", "ặ"],
  â: ["â", "ấ", "ầ", "ẩ", "ẫ", "ậ"],
  e: ["e", "é", "è", "ẻ", "ẽ", "ẹ"],
  ê: ["ê", "ế", "ề", "ể", "ễ", "ệ"],
  i: ["i", "í", "ì", "ỉ", "ĩ", "ị"],
  o: ["o", "ó", "ò", "ỏ", "õ", "ọ"],
  ô: ["ô", "ố", "ồ", "ổ", "ỗ", "ộ"],
  ơ: ["ơ", "ớ", "ờ", "ở", "ỡ", "ợ"],
  u: ["u", "ú", "ù", "ủ", "ũ", "ụ"],
  ư: ["ư", "ứ", "ừ", "ử", "ữ", "ự"],
  y: ["y", "ý", "ỳ", "ỷ", "ỹ", "ỵ"],
};

/** Reverse map: any Vietnamese vowel → [base, toneIndex] */
const VOWEL_MAP = new Map<string, [string, number]>();
for (const [base, variants] of Object.entries(VOWELS)) {
  for (let tone = 0; tone < variants.length; tone++) {
    VOWEL_MAP.set(variants[tone], [base, tone]);
  }
}

/** Telex character transformations: lastCharBase + key → newBase */
const TRANSFORMS: Record<string, string> = {
  "a+a": "â",
  "a+w": "ă",
  "e+e": "ê",
  "o+o": "ô",
  "o+w": "ơ",
  "u+w": "ư",
  "d+d": "đ",
};

/** Vowels with diacritical marks that get tone placement priority */
const MODIFIED_BASES = new Set(["ă", "â", "ê", "ô", "ơ", "ư"]);

/** Word-breaking characters that reset the buffer */
const WORD_BREAK_RE = /[\s.,;:!?\-()\[\]{}<>/\\@#$%^&*+=~`'"0-9|]/;

// --- Helpers ---

function isVowel(ch: string): boolean {
  return VOWEL_MAP.has(ch.toLowerCase());
}

function vowelBase(ch: string): string | null {
  return VOWEL_MAP.get(ch.toLowerCase())?.[0] ?? null;
}

function vowelTone(ch: string): number {
  return VOWEL_MAP.get(ch.toLowerCase())?.[1] ?? 0;
}

/** Apply a tone to a vowel character, preserving case */
function withTone(ch: string, tone: number): string {
  const base = vowelBase(ch);
  if (!base || !VOWELS[base]) return ch;
  const result = VOWELS[base][tone];
  return ch !== ch.toLowerCase() ? result.toUpperCase() : result;
}

function isConsonant(ch: string): boolean {
  return /^[bcfghklmnpqrstvwxz]$/i.test(ch);
}

/** Get base form for transform lookup (strips tone/diacritics for vowels, đ→d) */
function charBase(ch: string): string {
  if (ch === "đ" || ch === "Đ") return "d";
  return vowelBase(ch) ?? ch.toLowerCase();
}

// --- Public types ---

export type TelexResult =
  | { type: "passthrough" }
  | { type: "transform"; backspaces: number; replacement: string }
  | { type: "commit" };

// --- Engine ---

export class TelexEngine {
  private buf: string[] = [];

  /** Process a single key press. Returns action for terminal integration. */
  processKey(key: string): TelexResult {
    if (key.length !== 1) return { type: "commit" };

    // Word break → reset buffer, let terminal handle the key
    if (WORD_BREAK_RE.test(key)) {
      this.buf = [];
      return { type: "commit" };
    }

    const lower = key.toLowerCase();

    // Tone mark: only if buffer already contains a vowel
    if (lower in TONE_KEYS && this.buf.some(isVowel)) {
      return this.applyTone(TONE_KEYS[lower], key);
    }

    // Character transformation (aa→â, dd→đ, aw→ă, etc.)
    if (this.buf.length > 0) {
      const last = this.buf[this.buf.length - 1];
      const tKey = `${charBase(last)}+${lower}`;

      if (tKey in TRANSFORMS) {
        const newBase = TRANSFORMS[tKey];
        const isUpper = last !== last.toLowerCase();

        if (newBase === "đ") {
          const ch = isUpper ? "Đ" : "đ";
          this.buf[this.buf.length - 1] = ch;
          return { type: "transform", backspaces: 1, replacement: ch };
        }

        // Vowel transform — preserve any existing tone
        const prevTone = vowelTone(last);
        let ch = VOWELS[newBase][prevTone];
        if (isUpper) ch = ch.toUpperCase();
        this.buf[this.buf.length - 1] = ch;
        return { type: "transform", backspaces: 1, replacement: ch };
      }
    }

    // Regular character → add to buffer, passthrough to terminal
    this.buf.push(key);
    return { type: "passthrough" };
  }

  /** Apply tone mark to the correct vowel in the buffer */
  private applyTone(tone: number, rawKey: string): TelexResult {
    const idx = this.findToneTarget();
    if (idx === -1) {
      this.buf.push(rawKey);
      return { type: "passthrough" };
    }

    const ch = this.buf[idx];
    const curTone = vowelTone(ch);

    // Same tone pressed again → undo: strip tone and output the literal key
    if (curTone === tone && tone !== 0) {
      this.buf[idx] = withTone(ch, 0);
      const eraseCt = this.buf.length - idx; // chars to erase BEFORE push
      // Preserve case: if the vowel was uppercase, match the literal key case
      const literalKey = ch !== ch.toLowerCase() ? rawKey.toUpperCase() : rawKey;
      this.buf.push(literalKey);
      return {
        type: "transform",
        backspaces: eraseCt,
        replacement: this.buf.slice(idx).join(""),
      };
    }

    const newCh = withTone(ch, tone);
    if (newCh === ch) {
      // No change possible — treat as regular char
      this.buf.push(rawKey);
      return { type: "passthrough" };
    }

    this.buf[idx] = newCh;
    const eraseCt = this.buf.length - idx;
    return {
      type: "transform",
      backspaces: eraseCt,
      replacement: this.buf.slice(idx).join(""),
    };
  }

  /**
   * Find which vowel gets the tone mark (old-style convention).
   *
   * Rules:
   * 1. Modified vowel (ă,â,ê,ô,ơ,ư) gets priority (last one if multiple)
   * 2. Single vowel → that one
   * 3. Three+ vowels → middle vowel
   * 4. Two vowels + consonant follows → last vowel
   * 5. Two vowels, no consonant → first vowel (old-style: hòa, thủy)
   */
  private findToneTarget(): number {
    const vis: number[] = [];
    for (let i = 0; i < this.buf.length; i++) {
      if (isVowel(this.buf[i])) vis.push(i);
    }

    if (vis.length === 0) return -1;
    if (vis.length === 1) return vis[0];

    // Modified vowels get priority — use the last one if multiple
    let lastModified = -1;
    for (const i of vis) {
      const base = vowelBase(this.buf[i]);
      if (base && MODIFIED_BASES.has(base)) lastModified = i;
    }
    if (lastModified !== -1) return lastModified;

    // Three+ vowels → middle
    if (vis.length >= 3) return vis[Math.floor(vis.length / 2)];

    // Two vowels: consonant after vowel cluster → last vowel, otherwise → first
    const lastChar = this.buf[this.buf.length - 1];
    return isConsonant(lastChar) ? vis[vis.length - 1] : vis[0];
  }

  /** Remove last character from buffer (call when Backspace is pressed) */
  popBuffer(): void {
    this.buf.pop();
  }

  /** Clear the buffer (call on cursor movement, special keys, etc.) */
  reset(): void {
    this.buf = [];
  }
}
