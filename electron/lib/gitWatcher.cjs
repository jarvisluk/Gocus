const fs = require("node:fs");
const path = require("node:path");

const defaultDebounceMs = 650;
const ignoredWorktreeParts = new Set([".git", "node_modules", "dist", ".vite", "coverage", ".turbo", ".next", ".DS_Store"]);

function safeRealpathSync(pathValue) {
  try {
    return fs.realpathSync.native(pathValue);
  } catch {
    try {
      return fs.realpathSync(pathValue);
    } catch {
      return path.resolve(pathValue);
    }
  }
}

function readGitDir(root) {
  const dotGitPath = path.join(root, ".git");

  try {
    const stat = fs.statSync(dotGitPath);
    if (stat.isDirectory()) return dotGitPath;
  } catch {
    return "";
  }

  try {
    const gitFile = fs.readFileSync(dotGitPath, "utf8");
    const gitDirLine = gitFile
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().startsWith("gitdir:"));
    if (!gitDirLine) return "";

    const rawGitDir = gitDirLine.slice("gitdir:".length).trim();
    return path.isAbsolute(rawGitDir) ? rawGitDir : path.resolve(root, rawGitDir);
  } catch {
    return "";
  }
}

function readCommonDir(gitDir) {
  if (!gitDir) return "";

  try {
    const commonDirFile = path.join(gitDir, "commondir");
    if (!fs.existsSync(commonDirFile)) return gitDir;

    const commonDir = fs.readFileSync(commonDirFile, "utf8").trim();
    return path.isAbsolute(commonDir) ? commonDir : path.resolve(gitDir, commonDir);
  } catch {
    return gitDir;
  }
}

function resolveRepositoryWatchPaths(repositoryPath) {
  const root = safeRealpathSync(repositoryPath);
  const rawGitDir = readGitDir(root);
  if (!rawGitDir) throw new Error("Repository watcher requires a Git repository.");

  const gitDir = safeRealpathSync(rawGitDir);
  const commonDir = safeRealpathSync(readCommonDir(gitDir));

  return {
    root,
    gitDir,
    commonDir,
  };
}

function pathExists(pathValue) {
  try {
    fs.accessSync(pathValue);
    return true;
  } catch {
    return false;
  }
}

function isIgnoredWorktreePath(filename) {
  if (!filename) return false;

  return String(filename)
    .split(/[\\/]+/)
    .some((part) => ignoredWorktreeParts.has(part));
}

function createRepositoryWatcher(repositoryPath, onRefresh, options = {}) {
  const debounceMs = Number.isFinite(options.debounceMs) ? options.debounceMs : defaultDebounceMs;
  const logger = options.logger ?? console;
  const watchers = [];
  const watchPaths = resolveRepositoryWatchPaths(repositoryPath);
  let refreshTimer = null;
  let refreshInFlight = false;
  let refreshQueued = false;
  let closed = false;

  function scheduleRefresh(reason) {
    if (closed) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      flushRefresh(reason);
    }, debounceMs);
  }

  async function flushRefresh(reason) {
    if (closed) return;

    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;

    try {
      await onRefresh(reason);
    } catch (error) {
      logger.warn("[Git Peek] Repository watcher refresh failed.", error);
    } finally {
      refreshInFlight = false;

      if (refreshQueued && !closed) {
        refreshQueued = false;
        scheduleRefresh("queued repository change");
      }
    }
  }

  function addWatcher(targetPath, label, optionsForWatch = {}, eventFilter = () => true) {
    if (!targetPath || !pathExists(targetPath)) return;

    try {
      const watcher = fs.watch(targetPath, optionsForWatch, (_eventType, filename) => {
        if (eventFilter(filename)) scheduleRefresh(label);
      });
      watcher.on("error", (error) => logger.warn(`[Git Peek] Repository watcher error for ${label}.`, error));
      watchers.push(watcher);
    } catch (error) {
      if (optionsForWatch.recursive) {
        addWatcher(targetPath, label, {}, eventFilter);
        return;
      }

      logger.warn(`[Git Peek] Unable to watch ${label}.`, error);
    }
  }

  addWatcher(watchPaths.root, "working tree change", { recursive: true }, (filename) => !isIgnoredWorktreePath(filename));
  addWatcher(watchPaths.gitDir, "git metadata change", { recursive: true });

  if (watchPaths.commonDir && watchPaths.commonDir !== watchPaths.gitDir) {
    addWatcher(watchPaths.commonDir, "git common metadata change", { recursive: true });
  }

  for (const gitPath of new Set([watchPaths.gitDir, watchPaths.commonDir])) {
    addWatcher(path.join(gitPath, "refs", "heads"), "branch ref change");
    addWatcher(path.join(gitPath, "refs", "remotes"), "remote ref change");
    addWatcher(path.join(gitPath, "refs", "tags"), "tag ref change");
  }

  return {
    repositoryPath: watchPaths.root,
    close() {
      closed = true;
      clearTimeout(refreshTimer);
      for (const watcher of watchers) watcher.close();
      watchers.length = 0;
    },
  };
}

module.exports = { createRepositoryWatcher };
