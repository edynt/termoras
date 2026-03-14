import {
  FileText,
  FileCode2,
  FileJson2,
  FileType,
  Image,
  Lock,
  Settings,
  Shield,
  Braces,
  Database,
  Terminal,
  type LucideIcon,
} from "lucide-react";

interface FileIconProps {
  filename: string;
  size?: number;
  className?: string;
}

interface IconConfig {
  icon: LucideIcon;
  color: string;
}

/** Extension → icon + color mapping (Material Icon Theme inspired) */
const EXT_MAP: Record<string, IconConfig> = {
  // TypeScript
  ts:   { icon: FileCode2, color: "#3178c6" },
  tsx:  { icon: FileCode2, color: "#1cbdf6" },
  // JavaScript
  js:   { icon: FileCode2, color: "#f0db4f" },
  jsx:  { icon: FileCode2, color: "#61dafb" },
  mjs:  { icon: FileCode2, color: "#f0db4f" },
  cjs:  { icon: FileCode2, color: "#f0db4f" },
  // Web
  html: { icon: FileType, color: "#e44d26" },
  htm:  { icon: FileType, color: "#e44d26" },
  css:  { icon: FileType, color: "#1572b6" },
  scss: { icon: FileType, color: "#cd6799" },
  sass: { icon: FileType, color: "#cd6799" },
  less: { icon: FileType, color: "#1d365d" },
  // Data / Config
  json: { icon: FileJson2, color: "#f0db4f" },
  yaml: { icon: FileText, color: "#cb171e" },
  yml:  { icon: FileText, color: "#cb171e" },
  toml: { icon: Settings, color: "#9c4121" },
  xml:  { icon: FileType, color: "#e44d26" },
  csv:  { icon: Database, color: "#4caf50" },
  // Rust
  rs:   { icon: Settings, color: "#dea584" },
  // Python
  py:   { icon: FileCode2, color: "#3572a5" },
  // Go
  go:   { icon: FileCode2, color: "#00acd7" },
  // Shell
  sh:   { icon: Terminal, color: "#89e051" },
  bash: { icon: Terminal, color: "#89e051" },
  zsh:  { icon: Terminal, color: "#89e051" },
  fish: { icon: Terminal, color: "#89e051" },
  // Markdown
  md:   { icon: FileText, color: "#519aba" },
  mdx:  { icon: FileText, color: "#519aba" },
  // Images
  svg:  { icon: Image, color: "#ffb300" },
  png:  { icon: Image, color: "#26a69a" },
  jpg:  { icon: Image, color: "#26a69a" },
  jpeg: { icon: Image, color: "#26a69a" },
  gif:  { icon: Image, color: "#26a69a" },
  webp: { icon: Image, color: "#26a69a" },
  ico:  { icon: Image, color: "#26a69a" },
  // Lock / config
  lock: { icon: Lock, color: "#8b8b8b" },
  // SQL
  sql:  { icon: Database, color: "#e38c00" },
  // Env
  env:  { icon: Shield, color: "#ecd53f" },
};

/** Special full-filename overrides */
const FILENAME_MAP: Record<string, IconConfig> = {
  "package.json":      { icon: Braces,   color: "#4caf50" },
  "tsconfig.json":     { icon: Settings, color: "#3178c6" },
  "vite.config.ts":    { icon: Settings, color: "#646cff" },
  "vite.config.js":    { icon: Settings, color: "#646cff" },
  "tailwind.config.ts":{ icon: Settings, color: "#38bdf8" },
  "tailwind.config.js":{ icon: Settings, color: "#38bdf8" },
  ".gitignore":        { icon: FileText, color: "#f54d27" },
  ".eslintrc":         { icon: Settings, color: "#4b32c3" },
  ".prettierrc":       { icon: Settings, color: "#56b3b4" },
  "Dockerfile":        { icon: FileCode2, color: "#2496ed" },
  "docker-compose.yml":{ icon: FileCode2, color: "#2496ed" },
  "Cargo.toml":        { icon: Settings, color: "#dea584" },
  "Cargo.lock":        { icon: Lock,     color: "#dea584" },
  "README.md":         { icon: FileText, color: "#519aba" },
  ".env":              { icon: Shield,   color: "#ecd53f" },
  ".env.local":        { icon: Shield,   color: "#ecd53f" },
  ".env.example":      { icon: Shield,   color: "#ecd53f" },
};

function getIconConfig(filename: string): IconConfig {
  const basename = filename.split("/").pop() ?? filename;

  // Check full filename first
  if (FILENAME_MAP[basename]) return FILENAME_MAP[basename];

  // Check extension (handle .env.local style)
  const ext = basename.includes(".")
    ? basename.split(".").pop()?.toLowerCase() ?? ""
    : "";

  // Handle dotfiles starting with .env
  if (basename.startsWith(".env")) return EXT_MAP.env;

  return EXT_MAP[ext] ?? { icon: FileText, color: "var(--text-secondary)" };
}

export function FileIcon({ filename, size = 16, className = "" }: FileIconProps) {
  const { icon: Icon, color } = getIconConfig(filename);
  return <Icon size={size} className={`shrink-0 ${className}`} style={{ color }} />;
}
