import type { ChangedFile } from "../types";

export function changedFileKey(file: ChangedFile) {
  return `${file.status}-${file.path}-${file.originalPath ?? ""}`;
}
