import { useMemo } from "react";

interface Props {
  diff: string;
  filePath: string;
}

interface ParsedLine {
  type: "add" | "del" | "context" | "hunk" | "meta";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

/** Parse unified diff into structured lines with line numbers */
function parseDiff(diff: string): ParsedLine[] {
  const raw = diff.split("\n");
  const result: ParsedLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw) {
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,count +newStart,count @@
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
      // Context line (starts with space or is empty)
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

/** Render git diff with GitHub-style line numbers and colors */
export function GitDiffViewer({ diff, filePath }: Props) {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-secondary)]">
        No diff available (file may be untracked or binary)
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
        <span className="text-xs font-mono font-medium">{filePath}</span>
      </div>

      {/* Diff table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[12px] leading-[20px] font-mono border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <DiffRow key={i} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Single diff row — GitHub-style with dual line numbers + colored gutter */
function DiffRow({ line }: { line: ParsedLine }) {
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
    // Extract the readable part after @@...@@
    const readable = line.content.replace(/^@@.*?@@/, "").trim();
    return (
      <tr className="bg-[var(--diff-hunk-bg)]">
        <td className="w-[1px] px-2 py-0 text-right text-[var(--diff-hunk-text)]/50 select-none border-r border-[var(--border-color)]">
          ···
        </td>
        <td className="w-[1px] px-2 py-0 text-right text-[var(--diff-hunk-text)]/50 select-none border-r border-[var(--border-color)]">
          ···
        </td>
        <td className="px-3 py-0 text-[var(--diff-hunk-text)] whitespace-pre">
          <span className="text-[11px]">{line.content.match(/@@ .+? @@/)?.[0]}</span>
          {readable && <span className="ml-2 text-[var(--diff-hunk-text)]/70">{readable}</span>}
        </td>
      </tr>
    );
  }

  const isAdd = line.type === "add";
  const isDel = line.type === "del";

  // Row background
  const rowBg = isAdd
    ? "bg-[var(--diff-add-bg)]"
    : isDel
    ? "bg-[var(--diff-del-bg)]"
    : "";

  // Line number styling
  const numClass = isAdd
    ? "text-[var(--diff-add-border)]/60"
    : isDel
    ? "text-[var(--diff-del-border)]/60"
    : "text-[var(--text-secondary)]/30";

  // Gutter marker
  const marker = isAdd ? "+" : isDel ? "−" : " ";
  const markerColor = isAdd
    ? "text-[var(--diff-add-border)]"
    : isDel
    ? "text-[var(--diff-del-border)]"
    : "text-transparent";

  return (
    <tr className={`${rowBg} hover:brightness-95`}>
      {/* Old line number */}
      <td className={`w-[1px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 ${numClass}`}>
        {line.oldNum ?? ""}
      </td>
      {/* New line number */}
      <td className={`w-[1px] min-w-[40px] px-2 py-0 text-right text-[11px] select-none border-r border-[var(--border-color)]/50 ${numClass}`}>
        {line.newNum ?? ""}
      </td>
      {/* Content */}
      <td className="px-0 py-0 whitespace-pre text-[var(--text-primary)]">
        <span className={`inline-block w-5 text-center select-none font-bold ${markerColor}`}>{marker}</span>
        {line.content}
      </td>
    </tr>
  );
}
