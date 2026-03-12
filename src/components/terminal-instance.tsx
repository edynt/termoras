import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Paperclip } from "lucide-react";
import { getTerminalTheme } from "../lib/terminal-theme";
import { attachMacKeybindings } from "../lib/terminal-keybindings";
import { TelexEngine } from "../lib/telex-engine";
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  pickImageFile,
} from "../lib/tauri-commands";
import { saveImageBlob, isImageFile } from "../lib/image-upload";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
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
  const webglRef = useRef<WebglAddon | null>(null);
  const writeToPtyRef = useRef<((data: string) => void) | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const setTerminalRunning = useAppStore((s) => s.setTerminalRunning);
  const isDark = useThemeStore((s) => s.isDark);
  const vietnameseInput = useAppStore((s) => s.vietnameseInput);

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
      // Don't treat Option as Meta — required for IME input methods (Vietnamese Telex/VNI)
      macOptionIsMeta: false,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);

    // Try WebGL addon for GPU-accelerated rendering
    try {
      const webgl = new WebglAddon();
      // When parent goes display:none, WebGL context is lost. Dispose and
      // re-create the addon so the terminal falls back to canvas until
      // we reload WebGL on next visibility change.
      webgl.onContextLoss(() => {
        webgl.dispose();
        webglRef.current = null;
      });
      term.loadAddon(webgl);
      webglRef.current = webgl;
    } catch {
      // Canvas renderer is the fallback — works fine
    }

    // PTY write helper — shared by keybindings, onData, and image upload
    const writeToPty = (data: string) => {
      writeTerminal(terminalId, data).catch(() => {});
    };
    writeToPtyRef.current = writeToPty;

    // Telex engine for Vietnamese input (one per terminal instance)
    const telex = new TelexEngine();

    // Attach macOS keybindings + Vietnamese toggle (Ctrl+Shift+Space)
    // Vietnamese Telex processing happens below in onData, not in the key handler.
    attachMacKeybindings(term, writeToPty, telex);

    // Create Tauri channel for streaming PTY output
    const channel = new Channel<number[]>();
    channel.onmessage = (data) => {
      term.write(new Uint8Array(data));
    };

    // Listen for PTY exit BEFORE creating the PTY — prevents race where
    // shell exits instantly and the event fires before listener is registered.
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    listen<string>("terminal-exited", (event) => {
      if (event.payload === terminalId && !cancelled) {
        setTerminalRunning(terminalId, false);
      }
    }).then((fn) => {
      if (cancelled) fn(); // Component already unmounted — clean up immediately
      else unlisten = fn;
    });

    // Wait for web fonts + container layout before fitting and creating PTY.
    // Without this, fitAddon calculates wrong cols/rows from fallback font metrics
    // or zero-size container → text layout breaks on first open.
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const connectPty = () => {
        if (cancelled) return;
        const el = containerRef.current;
        // Poll until container has real dimensions (may be display:none initially)
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
          requestAnimationFrame(connectPty);
          return;
        }
        fitAddon.fit();
        const { cols, rows } = term;
        createTerminal(terminalId, projectPath, rows, cols, channel)
          .then(() => {
            if (!cancelled) setTerminalRunning(terminalId, true);
          })
          .catch((err) => {
            if (!cancelled) {
              term.write(`\r\n\x1b[31m[Error: ${err}]\x1b[0m\r\n`);
              setTerminalRunning(terminalId, false);
            }
          });
      };
      requestAnimationFrame(connectPty);
    });

    // Block WebKit's native "Paste" confirmation button by intercepting paste
    // at the capture phase on the container. All paste is handled via Cmd+V
    // keybinding using Tauri native clipboard (no browser clipboard API needed).
    const container = containerRef.current;
    const blockPaste = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Use Tauri native clipboard instead of browser paste
      readText().then((text) => {
        if (text) writeToPty(text);
      }).catch(() => {});
    };
    container?.addEventListener("paste", blockPaste, true);
    // Also prevent beforeinput "insertFromPaste" which WebKit fires before paste
    const blockBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertFromPaste") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    container?.addEventListener("beforeinput", blockBeforeInput as EventListener, true);

    // All user input flows through onData → single data path to PTY.
    // Vietnamese Telex processing intercepts here to transform keystrokes
    // before they reach the PTY. xterm.js does NOT echo locally — display
    // is driven entirely by PTY output, so transforms are visually seamless.
    term.onData((data) => {
      // Vietnamese mode: process single printable chars through Telex engine
      if (useAppStore.getState().vietnameseInput) {
        // Multi-char data (escape sequences, pastes) → reset buffer, passthrough
        if (data.length > 1) {
          telex.reset();
          writeToPty(data);
          return;
        }

        const code = data.charCodeAt(0);

        // Backspace → keep Telex buffer in sync, passthrough to shell
        if (data === "\x7f") {
          telex.popBuffer();
          writeToPty(data);
          return;
        }

        // Control characters (Enter, Tab, Ctrl+C, etc.) → reset buffer, passthrough
        if (code < 0x20) {
          telex.reset();
          writeToPty(data);
          return;
        }

        // Process printable character through Telex engine
        const result = telex.processKey(data);
        switch (result.type) {
          case "passthrough":
          case "commit":
            writeToPty(data);
            break;
          case "transform":
            // Send DEL chars to erase previous characters, then replacement text.
            // The shell's readline handles multibyte-aware backward-delete-char.
            writeToPty("\x7f".repeat(result.backspaces) + result.replacement);
            break;
        }
        return;
      }

      // Normal mode: passthrough all data directly to PTY
      writeToPty(data);
    });

    // Send resize events to PTY
    term.onResize(({ cols, rows }) => {
      resizeTerminal(terminalId, rows, cols).catch(() => {});
    });

    // Observe container size changes (sidebar drag, view switch, window resize, etc.)
    // Use rAF instead of setTimeout for faster, frame-aligned fitting
    let resizeRaf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => fitAddon.fit());
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelled = true;
      unlisten?.();
      container?.removeEventListener("paste", blockPaste, true);
      container?.removeEventListener("beforeinput", blockBeforeInput as EventListener, true);
      observer.disconnect();
      cancelAnimationFrame(resizeRaf);
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

  // Re-fit when this terminal becomes visible (tab switch OR view switch).
  // Polls until container has real dimensions (handles display:none → visible),
  // then forces PTY resize + full re-render to fix any stale layout.
  const activeTerminalId = useAppStore((s) => s.activeTerminalId);
  const activeView = useAppStore((s) => s.activeView);
  useEffect(() => {
    if (activeTerminalId !== terminalId || !fitRef.current || !termRef.current) return;
    let rafId = 0;
    const refit = () => {
      const el = containerRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
        // Container not laid out yet (display:none → visible transition), retry
        rafId = requestAnimationFrame(refit);
        return;
      }
      // Re-attach WebGL if context was lost (display:none kills it)
      if (!webglRef.current && termRef.current) {
        try {
          const webgl = new WebglAddon();
          webgl.onContextLoss(() => {
            webgl.dispose();
            webglRef.current = null;
          });
          termRef.current.loadAddon(webgl);
          webglRef.current = webgl;
        } catch {
          // Canvas fallback is fine
        }
      }
      fitRef.current?.fit();
      const term = termRef.current;
      if (term) {
        // Force PTY resize even if xterm dimensions unchanged — ensures shell
        // gets SIGWINCH and re-draws prompt at correct width
        resizeTerminal(terminalId, term.rows, term.cols).catch(() => {});
        term.refresh(0, term.rows - 1);
        term.focus();
      }
    };
    rafId = requestAnimationFrame(refit);
    return () => cancelAnimationFrame(rafId);
  }, [activeTerminalId, terminalId, activeView]);

  // Drag-and-drop handlers for image upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => isImageFile(f));
      if (imageFile && writeToPtyRef.current) {
        const path = await saveImageBlob(imageFile);
        writeToPtyRef.current(path + " ");
        termRef.current?.focus();
      }
    },
    [],
  );

  // Attach button: open file picker for images
  const handleAttachImage = useCallback(async () => {
    const path = await pickImageFile();
    if (path && writeToPtyRef.current) {
      writeToPtyRef.current(path + " ");
      termRef.current?.focus();
    }
  }, []);

  return (
    <div
      className="relative h-full w-full"
      style={{ padding: "4px" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Drag-and-drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--accent-blue)] bg-[var(--accent-blue)]/10">
          <span className="text-sm font-medium text-[var(--accent-blue)]">
            Drop image here
          </span>
        </div>
      )}

      {/* Attach image button */}
      <button
        onClick={handleAttachImage}
        className="absolute bottom-2 left-3 rounded p-1 text-[var(--text-secondary)] opacity-30 transition-opacity hover:text-[var(--accent-blue)] hover:opacity-100"
        title="Attach image"
      >
        <Paperclip size={14} />
      </button>

      {/* Vietnamese input mode indicator */}
      {vietnameseInput && (
        <div className="absolute bottom-2 right-3 px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] select-none pointer-events-none tracking-wide">
          VI
        </div>
      )}
    </div>
  );
}
