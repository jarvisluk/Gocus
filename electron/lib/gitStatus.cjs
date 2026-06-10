const { safeInteger } = require("./gitCore.cjs");

function parseBranchLine(line) {
  const clean = line.replace(/^##\s*/, "");
  const result = {
    name: clean,
    upstream: "",
    ahead: 0,
    behind: 0,
    detached: false,
  };

  if (clean.startsWith("HEAD ")) {
    result.name = "detached";
    result.detached = true;
    return result;
  }

  const unbornMatch = clean.match(/^No commits yet on (.+)$/);
  if (unbornMatch) {
    result.name = unbornMatch[1];
    return result;
  }

  const [branchPart, metaPart = ""] = clean.split("...");
  result.name = branchPart || "main";

  if (metaPart) {
    const upstream = metaPart.replace(/\s*\[.*\]\s*$/, "");
    result.upstream = upstream;

    const aheadMatch = metaPart.match(/ahead\s+(\d+)/);
    const behindMatch = metaPart.match(/behind\s+(\d+)/);
    result.ahead = aheadMatch ? safeInteger(aheadMatch[1]) : 0;
    result.behind = behindMatch ? safeInteger(behindMatch[1]) : 0;
  }

  return result;
}

function splitStatusPath(pathText) {
  const renameMarker = " -> ";
  if (!pathText.includes(renameMarker)) return { path: pathText };
  const [originalPath, nextPath] = pathText.split(renameMarker);
  return { originalPath, path: nextPath };
}

function statusLabel(code) {
  if (code === "??") return "Untracked";
  if (code.includes("R")) return "Renamed";
  if (code.includes("C")) return "Copied";
  if (code.includes("A")) return "Added";
  if (code.includes("D")) return "Deleted";
  if (code[0] !== " " && code[1] !== " ") return "Staged and modified";
  if (code[0] !== " ") return "Staged";
  return "Modified";
}

function parseStatus(shortStatus) {
  const lines = shortStatus.split("\n").filter(Boolean);
  const branchLine = lines[0]?.startsWith("##") ? lines[0] : "## main";
  const fileLines = lines[0]?.startsWith("##") ? lines.slice(1) : lines;
  const counts = { modified: 0, staged: 0, untracked: 0 };
  const files = [];

  for (const line of fileLines) {
    const code = line.slice(0, 2);
    const pathParts = splitStatusPath(line.slice(3));
    const x = code[0];
    const y = code[1];

    if (code === "??") {
      counts.untracked += 1;
    } else {
      if (x && x !== " ") counts.staged += 1;
      if (y && y !== " ") counts.modified += 1;
    }

    files.push({
      ...pathParts,
      status: code.trim() || "M",
      indexStatus: x,
      workingTreeStatus: y,
      statusLabel: statusLabel(code),
      additions: 0,
      deletions: 0,
    });
  }

  return {
    branch: parseBranchLine(branchLine),
    counts,
    files,
  };
}

function applyNumstat(files, output) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const line of output.split("\n").filter(Boolean)) {
    const [insertions, deletions, filePath] = line.split("\t");
    if (!filePath) continue;
    const normalizedPath = filePath.replace(/^.* => /, "");
    const file = byPath.get(normalizedPath) ?? byPath.get(filePath);
    if (!file) continue;
    file.additions += insertions === "-" ? 0 : safeInteger(insertions);
    file.deletions += deletions === "-" ? 0 : safeInteger(deletions);
  }
}

module.exports = {
  applyNumstat,
  parseBranchLine,
  parseStatus,
  splitStatusPath,
  statusLabel,
};
