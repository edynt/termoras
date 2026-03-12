import { useState, useEffect, useRef } from "react";
import { Terminal, X } from "lucide-react";
import { useAppStore } from "../stores/app-store";
import { killTerminal } from "../lib/tauri-commands";

/** Sidebar footer button showing total alive terminals.
 *  Click to expand a popover with per-project terminal list + kill buttons. */
export function TerminalStatusButton() {
  const terminals = useAppStore((s) => s.terminals);
  const projects = useAppStore((s) => s.projects);
  const [open, setOpen] = useState(false);
  const [confirmKill, setConfirmKill] = useState<{ id: string; name: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const setActiveTerminal = useAppStore((s) => s.setActiveTerminal);
  const removeTerminal = useAppStore((s) => s.removeTerminal);
  const aliveTerminals = terminals.filter((t) => t.isRunning);
  const totalAlive = aliveTerminals.length;
  const totalCount = terminals.length;

  // Per-project groups (only projects that have terminals)
  const groups = projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      terminals: terminals.filter((t) => t.projectId === p.id),
    }))
    .filter((g) => g.terminals.length > 0);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  async function handleKill(terminalId: string) {
    try {
      await killTerminal(terminalId);
    } catch { /* ignore */ }
    removeTerminal(terminalId);
  }

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

      {/* Popover with per-project terminal list */}
      {open && groups.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-60 max-h-[300px] overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-lg py-1 z-50">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Terminals
          </div>
          {groups.map((g) => (
            <div key={g.id}>
              {/* Project header — click to switch */}
              <button
                onClick={() => {
                  setActiveProject(g.id);
                  setActiveView("terminal");
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <span className="truncate text-[var(--text-primary)]">{g.name}</span>
                <span className="shrink-0 ml-2 text-[var(--text-secondary)]">
                  {g.terminals.filter((t) => t.isRunning).length}/{g.terminals.length}
                </span>
              </button>
              {/* Individual terminals */}
              {g.terminals.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-1.5 pl-6 pr-2 py-1 text-xs hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {/* Running indicator */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.isRunning ? "bg-[var(--accent-green,#22c55e)]" : "bg-[var(--text-secondary)]/30"
                    }`}
                  />
                  {/* Terminal name — click to open */}
                  <button
                    onClick={() => {
                      setActiveProject(g.id);
                      setActiveTerminal(t.id);
                      setOpen(false);
                    }}
                    className="flex-1 text-left truncate text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {t.name}
                  </button>
                  {/* Kill button — opens confirmation */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmKill({ id: t.id, name: t.name });
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--accent-red)]/15 text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-all"
                    title={`Kill ${t.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Kill confirmation modal */}
      {confirmKill && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setConfirmKill(null)}
        >
          <div
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-4 w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-1">Kill Terminal</p>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Kill{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {confirmKill.name}
              </span>
              ? This will terminate the process.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKill(null)}
                className="text-xs px-3 py-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleKill(confirmKill.id);
                  setConfirmKill(null);
                }}
                className="text-xs px-3 py-1.5 rounded bg-[var(--accent-red)] text-white hover:opacity-90"
              >
                Kill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
