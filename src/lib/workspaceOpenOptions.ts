import antigravityAppIcon from "../assets/external-app-icons/antigravity-app.png";
import antigravityIcon from "../assets/external-app-icons/antigravity.png";
import codexIcon from "../assets/external-app-icons/codex.png";
import cursorIcon from "../assets/external-app-icons/cursor.png";
import finderIcon from "../assets/external-app-icons/finder.png";
import terminalIcon from "../assets/external-app-icons/terminal.png";
import vscodeIcon from "../assets/external-app-icons/vscode.png";
import xcodeIcon from "../assets/external-app-icons/xcode.png";
import type { WorkspaceOpenTarget } from "../types";

export interface WorkspaceOpenOption {
  target: WorkspaceOpenTarget;
  label: string;
  iconSrc: string;
}

function fileManagerLabel() {
  if (typeof window === "undefined") return "Finder";
  return window.navigator.platform.toLowerCase().includes("win") ? "Explorer" : "Finder";
}

export const workspaceOpenOptions: WorkspaceOpenOption[] = [
  { target: "vscode", label: "VS Code", iconSrc: vscodeIcon },
  { target: "cursor", label: "Cursor", iconSrc: cursorIcon },
  { target: "codex", label: "Codex", iconSrc: codexIcon },
  { target: "antigravity", label: "Antigravity IDE", iconSrc: antigravityIcon },
  { target: "antigravityApp", label: "Antigravity", iconSrc: antigravityAppIcon },
  { target: "finder", label: fileManagerLabel(), iconSrc: finderIcon },
  { target: "terminal", label: "Terminal", iconSrc: terminalIcon },
  { target: "xcode", label: "Xcode", iconSrc: xcodeIcon },
];
