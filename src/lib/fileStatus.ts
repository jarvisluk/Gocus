import type { ChangedFile, FileFilter } from "../types";

export function fileKind(file: ChangedFile): FileFilter {
  if (file.status.includes("?")) return "untracked";
  if (file.indexStatus && file.indexStatus !== " ") return "staged";
  return "modified";
}

export function statusLetter(file: ChangedFile) {
  if (file.status.includes("?")) return "U";
  if (file.status.includes("A")) return "A";
  if (file.status.includes("D")) return "D";
  if (file.status.includes("R")) return "R";
  if (file.status.includes("C")) return "C";
  return "M";
}

export function formatPath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `${parts.slice(0, -1).join("/")}/${parts.at(-1)}`;
}
