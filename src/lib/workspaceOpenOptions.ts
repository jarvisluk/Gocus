import antigravityAppIcon from "../assets/external-app-icons/antigravity-app.png";
import antigravityIcon from "../assets/external-app-icons/antigravity.png";
import codexIcon from "../assets/external-app-icons/codex.png";
import cursorIcon from "../assets/external-app-icons/cursor.png";
import finderIcon from "../assets/external-app-icons/finder.png";
import terminalIcon from "../assets/external-app-icons/terminal.png";
import vscodeIcon from "../assets/external-app-icons/vscode.png";
import xcodeIcon from "../assets/external-app-icons/xcode.png";
import type { WorkspaceOpenTarget } from "../types";

const explorerIconSrc = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path fill="#f6c15a" d="M6 18c0-3.3 2.7-6 6-6h15.2c2 0 3.8 1 4.9 2.6l2.3 3.4H52c3.3 0 6 2.7 6 6v2H6v-8Z"/>
  <path fill="#f1b53f" d="M6 23c0-3.3 2.7-6 6-6h40c3.3 0 6 2.7 6 6v26c0 3.3-2.7 6-6 6H12c-3.3 0-6-2.7-6-6V23Z"/>
  <path fill="#ffd767" d="M6 27h52v22c0 3.3-2.7 6-6 6H12c-3.3 0-6-2.7-6-6V27Z"/>
  <path fill="#3b82f6" d="M14 31h36c2.2 0 4 1.8 4 4v11c0 2.2-1.8 4-4 4H14c-2.2 0-4-1.8-4-4V35c0-2.2 1.8-4 4-4Z"/>
  <path fill="#60a5fa" d="M14 31h36c2.2 0 4 1.8 4 4v4H10v-4c0-2.2 1.8-4 4-4Z"/>
  <path fill="#2563eb" d="M10 39h44v7c0 2.2-1.8 4-4 4H14c-2.2 0-4-1.8-4-4v-7Z"/>
</svg>
`)}`;

export interface WorkspaceOpenOption {
  target: WorkspaceOpenTarget;
  label: string;
  iconSrc: string;
}

function browserPlatform() {
  if (typeof window === "undefined") return "";
  return window.navigator.platform;
}

function isWindowsPlatform(platform: string) {
  return platform.toLowerCase().includes("win");
}

export function fileManagerLabel(platform = browserPlatform()) {
  return isWindowsPlatform(platform) ? "Explorer" : "Finder";
}

export function fileManagerIconSrc(platform = browserPlatform()) {
  return isWindowsPlatform(platform) ? explorerIconSrc : finderIcon;
}

export const workspaceOpenOptions: WorkspaceOpenOption[] = [
  { target: "vscode", label: "VS Code", iconSrc: vscodeIcon },
  { target: "cursor", label: "Cursor", iconSrc: cursorIcon },
  { target: "codex", label: "Codex", iconSrc: codexIcon },
  { target: "antigravity", label: "Antigravity IDE", iconSrc: antigravityIcon },
  { target: "antigravityApp", label: "Antigravity", iconSrc: antigravityAppIcon },
  { target: "finder", label: fileManagerLabel(), iconSrc: fileManagerIconSrc() },
  { target: "terminal", label: "Terminal", iconSrc: terminalIcon },
  { target: "xcode", label: "Xcode", iconSrc: xcodeIcon },
];
