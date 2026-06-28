const fs = require("node:fs");
const path = require("node:path");

const maxRecentRepositories = 8;
const workspaceOpenTargetValues = ["vscode", "cursor", "codex", "antigravity", "antigravityApp", "finder", "terminal", "xcode"];
const defaultActiveWorkspaceOpenTarget = "vscode";

const defaultPreferences = {
  themeMode: "dark",
  lightThemePreset: "paper",
  darkThemePreset: "graphite",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
  workspaceOpenTargets: [...workspaceOpenTargetValues],
  showMenuBarIcon: true,
  showDockIcon: false,
  launchAtLogin: false,
  autoUpdateChannel: "stable",
  autoUpdateChecks: true,
  autoUpdateInstall: false,
  createMergeCommit: true,
  autoRefreshInterval: "off",
  promptLanguage: "en",
};

function sanitizeActiveWorkspaceOpenTarget(target, fallback = defaultActiveWorkspaceOpenTarget) {
  return workspaceOpenTargetValues.includes(target) ? target : fallback;
}

function sanitizePreferences(preferences) {
  const source = preferences && typeof preferences === "object" ? preferences : {};
  const nextPreferences = { ...defaultPreferences };

  for (const key of Object.keys(defaultPreferences)) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      nextPreferences[key] = source[key];
    }
  }

  return nextPreferences;
}

function normalizeRepositoryPath(repositoryPath) {
  if (typeof repositoryPath !== "string") return "";
  const trimmed = repositoryPath.trim();
  return trimmed ? path.resolve(trimmed) : "";
}

function safeRealpath(pathValue) {
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

function gitCommonDirForRepository(repositoryPath) {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  if (!normalizedPath) return "";

  const dotGitPath = path.join(normalizedPath, ".git");
  try {
    const stat = fs.statSync(dotGitPath);
    if (stat.isDirectory()) return safeRealpath(dotGitPath);
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
    const gitDir = path.isAbsolute(rawGitDir) ? rawGitDir : path.resolve(normalizedPath, rawGitDir);
    const commonDirFile = path.join(gitDir, "commondir");
    const commonDir = fs.existsSync(commonDirFile) ? fs.readFileSync(commonDirFile, "utf8").trim() : ".";
    return safeRealpath(path.resolve(gitDir, commonDir));
  } catch {
    return "";
  }
}

function repositoryKeyForPath(repositoryPath, fallbackKey = "") {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  if (!normalizedPath) return "";
  const gitCommonDir = gitCommonDirForRepository(normalizedPath);
  return gitCommonDir ? `git:${gitCommonDir}` : fallbackKey || `path:${normalizedPath}`;
}

function repositoryEntry(repositoryPath, repositoryKey = "") {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  if (!normalizedPath) return null;
  const normalizedRepositoryKey = repositoryKeyForPath(normalizedPath, repositoryKey);

  return {
    path: normalizedPath,
    name: path.basename(normalizedPath) || normalizedPath,
    repositoryKey: normalizedRepositoryKey,
  };
}

function readRepositoryPathFromEntry(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.path === "string") return entry.path;
  return "";
}

function sanitizeRecentRepositories(value) {
  const entries = Array.isArray(value) ? value : [];
  const seen = new Set();
  const repositories = [];

  for (const entry of entries) {
    const repository = repositoryEntry(readRepositoryPathFromEntry(entry), entry?.repositoryKey);
    const dedupeKey = repository?.repositoryKey || repository?.path;
    if (!repository || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    repositories.push(repository);
    if (repositories.length >= maxRecentRepositories) break;
  }

  return repositories;
}

function addRecentRepository(config, repositoryPath, repositoryKey = "") {
  const repository = repositoryEntry(repositoryPath, repositoryKey);
  if (!repository) return config;
  const dedupeKey = repository.repositoryKey || repository.path;

  const nextRecentRepositories = [
    repository,
    ...sanitizeRecentRepositories(config.recentRepositories).filter((entry) => (entry.repositoryKey || entry.path) !== dedupeKey),
  ].slice(0, maxRecentRepositories);

  return {
    ...config,
    repositoryPath: repository.path,
    recentRepositories: nextRecentRepositories,
  };
}

function removeRecentRepository(config, repositoryPath, repositoryKey = "") {
  const repository = repositoryEntry(repositoryPath, repositoryKey);
  if (!repository) return { ...config, recentRepositories: sanitizeRecentRepositories(config.recentRepositories) };

  const removeKey = repository.repositoryKey || repository.path;
  const removePath = repository.path;
  const nextRecentRepositories = sanitizeRecentRepositories(config.recentRepositories).filter(
    (entry) => entry.path !== removePath && (entry.repositoryKey || entry.path) !== removeKey,
  );

  return {
    ...config,
    recentRepositories: nextRecentRepositories,
  };
}

function createConfigStore(app) {
  function getConfigPath() {
    return path.join(app.getPath("userData"), "config.json");
  }

  function readConfig() {
    try {
      return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
    } catch {
      return {};
    }
  }

  function writeConfig(config) {
    const configPath = getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return {
    readConfig,
    writeConfig,
    readRepositoryPath() {
      const repositoryPath = readConfig().repositoryPath;
      return typeof repositoryPath === "string" && repositoryPath ? repositoryPath : null;
    },
    saveRepositoryPath(repositoryPath, repositoryKey) {
      writeConfig(addRecentRepository(readConfig(), repositoryPath, repositoryKey));
    },
    clearRepositoryPath() {
      const config = readConfig();
      delete config.repositoryPath;
      writeConfig(config);
    },
    readRecentRepositories() {
      return sanitizeRecentRepositories(readConfig().recentRepositories);
    },
    removeRecentRepository(repositoryPath, repositoryKey) {
      const nextConfig = removeRecentRepository(readConfig(), repositoryPath, repositoryKey);
      writeConfig(nextConfig);
      return sanitizeRecentRepositories(nextConfig.recentRepositories);
    },
    readPreferences() {
      return sanitizePreferences(readConfig().preferences);
    },
    savePreferences(preferences) {
      writeConfig({ ...readConfig(), preferences: sanitizePreferences(preferences) });
    },
    readActiveWorkspaceOpenTarget() {
      return sanitizeActiveWorkspaceOpenTarget(readConfig().activeWorkspaceOpenTarget);
    },
    saveActiveWorkspaceOpenTarget(target) {
      const config = readConfig();
      const fallback = sanitizeActiveWorkspaceOpenTarget(config.activeWorkspaceOpenTarget);
      writeConfig({
        ...config,
        activeWorkspaceOpenTarget: sanitizeActiveWorkspaceOpenTarget(target, fallback),
      });
    },
    readExpandedWindowSize() {
      const size = readConfig().expandedWindowSize;
      if (!size || typeof size !== "object") return null;

      const width = Number(size.width);
      const height = Number(size.height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

      return {
        width: Math.round(width),
        height: Math.round(height),
      };
    },
    saveExpandedWindowSize(size) {
      writeConfig({
        ...readConfig(),
        expandedWindowSize: {
          width: Math.round(size.width),
          height: Math.round(size.height),
        },
      });
    },
  };
}

module.exports = { createConfigStore, defaultActiveWorkspaceOpenTarget, defaultPreferences, sanitizeActiveWorkspaceOpenTarget };
