import { useState, useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { useAppStore } from "../stores/app-store";

/** Sidebar footer button showing total alive terminals.
 *  Click to expand a popover with per-project breakdown. */
export function TerminalStatusButton() {
  const terminals = useAppStore((s) => s.terminals);
  const projects = useAppStore((s) => s.projects);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const aliveTerminals = terminals.filter((t) => t.isRunning);
  const totalAlive = aliveTerminals.length;
  const totalCount = terminals.length;

  // Per-project breakdown (only projects that have terminals)
  const breakdown = projects
    .map((p) => {
      const all = terminals.filter((t) => t.projectId === p.id);
      const alive = all.filter((t) => t.isRunning).length;
      return { name: p.name, alive, total: all.length };
    })
    .filter((b) => b.total > 0);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Status button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title={`${totalAlive} of ${totalCount} terminals running`}
      >
        <Terminal size={16} />
        <span className="text-xs font-medium">
          {totalAlive}/{totalCount}
        </span>
        {totalAlive > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green,#22c55e)]" />
        )}
      </button>

      {/* Popover with per-project breakdown */}
      {open && breakdown.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-52 rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-lg py-1 z-50">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Terminals
          </div>
          {breakdown.map((b) => (
            <div
              key={b.name}
              className="flex items-center justify-between px-3 py-1.5 text-xs"
            >
              <span className="truncate text-[var(--text-primary)]">{b.name}</span>
              <span className="shrink-0 ml-2 font-medium">
                <span className={b.alive > 0 ? "text-[var(--accent-green,#22c55e)]" : "text-[var(--text-secondary)]"}>
                  {b.alive}
                </span>
                <span className="text-[var(--text-secondary)]">/{b.total}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
