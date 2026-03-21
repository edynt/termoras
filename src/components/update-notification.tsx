import { X, Download } from "lucide-react";
import type { UpdateInfo } from "../hooks/use-update-checker";

interface Props {
  info: UpdateInfo;
  onDismiss: () => void;
}

export function UpdateNotification({ info, onDismiss }: Props) {
  return (
    <div className="fixed top-10 right-4 z-[9999] w-[340px] rounded-lg border border-[var(--accent-blue)]/30 bg-[var(--bg-elevated)] animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <Download size={14} className="text-[var(--accent-blue)]" />
          Update Available
        </span>
        <button
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="text-xs text-[var(--text-secondary)] mb-2">
          <span className="text-[var(--text-secondary)]/70">v{info.currentVersion}</span>
          {" → "}
          <span className="font-medium text-[var(--accent-blue)]">{info.latestVersion}</span>
        </p>

        <a
          href={info.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
        >
          <Download size={12} />
          Download Update
        </a>
      </div>
    </div>
  );
}
