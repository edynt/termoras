import hljs from "highlight.js/lib/core";

// Register only common languages to keep bundle small
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import dockerfile from "highlight.js/lib/languages/dockerfile";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("dockerfile", dockerfile);

/** Map file extension to highlight.js language */
const EXT_MAP: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  html: "xml", htm: "xml", svg: "xml", vue: "xml",
  css: "css", scss: "css", less: "css",
  json: "json", jsonc: "json",
  md: "markdown", mdx: "markdown",
  py: "python", pyw: "python",
  rs: "rust",
  go: "go",
  java: "java", kt: "java", scala: "java",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  yml: "yaml", yaml: "yaml",
  sql: "sql",
  dockerfile: "dockerfile",
  toml: "yaml", // close enough
};

/** Detect language from file path */
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const basename = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (basename === "dockerfile") return "dockerfile";
  return EXT_MAP[ext] ?? null;
}

/** Highlight a single line of code, returns HTML string */
export function highlightLine(line: string, language: string | null): string {
  if (!language || !line.trim()) return escapeHtml(line);
  try {
    return hljs.highlight(line, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(line);
  }
}

/** Highlight full file content, returns array of HTML strings per line */
export function highlightCode(code: string, language: string | null): string[] {
  if (!language) return code.split("\n").map(escapeHtml);
  try {
    const result = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    return result.split("\n");
  } catch {
    return code.split("\n").map(escapeHtml);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
