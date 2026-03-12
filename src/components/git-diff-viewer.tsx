import { useCallback, useMemo, useRef, useState } from "react";
import { Columns2, Rows3 } from "lucide-react";
import { detectLanguage, highlightCode, highlightLine } from "../lib/syntax-highlight";

type DiffViewMode = "split" | "unified";
const VIEW_MODE_KEY = "termoras-diff-view-mode";

interface Props {
  diff: string;
  filePath: string;
  /** When true, `diff` contains raw file content (not a unified diff) */
  isNewFile?: boolean;
}

interface ParsedLine {
  type: "add" | "del" | "context" | "hunk" | "meta";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

/** A row in split view: left side (old) and right side (new) */
interface SplitRow {
  type: "context" | "change" | "hunk" | "meta";
  left: ParsedLine | null;
  right: ParsedLine | null;
  raw?: string; // for hunk/meta
}

/** Parse unified diff into structured lines with line numbers */
function parseDiff(diff: string): ParsedLine[] {
  const raw = diff.split("\n");
  const result: ParsedLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: "hunk", content: line, oldNum: null, newNum: null });
    } else if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
      result.push({ type: "meta", content: line, oldNum: null, newNum: null });
    } else if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1), oldNum: null, newNum: newLine });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ type: "del", content: line.slice(1), oldNum: oldLine, newNum: null });
      oldLine++;
    } else {
      const content = line.startsWith(" ") ? line.slice(1) : line;
      if (oldLine > 0 || newLine > 0) {
        result.push({ type: "context", content, oldNum: oldLine, newNum: newLine });
        oldLine++;
        newLine++;
      }
    }
  }
  return result;
}

/** Convert parsed lines into side-by-side rows by pairing del/add blocks */
function buildSplitRows(lines: ParsedLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === "meta") {
      rows.push({ type: "meta", left: null, right: null, raw: line.content });
      i++;
    } else if (line.type === "hunk") {
      rows.push({ type: "hunk", left: null, right: null, raw: line.content });
      i++;
    } else if (line.type === "context") {
      rows.push({ type: "context", left: line, right: line });
      i++;
    } else if (line.type === "del" || line.type === "add") {
      // Collect consecutive del then add lines as a change block
      const dels: ParsedLine[] = [];
      const adds: ParsedLine[] = [];
      while (i < lines.length && lines[i].type === "del") {
        dels.push(lines[i]);
        i++;
      }
      while (i < lines.length && lines[i].type === "add") {
        adds.push(lines[i]);
        i++;
      }
      const maxLen = Math.max(dels.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          type: "change",
          left: dels[j] ?? null,
          right: adds[j] ?? null,
        });
      }
    } else {
      i++;
    }
  }
  return rows;
}

