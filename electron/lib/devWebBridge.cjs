const path = require("node:path");
const {
  checkout,
  cleanupWorktree,
  createBranch,
  fetchRemotes,
  initializeRepository,
  isNotGitRepositoryError,
  merge,
  normalizeView,
  openWorktree,
  pullCurrentBranch,
  pushCurrentBranch,
  readGitSnapshot,
} = require("./git.cjs");
const { getAvailableWorkspaceTargets, openWorkspace, openWorkspaceFile } = require("./workspace.cjs");

const bridgePrefix = "/__git_peek_dev_bridge";
const defaultActiveWorkspaceOpenTarget = "vscode";
const defaultPreferences = {
  themeMode: "dark",
  lightThemePreset: "paper",
  darkThemePreset: "graphite",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
  workspaceOpenTargets: ["vscode", "cursor", "codex", "antigravity", "antigravityApp", "finder", "terminal", "xcode"],
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

function jsonResponse(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function repositoryEntry(repositoryPath, repositoryKey = "") {
  return {
    path: repositoryPath,
    name: path.basename(repositoryPath) || repositoryPath,
    repositoryKey,
  };
}

function errorResponse(error, fallbackMessage) {
  return {
    ok: false,
    reason: isNotGitRepositoryError(error) ? "invalid_repository" : "read_failed",
    error: error?.stderr || error?.message || fallbackMessage,
  };
}

function createDevWebBridgeMiddleware(projectRoot) {
  let repositoryPath = path.resolve(projectRoot);
  let recentRepositories = [repositoryEntry(repositoryPath)];
  let activeWorkspaceTarget = defaultActiveWorkspaceOpenTarget;
  let preferences = { ...defaultPreferences };

  async function snapshotResponse(view) {
    try {
      const snapshot = await readGitSnapshot(repositoryPath, normalizeView(view));
      repositoryPath = snapshot.repoPath;
      const snapshotRepository = repositoryEntry(snapshot.repoPath, snapshot.repositoryKey);
      recentRepositories = [snapshotRepository, ...recentRepositories].filter(
        (repository, index, repositories) =>
          repositories.findIndex(
            (entry) => (entry.repositoryKey || entry.path) === (repository.repositoryKey || repository.path),
          ) === index,
      );
      return { ok: true, snapshot };
    } catch (error) {
      return errorResponse(error, "Unable to read the dev working folder.");
    }
  }

  async function actionWithSnapshot(action, view, successMessage, failureMessage) {
    try {
      const snapshot = await action(repositoryPath, normalizeView(view));
      repositoryPath = snapshot.repoPath;
      return { ok: true, message: successMessage, snapshot };
    } catch (error) {
      const response = errorResponse(error, failureMessage);
      return { ...response, reason: "action_failed" };
    }
  }

  const routes = {
    "/health": async () => ({ ok: true, repositoryPath }),
    "/getSnapshot": async (payload) => snapshotResponse(payload.view),
    "/refresh": async (payload) => snapshotResponse(payload.view),
    "/openRepository": async (payload) => snapshotResponse(payload.view),
    "/switchRepository": async (payload) => {
      if (typeof payload.repositoryPath === "string" && payload.repositoryPath.trim()) {
        repositoryPath = path.resolve(payload.repositoryPath);
      }
      return snapshotResponse(payload.view);
    },
    "/getRecentRepositories": async () => recentRepositories,
    "/removeRecentRepository": async (payload) => {
      const repository = payload.repository ?? {};
      recentRepositories = recentRepositories.filter(
        (entry) => entry.path !== repository.path && (entry.repositoryKey || entry.path) !== (repository.repositoryKey || repository.path),
      );
      return recentRepositories;
    },
    "/getAvailableWorkspaceTargets": async () => getAvailableWorkspaceTargets(),
    "/getActiveWorkspaceTarget": async () => activeWorkspaceTarget,
    "/setActiveWorkspaceTarget": async (payload) => {
      if (typeof payload.target === "string" && payload.target.trim()) activeWorkspaceTarget = payload.target;
      return activeWorkspaceTarget;
    },
    "/openWorkspace": async (payload) => openWorkspace(repositoryPath, payload.target),
    "/openWorkspaceFile": async (payload) => openWorkspaceFile(repositoryPath, payload.target, payload.filePath),
    "/checkForUpdates": async () => ({ ok: true }),
    "/getPreferences": async () => preferences,
    "/savePreferences": async (payload) => {
      preferences = { ...defaultPreferences, ...(payload.preferences ?? {}) };
      return { ok: true };
    },
    "/getSystemTheme": async () => "dark",
    "/clearRepository": async () => {
      repositoryPath = path.resolve(projectRoot);
      return snapshotResponse({ mode: "all" });
    },
    "/initializeRepository": async (payload) =>
      actionWithSnapshot(
        async () => (await initializeRepository(payload.repositoryPath || repositoryPath, payload.view)).snapshot,
        payload.view,
        "Initialized Git repository.",
        "Unable to initialize Git repository.",
      ),
    "/createBranch": async (payload) =>
      actionWithSnapshot(
        (root, view) => createBranch(root, payload.branchName, payload.startPoint, view),
        payload.view,
        `Created branch ${payload.branchName}.`,
        "Unable to create branch.",
      ),
    "/merge": async (payload) =>
      actionWithSnapshot(
        (root, view) => merge(root, payload.ref, payload.targetBranch, view, payload.options),
        payload.view,
        `Merged into ${payload.targetBranch}.`,
        "Unable to merge ref.",
      ),
    "/checkout": async (payload) =>
      actionWithSnapshot(
        (root, view) => checkout(root, payload.ref, view),
        payload.view,
        `Checked out ${payload.ref}.`,
        "Unable to checkout ref.",
      ),
    "/pushCurrentBranch": async (payload) =>
      actionWithSnapshot(
        (root, view) => pushCurrentBranch(root, view),
        payload.view,
        "Pushed current branch.",
        "Unable to push current branch.",
      ),
    "/pullCurrentBranch": async (payload) =>
      actionWithSnapshot(
        (root, view) => pullCurrentBranch(root, view),
        payload.view,
        "Pulled current branch.",
        "Unable to pull current branch.",
      ),
    "/fetchRemotes": async (payload) =>
      actionWithSnapshot(
        (root, view) => fetchRemotes(root, view),
        payload.view,
        "Fetched remotes.",
        "Unable to fetch remotes.",
      ),
    "/openWorktree": async (payload) =>
      actionWithSnapshot(
        (root, view) => openWorktree(root, payload.worktreePath, view),
        payload.view,
        "Opened worktree.",
        "Unable to open worktree.",
      ),
    "/cleanupWorktree": async (payload) =>
      actionWithSnapshot(
        (root, view) => cleanupWorktree(root, payload.worktreePath, view),
        payload.view,
        "Cleaned up worktree.",
        "Unable to clean up worktree.",
      ),
  };

  return async (request, response, next) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (!requestUrl.pathname.startsWith(bridgePrefix)) {
      next();
      return;
    }

    const route = requestUrl.pathname.slice(bridgePrefix.length) || "/health";
    const handler = routes[route];
    if (!handler) {
      jsonResponse(response, 404, { ok: false, error: "Unknown dev bridge route." });
      return;
    }

    try {
      const payload = request.method === "POST" ? await readJsonBody(request) : {};
      jsonResponse(response, 200, await handler(payload));
    } catch (error) {
      jsonResponse(response, 500, { ok: false, error: error?.message || "Dev bridge request failed." });
    }
  };
}

function createDevWebBridgePlugin(projectRoot) {
  return {
    name: "gocus-dev-web-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(createDevWebBridgeMiddleware(projectRoot));
    },
  };
}

module.exports = { bridgePrefix, createDevWebBridgeMiddleware, createDevWebBridgePlugin };
