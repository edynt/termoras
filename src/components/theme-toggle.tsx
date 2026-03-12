import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore } from "../stores/theme-store";
import type { ThemeMode } from "../types";

const modes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-[var(--bg-active)] p-0.5">
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          className={`p-1 rounded transition-colors duration-150 ${
            mode === value
              ? "bg-[var(--bg-primary)] text-[var(--accent-blue)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title={label}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