/** Render git diff with toggle between split and unified views */
export function GitDiffViewer({ diff, filePath, isNewFile }: Props) {
  const [viewMode, setViewMode] = useState<DiffViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return saved === "unified" ? "unified" : "split";
    } catch {
      return "split";
    }
  });

  const lang = useMemo(() => detectLanguage(filePath), [filePath]);
  const lines = useMemo(() => parseDiff(diff), [diff]);
  const splitRows = useMemo(() => buildSplitRows(lines), [lines]);

  function toggleMode() {
    const next = viewMode === "split" ? "unified" : "split";
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  }

  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-secondary)]">
        No diff available (file may be untracked or binary)
      </div>
    );
  }

  // New/untracked files: show raw content with syntax highlighting (no split/diff view)
  if (isNewFile) {
    const lang = detectLanguage(filePath);
    const highlightedLines = highlightCode(diff, lang);
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
          <span className="text-xs font-mono font-medium">{filePath}</span>
          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-[var(--accent-green)]/15 text-[var(--accent-green)] font-medium">
            New file
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px] leading-[20px] font-mono border-collapse">
            <tbody>
              {highlightedLines.map((html, i) => (
                <tr key={i} className="hover:bg-[var(--bg-hover)]">
                  <td className="w-[40px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 text-[var(--text-secondary)]/30">
                    {i + 1}
                  </td>
                  <td className="px-3 py-0 whitespace-pre text-[var(--text-primary)]" dangerouslySetInnerHTML={{ __html: html }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header with view mode toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
        <span className="text-xs font-mono font-medium">{filePath}</span>
        <button
          onClick={toggleMode}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title={viewMode === "split" ? "Switch to unified view" : "Switch to split view"}
        >
          {viewMode === "split" ? <Rows3 size={13} /> : <Columns2 size={13} />}
          {viewMode === "split" ? "Unified" : "Split"}
        </button>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "unified" ? (
          <UnifiedDiffTable lines={lines} lang={lang} />
        ) : (
          <SplitDiffTable rows={splitRows} lang={lang} />
        )}
      </div>
    </div>
  );
}

/* ─── Unified view (original) ─── */

function UnifiedDiffTable({ lines, lang }: { lines: ParsedLine[]; lang: string | null }) {
  return (
    <table className="w-full text-[12px] leading-[20px] font-mono border-collapse">
      <tbody>
        {lines.map((line, i) => (
          <UnifiedDiffRow key={i} line={line} lang={lang} />
        ))}
      </tbody>
    </table>
  );
}

function UnifiedDiffRow({ line, lang }: { line: ParsedLine; lang: string | null }) {
  if (line.type === "meta") {
    return (
      <tr>
        <td colSpan={3} className="px-3 py-0 text-[var(--text-secondary)] font-bold whitespace-pre select-none">
          {line.content}
        </td>
      </tr>
    );
  }

  if (line.type === "hunk") {
    const readable = line.content.replace(/^@@.*?@@/, "").trim();
    return (
      <tr className="bg-[var(--diff-hunk-bg)]">
        <td className="w-[1px] px-2 py-0 text-right text-[var(--diff-hunk-text)]/50 select-none border-r border-[var(--border-color)]">···</td>
        <td className="w-[1px] px-2 py-0 text-right text-[var(--diff-hunk-text)]/50 select-none border-r border-[var(--border-color)]">···</td>
        <td className="px-3 py-0 text-[var(--diff-hunk-text)] whitespace-pre">
          <span className="text-[11px]">{line.content.match(/@@ .+? @@/)?.[0]}</span>
          {readable && <span className="ml-2 text-[var(--diff-hunk-text)]/70">{readable}</span>}
        </td>
      </tr>
    );
  }

  const isAdd = line.type === "add";
  const isDel = line.type === "del";
  const rowBg = isAdd ? "bg-[var(--diff-add-bg)]" : isDel ? "bg-[var(--diff-del-bg)]" : "";
  const numClass = isAdd ? "text-[var(--diff-add-border)]/60" : isDel ? "text-[var(--diff-del-border)]/60" : "text-[var(--text-secondary)]/30";
  const marker = isAdd ? "+" : isDel ? "−" : " ";
  const markerColor = isAdd ? "text-[var(--diff-add-border)]" : isDel ? "text-[var(--diff-del-border)]" : "text-transparent";

  return (
    <tr className={`${rowBg} hover:brightness-95`}>
      <td className={`w-[1px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 ${numClass}`}>
        {line.oldNum ?? ""}
      </td>
      <td className={`w-[1px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 ${numClass}`}>
        {line.newNum ?? ""}
      </td>
      <td className="px-0 py-0 whitespace-pre text-[var(--text-primary)]">
        <span className={`inline-block w-5 text-center select-none font-bold ${markerColor}`}>{marker}</span>
        <span dangerouslySetInnerHTML={{ __html: highlightLine(line.content, lang) }} />
      </td>
    </tr>
  );
}

/* ─── Split (side-by-side) view with synced horizontal scroll ─── */

function SplitDiffTable({ rows, lang }: { rows: SplitRow[]; lang: string | null }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const syncScroll = useCallback((source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const src = source === "left" ? leftRef.current : rightRef.current;
    const tgt = source === "left" ? rightRef.current : leftRef.current;
    if (src && tgt) tgt.scrollLeft = src.scrollLeft;
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  return (
    <div className="flex w-full">
      {/* Left (old) panel */}
      <div
        ref={leftRef}
        className="w-1/2 overflow-x-auto"
        onScroll={() => syncScroll("left")}
      >
        <SplitHalfTable rows={rows} side="old" lang={lang} />
      </div>
      {/* Divider */}
      <div className="w-[2px] shrink-0 bg-[var(--border-color)]" />
      {/* Right (new) panel */}
      <div
        ref={rightRef}
        className="w-1/2 overflow-x-auto"
        onScroll={() => syncScroll("right")}
      >
        <SplitHalfTable rows={rows} side="new" lang={lang} />
      </div>
    </div>
  );
}

/** Table for one side of the split view */
function SplitHalfTable({ rows, side, lang }: { rows: SplitRow[]; side: "old" | "new"; lang: string | null }) {
  return (
    <table className="w-full text-[12px] leading-[20px] font-mono border-collapse">
      <colgroup>
        <col style={{ width: 40 }} />
        <col />
      </colgroup>
      <tbody>
        {rows.map((row, i) => (
          <SplitHalfRow key={i} row={row} side={side} lang={lang} />
        ))}
      </tbody>
    </table>
  );
}

/** Renders a single row for one side of the split view */
function SplitHalfRow({ row, side, lang }: { row: SplitRow; side: "old" | "new"; lang: string | null }) {
  if (row.type === "meta") {
    return (
      <tr>
        <td colSpan={2} className="px-3 py-0 text-[var(--text-secondary)] font-bold whitespace-pre select-none">
          {row.raw}
        </td>
      </tr>
    );
  }

  if (row.type === "hunk") {
    const readable = (row.raw ?? "").replace(/^@@.*?@@/, "").trim();
    const hunkTag = (row.raw ?? "").match(/@@ .+? @@/)?.[0];
    return (
      <tr className="bg-[var(--diff-hunk-bg)]">
        <td colSpan={2} className="px-3 py-0 text-[var(--diff-hunk-text)] whitespace-pre">
          <span className="text-[11px]">{hunkTag}</span>
          {readable && <span className="ml-2 text-[var(--diff-hunk-text)]/70">{readable}</span>}
        </td>
      </tr>
    );
  }

  const line = side === "old" ? row.left : row.right;
  return (
    <tr className="hover:brightness-95">
      <SplitCell line={line} side={side} lang={lang} />
    </tr>
  );
}

/** Renders line number + content cells for one half of a split row */
function SplitCell({ line, side, lang }: { line: ParsedLine | null; side: "old" | "new"; lang: string | null }) {
  if (!line) {
    return (
      <>
        <td className="w-[40px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 bg-[var(--bg-hover)]/50" />
        <td className="py-0 bg-[var(--bg-hover)]/50" />
      </>
    );
  }

  const isDel = line.type === "del";
  const isAdd = line.type === "add";

  const bg = isDel ? "bg-[var(--diff-del-bg)]" : isAdd ? "bg-[var(--diff-add-bg)]" : "";
  const numClass = isDel ? "text-[var(--diff-del-border)]/60" : isAdd ? "text-[var(--diff-add-border)]/60" : "text-[var(--text-secondary)]/30";
  const lineNum = side === "old" ? line.oldNum : line.newNum;
  const marker = isDel ? "−" : isAdd ? "+" : " ";
  const markerColor = isDel ? "text-[var(--diff-del-border)]" : isAdd ? "text-[var(--diff-add-border)]" : "text-transparent";

  return (
    <>
      <td className={`w-[40px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 ${numClass} ${bg}`}>
        {lineNum ?? ""}
      </td>
      <td className={`px-0 py-0 whitespace-pre text-[var(--text-primary)] ${bg}`}>
        <span className={`inline-block w-5 text-center select-none font-bold ${markerColor}`}>{marker}</span>
        <span dangerouslySetInnerHTML={{ __html: highlightLine(line.content, lang) }} />
      </td>
    </>
  );
}
