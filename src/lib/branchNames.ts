export const branchPrefixes = ["none", "feat", "fix", "chore", "docs", "refactor", "test"] as const;

export type BranchPrefix = (typeof branchPrefixes)[number];

export function branchNameWithPrefix(prefix: BranchPrefix, branchName: string) {
  const trimmedName = branchName.trim().replace(/^\/+/, "");
  if (!trimmedName || prefix === "none" || trimmedName.startsWith(`${prefix}/`)) return trimmedName;
  return `${prefix}/${trimmedName}`;
}

export function branchNameValidationMessage(branchName: string) {
  const trimmedName = branchName.trim();
  if (!trimmedName) return "Enter a branch name.";
  if (trimmedName.startsWith("-")) return "Branch names cannot start with a dash.";
  if (trimmedName === "HEAD") return "Branch names cannot be HEAD.";
  if (trimmedName.endsWith("/") || trimmedName.includes("//")) return "Branch names cannot contain empty path segments.";
  if (trimmedName.endsWith(".")) return "Branch names cannot end with a dot.";
  if (trimmedName.includes("..")) return "Branch names cannot contain consecutive dots.";
  if (trimmedName.includes("@{")) return "Branch names cannot contain @{.";
  if (/[\s~^:?*[\]\\\x00-\x1f\x7f]/.test(trimmedName)) return "Branch names cannot contain spaces or ~ ^ : ? * [ \\.";
  if (trimmedName.split("/").some((segment) => segment.startsWith("."))) return "Branch path segments cannot start with a dot.";
  if (trimmedName.split("/").some((segment) => segment.endsWith(".lock"))) return "Branch path segments cannot end with .lock.";
  return "";
}
