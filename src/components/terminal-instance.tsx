import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Channel } from "@tauri-apps/api/core";
import { getTerminalTheme } from "../lib/terminal-theme";
import { attachMacKeybindings } from "../lib/terminal-keybindings";
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
} from "../lib/tauri-commands";
import { useAppStore } from "../stores/app-store";
import { useThemeStore } from "../stores/theme-store";
import "@xterm/xterm/css/xterm.css";

interface Props {
  terminalId: string;
  projectPath: string;
}

export function TerminalInstance({ terminalId, projectPath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const setTerminalRunning = useAppStore((s) => s.setTerminalRunning);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: getTerminalTheme(useThemeStore.getState().isDark),
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      altClickMovesCursor: true,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);

    // Try WebGL addon for GPU-accelerated rendering
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Canvas renderer is the fallback — works fine
    }

    fitAddon.fit();

    // PTY write helper — shared by keybindings and onData
    const writeToPty = (data: string) => {
      writeTerminal(terminalId, data).catch(() => {});
    };

    // Attach macOS keybindings (Cmd+Delete, Cmd+Left/Right, Option+Left/Right, etc.)
    attachMacKeybindings(term, writeToPty);

    // Create Tauri channel for streaming PTY output
    const channel = new Channel<number[]>();
    channel.onmessage = (data) => {
      term.write(new Uint8Array(data));
    };

    // Connect to Rust PTY backend
    createTerminal(terminalId, projectPath, channel)
      .then(() => {
        // PTY connected — send initial resize to sync dimensions
        const { cols, rows } = term;
        resizeTerminal(terminalId, rows, cols).catch(() => {});
      })
      .catch((err) => {
        term.write(`\r\n\x1b[31m[Error: ${err}]\x1b[0m\r\n`);
        setTerminalRunning(terminalId, false);
      });

    // Send user input to PTY stdin
    term.onData((data) => {
      writeToPty(data);
    });

    // Send resize events to PTY
    term.onResize(({ cols, rows }) => {
      resizeTerminal(terminalId, rows, cols).catch(() => {});
    });

    // Handle window resize with debounce
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => fitAddon.fit(), 150);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
      // Kill PTY session on unmount
      killTerminal(terminalId).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [terminalId, projectPath, setTerminalRunning]);

  // Update xterm theme when app theme changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getTerminalTheme(isDark);
    }
  }, [isDark]);

  // Re-fit when this terminal becomes visible
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
  useEffect(() => {
    if (activeTerminalId === terminalId && fitRef.current) {
      requestAnimationFrame(() => {
        fitRef.current?.fit();
        termRef.current?.focus();
      });
    }
  }, [activeTerminalId, terminalId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: "4px" }}
    />
  );
}
