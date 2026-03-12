import { useState } from "react";
import { ArrowDownCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "done" | "error" | "up-to-date";

export function UpdateButton() {
  const [state, setState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setState("checking");
    setError(null);
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setState("available");
      } else {
        setState("up-to-date");
        setTimeout(() => setState("idle"), 3000);
      }
    } catch (e) {
      setError(String(e));
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  async function handleInstall() {
    if (!update) return;
    setState("downloading");
    setProgress(0);
    try {
      let totalLen = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalLen = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalLen > 0) setProgress(Math.round((downloaded / totalLen) * 100));
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });
      setState("done");
      // Relaunch after short delay
      setTimeout(() => relaunch(), 1000);
    } catch (e) {
      setError(String(e));
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  }

  // Idle — check for updates button
  if (state === "idle") {
    return (
      <button
        onClick={handleCheck}
        className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title="Check for updates"
      >
        <RefreshCw size={18} />
      </button>
    );
  }

  // Checking
  if (state === "checking") {
    return (
      <button
        disabled
        className="p-1.5 rounded-md text-[var(--text-secondary)] cursor-wait"
        title="Checking for updates..."
      >
        <Loader2 size={18} className="animate-spin" />
      </button>
    );
  }

  // Update available — click to install
  if (state === "available") {
    return (
      <button
        onClick={handleInstall}
        className="p-1.5 rounded-md hover:bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] transition-colors animate-pulse"
        title={`Update available: v${update?.version}. Click to install.`}
      >
        <ArrowDownCircle size={18} />
      </button>
    );
  }

  // Downloading
  if (state === "downloading") {
    return (
      <button
        disabled
        className="relative p-1.5 rounded-md text-[var(--accent-blue)] cursor-wait"
        title={`Downloading... ${progress}%`}
      >
        <Loader2 size={18} className="animate-spin" />
      </button>
    );
  }

  // Done — restarting
  if (state === "done") {
    return (
      <button
        disabled
        className="p-1.5 rounded-md text-[var(--accent-green)]"
        title="Restarting..."
      >
        <Check size={18} />
      </button>
    );
  }

  // Up to date
  if (state === "up-to-date") {
    return (
      <button
        disabled
        className="p-1.5 rounded-md text-[var(--accent-green)]"
        title="You're on the latest version"
      >
        <Check size={18} />
      </button>
    );
  }

  // Error
  return (
    <button
      onClick={handleCheck}
      className="p-1.5 rounded-md text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 transition-colors"
      title={`Update failed: ${error}. Click to retry.`}
    >
      <RefreshCw size={18} />
    </button>
  );
}
