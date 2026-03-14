import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

const GITHUB_REPO = "edynt/termoras";
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const DISMISSED_KEY = "termoras:update-dismissed";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

/** Compare two semver strings. Returns true if b > a. */
function isNewer(current: string, latest: string): boolean {
  const a = current.replace(/^v/, "").split(".").map(Number);
  const b = latest.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return true;
    if ((b[i] ?? 0) < (a[i] ?? 0)) return false;
  }
  return false;
}

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const currentVersion = await getVersion();

        // Skip if user already dismissed this version
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed) {
          const { version, time } = JSON.parse(dismissed);
          const elapsed = Date.now() - time;
          // Re-check after interval even if dismissed
          if (elapsed < CHECK_INTERVAL_MS) {
            // But still check if there's an even newer version
            const res = await fetch(
              `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
            );
            if (!res.ok) return;
            const data = await res.json();
            const latestTag = data.tag_name as string;
            // If same version was dismissed, skip
            if (latestTag.replace(/^v/, "") === version.replace(/^v/, "")) return;
          }
        }

        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        );
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const latestTag = data.tag_name as string;

        if (isNewer(currentVersion, latestTag) && !cancelled) {
          setUpdateInfo({
            currentVersion,
            latestVersion: latestTag,
            releaseUrl: data.html_url,
            releaseNotes: data.body ?? "",
          });
        }
      } catch {
        // Silently fail — network unavailable, rate limited, etc.
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function dismiss() {
    if (updateInfo) {
      localStorage.setItem(
        DISMISSED_KEY,
        JSON.stringify({ version: updateInfo.latestVersion, time: Date.now() }),
      );
    }
    setUpdateInfo(null);
  }

  return { updateInfo, dismiss };
}
