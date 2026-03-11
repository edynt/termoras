interface Props {
  diff: string;
  filePath: string;
}

/** Render git diff output with syntax-highlighted lines */
export function GitDiffViewer({ diff, filePath }: Props) {
  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-secondary)]">
        No diff available (file may be untracked or binary)
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
        <span className="text-xs font-mono font-medium">{filePath}</span>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        <pre className="text-[12px] leading-[1.6] font-mono">
          {lines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </pre>
      </div>
    </div>
  );
}

/** Single diff line with color coding */
function DiffLine({ line }: { line: string }) {
  let className = "px-4 py-0 whitespace-pre ";
  let lineNum = "";

  if (line.startsWith("+++") || line.startsWith("---")) {
    className += "text-[var(--text-secondary)] font-bold";
  } else if (line.startsWith("@@")) {
    className += "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]";
  } else if (line.startsWith("+")) {
    className += "bg-[var(--accent-green)]/10 text-[var(--accent-green)]";
    lineNum = "+";
  } else if (line.startsWith("-")) {
    className += "bg-[var(--accent-red)]/10 text-[var(--accent-red)]";
    lineNum = "-";
  } else {
    className += "text-[var(--text-primary)]";
  }

  return (
    <div className={className}>
      <span className="inline-block w-4 text-right mr-2 text-[var(--text-secondary)]/40 select-none">
        {lineNum}
      </span>
      {line}
    </div>
  );
}
