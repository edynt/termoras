export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface TerminalSession {
  id: string;
  projectId: string;
  name: string;
  isRunning: boolean;
}

export type ThemeMode = "light" | "dark" | "system";
