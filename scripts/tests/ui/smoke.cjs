#!/usr/bin/env node

const assert = require("node:assert/strict");

const screenshotPath = process.env.GIT_PEEK_SMOKE_SCREENSHOT;
const graphAnchorScreenshotPath = process.env.GIT_PEEK_GRAPH_ANCHOR_SCREENSHOT;
const compactViewport = { width: 390, height: 720 };
const desktopViewport = { width: 960, height: 720 };
const temporaryInfoViewport = { width: 280, height: 252 };
const footerCommitFullHash = "d4e5f6a000000000000000000000000000000000";

function expectedCreateBranchAction(name) {
  return {
    type: "createBranch",
    name,
    base: footerCommitFullHash,
    view: { mode: "all" },
  };
}

function expectedCheckoutAction() {
  return {
    type: "checkout",
    ref: footerCommitFullHash,
    view: { mode: "current" },
  };
}

function expectedSwitchBranchAction(branchName = "feature/footer-toggle") {
  return {
    type: "checkout",
    ref: branchName,
    view: { mode: "current" },
  };
}

function expectedMergeAction(targetBranch = "main", createMergeCommit = true) {
  return {
    type: "merge",
    ref: footerCommitFullHash,
    targetBranch,
    view: { mode: "current" },
    options: { createMergeCommit },
  };
}

function expectedInitializeRepositoryAction() {
  return {
    type: "initializeRepository",
    repositoryPath: "/Users/junrong/codespace/plain-folder",
    view: { mode: "all" },
  };
}

function expectedOpenWorktreeAction(view = { mode: "all" }) {
  return {
    type: "openWorktree",
    worktreePath: "/Users/junrong/codespace/git-tree-vis-linked",
    view,
  };
}

function graph(overrides = {}) {
  const currentColor = overrides.currentColor ?? "#2f80ed";
  const currentVariant = overrides.currentVariant ?? "solid";

  return {
    column: 0,
    laneCount: 1,
    currentColor,
    currentVariant,
    incomingColor: overrides.incomingColor ?? currentColor,
    incomingVariant: overrides.incomingVariant ?? currentVariant,
    currentContinues: true,
    passThrough: [],
    parentStems: [],
    bridges: [],
    isMerge: false,
    isCurrentHead: false,
    ...overrides,
  };
}

function commit(overrides) {
  return {
    id: overrides.hash,
    fullHash: `${overrides.hash}000000000000000000000000000000000`,
    hash: overrides.hash,
    title: overrides.title,
    message: overrides.message ?? overrides.title,
    author: "Codex",
    relativeTime: overrides.relativeTime ?? "2 minutes ago",
    authoredAt: overrides.authoredAt ?? "2026-06-10T02:26:00+08:00",
    additions: overrides.additions ?? 8,
    deletions: overrides.deletions ?? 1,
    filesChanged: overrides.filesChanged ?? 2,
    parents: overrides.parents ?? ["0000000"],
    refs: overrides.refs ?? [],
    containedBranches: overrides.containedBranches ?? [],
    lane: overrides.lane ?? "main",
    branchColor: overrides.branchColor ?? "#2f80ed",
    refColors: overrides.refColors ?? [overrides.branchColor ?? "#2f80ed"],
    graph: graph(overrides.graph),
    checkedOutWorktrees: overrides.checkedOutWorktrees ?? [],
  };
}

function changedFile(path, overrides = {}) {
  return {
    path,
    status: "M",
    indexStatus: " ",
    workingTreeStatus: "M",
    statusLabel: "Modified",
    additions: 12,
    deletions: 2,
    ...overrides,
  };
}

const mockCommits = [
  commit({
    hash: "a1b2c3d",
    title: "Add commit search polish",
    message: "Add commit search polish and keyboard selection",
    refs: ["main"],
    containedBranches: ["main"],
  }),
  commit({
    hash: "d4e5f6a",
    title: "Fix footer changed now toggle",
    message: "Fix footer changed now toggle state",
    relativeTime: "1 hour ago",
    refs: ["feature/footer-toggle"],
    lane: "feature",
    branchColor: "#8b5cf6",
    refColors: ["#8b5cf6"],
  }),
];

function numberedCommits(count) {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return commit({
      hash: (index + 1).toString(16).padStart(7, "0"),
      title: `Virtualized commit ${number}`,
      message: `Virtualized commit ${number} keeps the list bounded`,
      refs: index === 0 ? ["main"] : [],
      relativeTime: `${index + 1} minutes ago`,
    });
  });
}

const externalWorktreeCommits = [
  commit({
    hash: "e7f8a9b",
    title: "External worktree head",
    message: "Commit currently checked out in another worktree",
    refs: ["feature/external-worktree"],
    lane: "feature",
    branchColor: "#8b5cf6",
    refColors: ["#8b5cf6"],
    graph: { currentVariant: "dashed" },
    checkedOutWorktrees: [
      {
        path: "/Users/junrong/codespace/git-tree-vis-external",
        branch: "feature/external-worktree",
        head: "e7f8a9b000000000000000000000000000000000",
        headShortHash: "e7f8a9b",
        headTitle: "External worktree head",
        headRelativeTime: "5 minutes ago",
        detached: false,
        bare: false,
        current: false,
        counts: { modified: 0, staged: 0, untracked: 0 },
      },
    ],
  }),
];

function snapshotForCommits(commits, overrides = {}) {
  return {
    repoPath: overrides.repoPath ?? "/Users/junrong/codespace/git-tree-vis",
    repoName: overrides.repoName ?? "git-tree-vis",
    repositoryKey: overrides.repositoryKey ?? "mock-git-tree-vis",
    branch: overrides.branch ?? { name: "main", upstream: "origin/main", ahead: 1, behind: 0, detached: false },
    branches: overrides.branches ?? [],
    worktrees: overrides.worktrees ?? [],
    view: overrides.view ?? { mode: "all" },
    counts: overrides.counts ?? { modified: 1, staged: 0, untracked: 1 },
    commits,
    changedFiles: overrides.changedFiles ?? [
      changedFile("src/components/RecentCommits.tsx"),
      changedFile("src/styles.css", { additions: 6, deletions: 0 }),
    ],
    repositoryState: overrides.repositoryState ?? {
      operation: "none",
      operationLabel: "Ready",
      hasConflicts: false,
      conflictedFiles: [],
    },
    lastFetchedAt: new Date().toISOString(),
    isSample: false,
  };
}

function installGitPeekMock(config) {
  const initialResponse = config.initialResponse;
  const initializedResponse = config.initializedResponse ?? initialResponse;
  const actionSnapshot = initialResponse.ok ? initialResponse.snapshot : initializedResponse?.snapshot;

  window.__gitPeekActions = [];
  window.__gitPeekCopiedText = "";
  window.__gitPeekClipboardText = "";
  window.__gitPeekTemporaryInfoPayload = config.temporaryInfoPayload ?? null;
  window.__gitPeekCommitInfoPayload = config.commitInfoPayload ?? null;
  window.__gitPeekTemporaryInfoListeners = [];
  window.__gitPeekCommitInfoListeners = [];
  window.__gitPeekPreferencesListeners = [];
  window.__gitPeekPinnedListeners = [];
  window.__gitPeekPinnedState = Boolean(config.pinned);
  window.__gitPeekSavedPreferences = [];
  window.__gitPeekSnapshotRequests = [];
  window.__gitPeekOpenedWorkspaces = [];
  window.__gitPeekOpenedWorkspaceFiles = [];
  window.__gitPeekRefreshCount = 0;
  if (config.clipboardAvailable) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (config.clipboardWriteTextError) throw new Error(config.clipboardWriteTextError);
          window.__gitPeekClipboardText = text;
        },
      },
    });
  }
  window.gitPeek = {
    getSystemTheme: async () => {
      if (config.systemThemeError) throw new Error(config.systemThemeError);
      return "light";
    },
    getPreferences: async () => {
      if (config.preferencesError) throw new Error(config.preferencesError);
      return config.preferences ?? null;
    },
    getPinned: async () => window.__gitPeekPinnedState,
    getAvailableWorkspaceTargets: async () => {
      if (config.availableWorkspaceTargetsError) throw new Error(config.availableWorkspaceTargetsError);
      return config.availableWorkspaceTargets ?? ["cursor", "finder", "terminal"];
    },
    getSnapshot: async (view) => {
      if (view) window.__gitPeekSnapshotRequests.push(view);
      if (!initialResponse.ok) return initialResponse;
      return { ok: true, snapshot: { ...initialResponse.snapshot, view: view ?? initialResponse.snapshot.view } };
    },
    getRecentRepositories: async () => {
      if (config.recentRepositoriesError) throw new Error(config.recentRepositoriesError);
      return config.recentRepositories ?? [];
    },
    onSnapshotUpdated: () => () => {},
    onCollapsedChanged: () => () => {},
    onPinnedChanged: (callback) => {
      window.__gitPeekPinnedListeners.push(callback);
      return () => {
        window.__gitPeekPinnedListeners = window.__gitPeekPinnedListeners.filter((listener) => listener !== callback);
      };
    },
    onRepositoryDialogOpenChanged: () => () => {},
    onThemeChanged: () => () => {},
    onPreferencesChanged: (callback) => {
      window.__gitPeekPreferencesListeners.push(callback);
      return () => {
        window.__gitPeekPreferencesListeners = window.__gitPeekPreferencesListeners.filter((listener) => listener !== callback);
      };
    },
    getTemporaryInfoPayload: async () => {
      if (config.temporaryInfoPayloadError) throw new Error(config.temporaryInfoPayloadError);
      return window.__gitPeekTemporaryInfoPayload;
    },
    getCommitInfoPayload: async () => {
      if (config.commitInfoPayloadError) throw new Error(config.commitInfoPayloadError);
      return window.__gitPeekCommitInfoPayload;
    },
    onTemporaryInfoPayloadUpdated: (callback) => {
      window.__gitPeekTemporaryInfoListeners.push(callback);
      return () => {
        window.__gitPeekTemporaryInfoListeners = window.__gitPeekTemporaryInfoListeners.filter((listener) => listener !== callback);
      };
    },
    onCommitInfoPayloadUpdated: (callback) => {
      window.__gitPeekCommitInfoListeners.push(callback);
      return () => {
        window.__gitPeekCommitInfoListeners = window.__gitPeekCommitInfoListeners.filter((listener) => listener !== callback);
      };
    },
    onTemporaryInfoPanelClosed: () => () => {},
    onCommitInfoPanelClosed: () => () => {},
    setTemporaryInfoPanel: async (payload) => {
      if (config.setTemporaryInfoPanelError) throw new Error(config.setTemporaryInfoPanelError);
      window.__gitPeekTemporaryInfoPayload = payload;
      window.__gitPeekTemporaryInfoListeners.forEach((callback) => callback(payload));
    },
    setCommitInfoPanel: async (payload) => {
      if (config.setCommitInfoPanelError) throw new Error(config.setCommitInfoPanelError);
      window.__gitPeekCommitInfoPayload = payload;
      window.__gitPeekCommitInfoListeners.forEach((callback) => callback(payload));
    },
    savePreferences: async (preferences) => {
      window.__gitPeekSavedPreferences.push(preferences);
    },
    setPinned: async (pinned) => {
      window.__gitPeekPinnedState = Boolean(pinned);
      window.__gitPeekPinnedListeners.forEach((callback) => callback(window.__gitPeekPinnedState));
    },
    setCollapsed: async () => {},
    dockToEdge: async () => {},
    copyText: async (text) => {
      if (config.copyTextError) throw new Error(config.copyTextError);
      window.__gitPeekCopiedText = text;
    },
    openWorkspace: async (target) => {
      window.__gitPeekOpenedWorkspaces.push(target);
      return { ok: true, message: "Workspace opened." };
    },
    openWorkspaceFile: async (target, filePath) => {
      window.__gitPeekOpenedWorkspaceFiles.push({ target, filePath });
      return { ok: true, message: "File opened." };
    },
    refresh: async () => {
      window.__gitPeekRefreshCount += 1;
      if (config.refreshError) throw new Error(config.refreshError);
      return actionSnapshot ? { ok: true, snapshot: actionSnapshot } : initialResponse;
    },
    checkout: async (ref, view) => {
      window.__gitPeekActions.push({ type: "checkout", ref, view });
      return { ok: true, snapshot: actionSnapshot };
    },
    createBranch: async (name, base, view) => {
      window.__gitPeekActions.push({ type: "createBranch", name, base, view });
      return { ok: true, snapshot: actionSnapshot };
    },
    merge: async (ref, targetBranch, view, options) => {
      window.__gitPeekActions.push({ type: "merge", ref, targetBranch, view, options });
      if (config.mergeError) return { ok: false, error: config.mergeError, snapshot: actionSnapshot };
      return { ok: true, snapshot: { ...actionSnapshot, branch: { ...actionSnapshot.branch, name: targetBranch }, view } };
    },
    openWorktree: async (worktreePath, view) => {
      window.__gitPeekActions.push({ type: "openWorktree", worktreePath, view });
      return { ok: true, snapshot: { ...actionSnapshot, repoPath: worktreePath, view } };
    },
    initializeRepository: async (repositoryPath, view) => {
      window.__gitPeekActions.push({ type: "initializeRepository", repositoryPath, view });
      return initializedResponse;
    },
    openRepository: async () => initializedResponse,
    switchRepository: async () => initializedResponse,
  };
}

function mockedSnapshotScenario(commits, overrides = {}) {
  return {
    initialResponse: { ok: true, snapshot: snapshotForCommits(commits, overrides) },
  };
}

function folderWithoutGitScenario() {
  const folder = {
    path: "/Users/junrong/codespace/plain-folder",
    name: "plain-folder",
    hasGitIgnore: false,
  };

  return {
    initialResponse: {
      ok: false,
      reason: "not_git_repository",
      error: `${folder.name} does not have Git initialized yet.`,
      folder,
    },
    initializedResponse: {
      ok: true,
      message: "Initialized Git and added a starter .gitignore.",
      snapshot: snapshotForCommits(mockCommits, {
        repoPath: folder.path,
        repoName: folder.name,
        repositoryKey: "mock-plain-folder",
      }),
    },
  };
}

function noRepositoryScenario() {
  return {
    initialResponse: {
      ok: false,
      reason: "not_configured",
      error: "No working folder selected.",
    },
    recentRepositories: Array.from({ length: 5 }, (_, index) => ({
      path: `/Users/junrong/codespace/recent-${index}`,
      name: `recent-${index}`,
      repositoryKey: `mock-recent-${index}`,
    })),
  };
}

function branchViewScenario() {
  return mockedSnapshotScenario(mockCommits, {
    branches: [
      {
        name: "main",
        fullName: "refs/heads/main",
        type: "local",
        current: true,
        upstream: "origin/main",
      },
      {
        name: "feature/footer-toggle",
        fullName: "refs/heads/feature/footer-toggle",
        type: "local",
        current: false,
        upstream: "",
      },
    ],
  });
}

function crowdedMergeTargetScenario() {
  const overflowBranches = Array.from({ length: 18 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const name = `topic/menu-overflow-${number}`;

    return {
      name,
      fullName: `refs/heads/${name}`,
      type: "local",
      current: false,
      upstream: "",
    };
  });

  return mockedSnapshotScenario(mockCommits, {
    branch: { name: "feat/branch-swift", upstream: "", ahead: 0, behind: 0, detached: false },
    branches: [
      { name: "feat/branch-swift", fullName: "refs/heads/feat/branch-swift", type: "local", current: true, upstream: "" },
      { name: "codex/worktree-graph-mode", fullName: "refs/heads/codex/worktree-graph-mode", type: "local", current: false, upstream: "" },
      {
        name: "feat/beautify-commit-card-layout",
        fullName: "refs/heads/feat/beautify-commit-card-layout",
        type: "local",
        current: false,
        upstream: "",
      },
      { name: "feat/commit-blocking-flow", fullName: "refs/heads/feat/commit-blocking-flow", type: "local", current: false, upstream: "" },
      { name: "feat/worktree-graph-mode", fullName: "refs/heads/feat/worktree-graph-mode", type: "local", current: false, upstream: "" },
      {
        name: "fiery-comet-driven-cleanup",
        fullName: "refs/heads/fiery-comet-driven-cleanup",
        type: "local",
        current: false,
        upstream: "",
      },
      {
        name: "feat/super-long-branch-name-that-should-wrap-and-still-be-readable-in-the-target-menu",
        fullName: "refs/heads/feat/super-long-branch-name-that-should-wrap-and-still-be-readable-in-the-target-menu",
        type: "local",
        current: false,
        upstream: "",
      },
      { name: "main", fullName: "refs/heads/main", type: "local", current: false, upstream: "origin/main" },
      { name: "develop", fullName: "refs/heads/develop", type: "local", current: false, upstream: "" },
      { name: "master", fullName: "refs/heads/master", type: "local", current: false, upstream: "" },
      ...overflowBranches,
      { name: "origin/main", fullName: "refs/remotes/origin/main", type: "remote", current: false, upstream: "" },
    ],
  });
}

function mergeFailureScenario() {
  return {
    ...mockedSnapshotScenario(mockCommits, {
      branches: [
        {
          name: "main",
          fullName: "refs/heads/main",
          type: "local",
          current: true,
          upstream: "origin/main",
        },
        {
          name: "feature/footer-toggle",
          fullName: "refs/heads/feature/footer-toggle",
          type: "local",
          current: false,
          upstream: "",
        },
      ],
    }),
    mergeError: [
      "Auto-merging src/App.tsx",
      "CONFLICT (content): Merge conflict in src/App.tsx",
      "Automatic merge failed; fix conflicts and then commit the result.",
    ].join("\n"),
  };
}

function mergeInProgressScenario() {
  return mockedSnapshotScenario(mockCommits, {
    counts: { modified: 2, staged: 2, untracked: 0 },
    changedFiles: [
      changedFile("src/App.tsx", {
        status: "UU",
        indexStatus: "U",
        workingTreeStatus: "U",
        statusLabel: "Conflicted",
        additions: 0,
        deletions: 0,
      }),
      changedFile("src/styles.css", {
        status: "AA",
        indexStatus: "A",
        workingTreeStatus: "A",
        statusLabel: "Conflicted",
        additions: 0,
        deletions: 0,
      }),
    ],
    repositoryState: {
      operation: "merge",
      operationLabel: "Merge",
      hasConflicts: true,
      conflictedFiles: ["src/App.tsx", "src/styles.css"],
    },
  });
}

function refreshFailureScenario() {
  return {
    ...mockedSnapshotScenario(mockCommits),
    refreshError: "Native refresh failed.",
  };
}

function dismissableMenuScenario() {
  return {
    ...branchViewScenario(),
    availableWorkspaceTargets: ["finder", "terminal"],
    recentRepositories: [
      {
        path: "/Users/junrong/codespace/another-repo",
        name: "another-repo",
        repositoryKey: "mock-another-repo",
      },
    ],
    initialResponse: {
      ok: true,
      snapshot: snapshotForCommits(mockCommits, {
        branches: [
          {
            name: "main",
            fullName: "refs/heads/main",
            type: "local",
            current: true,
            upstream: "origin/main",
          },
          {
            name: "feature/footer-toggle",
            fullName: "refs/heads/feature/footer-toggle",
            type: "local",
            current: false,
            upstream: "",
          },
        ],
        worktrees: [
          {
            path: "/Users/junrong/codespace/git-tree-vis",
            branch: "main",
            head: "a1b2c3d000000000000000000000000000000000",
            headShortHash: "a1b2c3d",
            headTitle: "Add commit search polish",
            headRelativeTime: "2 minutes ago",
            detached: false,
            bare: false,
            current: true,
            counts: { modified: 1, staged: 0, untracked: 1 },
          },
          {
            path: "/Users/junrong/codespace/git-tree-vis-linked",
            branch: "feature/footer-toggle",
            head: footerCommitFullHash,
            headShortHash: "d4e5f6a",
            headTitle: "Fix footer changed now toggle",
            headRelativeTime: "1 hour ago",
            detached: false,
            bare: false,
            current: false,
            counts: { modified: 0, staged: 0, untracked: 0 },
          },
        ],
      }),
    },
  };
}

async function openMockedPage(browser, baseUrl, scenario, options = {}) {
  const page = await browser.newPage({ viewport: options.viewport ?? compactViewport });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));

  await page.addInitScript(installGitPeekMock, scenario);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  return { page, errors };
}

async function assertHealthyPage(page, errors) {
  assert.match(await page.title(), /Git Peek/);
  await page.getByRole("heading", { name: "Commits" }).waitFor();
  assert.equal(await page.locator(".commits-section").getAttribute("aria-labelledby"), "recent-commits-title");
  assert.equal(await page.locator("#recent-commits-title").innerText(), "Commits");
  assert.equal(await page.locator(".vite-error-overlay").count(), 0, "Vite error overlay should not render");
  assert.deepEqual(errors, []);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth ?? 0,
  }));

  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1 && dimensions.bodyScrollWidth <= dimensions.clientWidth + 1,
    `${label} should not create horizontal overflow: ${JSON.stringify(dimensions)}`,
  );
}

async function assertVisibleWithinViewport(page, locator, label) {
  await locator.waitFor();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  assert.ok(box, `${label} should be visible`);
  assert.ok(viewport, `${label} needs a viewport`);
  assert.ok(box.x >= -1, `${label} should not start before the viewport: ${JSON.stringify(box)}`);
  assert.ok(box.x + box.width <= viewport.width + 1, `${label} should fit in the viewport: ${JSON.stringify({ box, viewport })}`);
}

async function assertSelectedCommitGraphAnchors(page) {
  const metrics = await page.locator(".commit-row.is-selected").evaluate((row) => {
    const node = row.querySelector(".graph-node");
    const topSvg = row.querySelector(".graph-svg-top");
    const bridgeSvg = row.querySelector(".graph-svg-bridge");
    const bridgeRunSvg = row.querySelector(".graph-svg-bridge-run");
    const tailSvg = row.querySelector(".graph-svg-tail");
    const timeline = row.querySelector(".timeline-cell");
    const bridgePath = row.querySelector(".graph-svg-bridge-run .graph-bridge");

    if (!node || !topSvg || !bridgeSvg || !bridgeRunSvg || !tailSvg || !timeline || !bridgePath) return null;

    const nodeRect = node.getBoundingClientRect();
    const topSvgRect = topSvg.getBoundingClientRect();
    const bridgeSvgRect = bridgeSvg.getBoundingClientRect();
    const bridgeRunSvgRect = bridgeRunSvg.getBoundingClientRect();
    const tailSvgRect = tailSvg.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();

    return {
      nodeCenterY: nodeRect.top + nodeRect.height / 2,
      topSvgBottomY: topSvgRect.bottom,
      bridgeSvgTopY: bridgeSvgRect.top,
      bridgeSvgBottomY: bridgeSvgRect.bottom,
      bridgeSvgHeight: bridgeSvgRect.height,
      bridgeRunSvgTopY: bridgeRunSvgRect.top,
      bridgeRunSvgBottomY: bridgeRunSvgRect.bottom,
      bridgeRunSvgHeight: bridgeRunSvgRect.height,
      tailSvgTopY: tailSvgRect.top,
      tailSvgHeight: tailSvgRect.height,
      rowHeight: rowRect.height,
      timelineHeight: timelineRect.height,
      timelineBottomY: timelineRect.bottom,
      topViewBox: topSvg.getAttribute("viewBox"),
      bridgeViewBox: bridgeSvg.getAttribute("viewBox"),
      bridgeRunViewBox: bridgeRunSvg.getAttribute("viewBox"),
      tailViewBox: tailSvg.getAttribute("viewBox"),
      bridgePathD: bridgePath.getAttribute("d"),
    };
  });

  assert.ok(metrics, "selected commit should render graph segments, a bridge, and a node");
  assert.equal(metrics.topViewBox, "0 0 42 1");
  assert.equal(metrics.bridgeViewBox, "0 0 42 38");
  assert.equal(metrics.bridgeRunViewBox, "0 0 42 38");
  assert.equal(metrics.tailViewBox, "0 0 42 1");
  assert.match(metrics.bridgePathD, /^M \d+ 0 C /);
  assert.ok(metrics.rowHeight > 90, `selected row should be expanded: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.timelineHeight >= metrics.rowHeight - 1, `timeline should span selected row: ${JSON.stringify(metrics)}`);
  assert.ok(
    Math.abs(metrics.nodeCenterY - metrics.topSvgBottomY) <= 0.75,
    `top graph segment should end at node: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.nodeCenterY - metrics.bridgeSvgTopY) <= 0.75,
    `fixed bridge graph segment should start at node: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.bridgeSvgHeight - 38) <= 0.75,
    `fixed bridge graph segment should stay fixed when the row expands: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.nodeCenterY - metrics.bridgeRunSvgTopY) <= 0.75,
    `bridge-run graph segment should start at node: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.bridgeRunSvgBottomY - metrics.timelineBottomY) <= 0.75,
    `bridge-run graph segment should reach the row bottom: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    metrics.bridgeRunSvgHeight > metrics.bridgeSvgHeight,
    `bridge-run graph segment should absorb expanded row height: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.bridgeSvgBottomY - metrics.tailSvgTopY) <= 0.75,
    `vertical tail graph segment should start after the fixed bridge: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    metrics.tailSvgHeight > 0,
    `vertical tail graph segment should absorb expanded row height: ${JSON.stringify(metrics)}`,
  );
}

async function assertGitActions(page, expectedActions) {
  assert.deepEqual(await page.evaluate(() => window.__gitPeekActions), expectedActions);
}

async function clickActionDialogBackdrop(page) {
  const point = await page.locator(".action-dialog-backdrop").evaluate((backdrop) => {
    const dialog = backdrop.querySelector(".action-dialog");
    const backdropRect = backdrop.getBoundingClientRect();
    const dialogRect = dialog?.getBoundingClientRect();
    const candidates = [
      { x: backdropRect.left + 16, y: backdropRect.top + 16 },
      { x: backdropRect.right - 16, y: backdropRect.top + 16 },
      { x: backdropRect.left + 16, y: backdropRect.bottom - 16 },
      { x: backdropRect.right - 16, y: backdropRect.bottom - 16 },
    ];

    const outsideDialog = candidates.find((candidate) => {
      if (!dialogRect) return true;
      return (
        candidate.x < dialogRect.left ||
        candidate.x > dialogRect.right ||
        candidate.y < dialogRect.top ||
        candidate.y > dialogRect.bottom
      );
    });

    if (!outsideDialog) throw new Error("No backdrop-only point available.");
    return outsideDialog;
  });

  await page.mouse.click(point.x, point.y);
}

async function testSelectedCommitGraphAnchor(browser, baseUrl) {
  const graphAnchorCommits = [
    commit({
      hash: "a1b2c3d",
      title: "Add commit search polish",
      message: "Add commit search polish and keyboard selection",
      refs: ["main"],
      graph: {
        laneCount: 2,
        currentColor: "#f2b705",
        parentStems: [{ column: 0, color: "#f2b705", variant: "solid" }],
        bridges: [{ fromColumn: 0, toColumn: 1, color: "#2f80ed", variant: "solid" }],
      },
    }),
    mockCommits[1],
  ];
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(graphAnchorCommits));
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /Add commit search polish/ }).click();
    assert.equal(await page.locator(".commit-row.is-selected .commit-title-text").innerText(), "Add commit search polish");
    await assertSelectedCommitGraphAnchors(page);
    if (graphAnchorScreenshotPath) await page.screenshot({ path: graphAnchorScreenshotPath, fullPage: false });
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testCommitHoverPanel(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
  try {
    await assertHealthyPage(page, errors);

    const firstCommitButton = page.getByRole("button", { name: /Add commit search polish/ });
    const secondCommitButton = page.getByRole("button", { name: /Fix footer changed now toggle/ });

    await firstCommitButton.hover();
    await page.waitForFunction(() => window.__gitPeekCommitInfoPayload === null);
    assert.equal(await page.locator(".commit-row.is-selected").count(), 0);

    await firstCommitButton.click();
    await page.waitForFunction(() => window.__gitPeekCommitInfoPayload?.kind === "commit");
    assert.equal(await page.locator(".commit-hover-panel").count(), 0);
    assert.equal(await page.evaluate(() => window.__gitPeekCommitInfoPayload?.commit?.hash), "a1b2c3d");
    assert.deepEqual(
      await page.evaluate(() => {
        const anchor = window.__gitPeekCommitInfoPayload?.anchorBounds;
        return {
          topIsNumber: Number.isFinite(anchor?.top),
          heightIsPositive: Number.isFinite(anchor?.height) && anchor.height > 0,
        };
      }),
      { topIsNumber: true, heightIsPositive: true },
    );
    assert.equal(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload), null);

    await secondCommitButton.hover();
    await page.waitForFunction(() => window.__gitPeekCommitInfoPayload === null);

    await secondCommitButton.click();
    await page.waitForFunction(() => window.__gitPeekCommitInfoPayload?.commit?.hash === "d4e5f6a");
    const secondAnchorTop = await page.evaluate(() => window.__gitPeekCommitInfoPayload?.anchorBounds?.top);
    const secondSelectedTop = await page.locator(".commit-row.is-selected").evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(
      Math.abs(secondAnchorTop - secondSelectedTop) < 1,
      `commit info anchor should use the post-selection row top: ${JSON.stringify({ secondAnchorTop, secondSelectedTop })}`,
    );

    await page.mouse.move(1, 1);
    await page.waitForFunction(() => window.__gitPeekCommitInfoPayload === null);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testCommitInfoPanel(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=commit-info`, {
    ...mockedSnapshotScenario(mockCommits),
    commitInfoPayload: {
      kind: "commit",
      commit: mockCommits[0],
    },
  });
  try {
    assert.match(await page.title(), /Git Peek/);
    const hoverPanel = page.locator(".commit-hover-panel");
    await hoverPanel.waitFor();
    assert.equal(await page.locator(".temporary-info-panel").evaluate((node) => node.classList.contains("is-commit")), true);

    const panelText = await hoverPanel.innerText();
    assert.match(panelText, /Codex/);
    assert.match(panelText, /2 minutes ago/);
    assert.match(panelText, /June 10, 2026 at 2:26 AM/);
    assert.match(panelText, /Add commit search polish and keyboard selection/);
    assert.match(panelText, /2 files changed, 8 insertions\(\+\), 1 deletion\(-\)/);
    assert.match(panelText, /main/);
    assert.match(panelText, /Contained in/);
    assert.match(panelText, /a1b2c3d/);
    await assertVisibleWithinViewport(page, hoverPanel, "commit info panel");
    await assertNoHorizontalOverflow(page, "commit info panel");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testCommitSearch(browser, baseUrl) {
  const { page, errors } = await openMockedPage(
    browser,
    baseUrl,
    mockedSnapshotScenario(mockCommits, {
      branches: [
        {
          name: "main",
          fullName: "refs/heads/main",
          type: "local",
          current: true,
          upstream: "origin/main",
        },
        {
          name: "feature/footer-toggle",
          fullName: "refs/heads/feature/footer-toggle",
          type: "local",
          current: false,
          upstream: "",
        },
      ],
    }),
  );
  try {
    const createdBranchAction = expectedCreateBranchAction("feat/d4e5f6a");
    const mergeAction = expectedMergeAction("feature/footer-toggle");
    const checkoutAction = expectedCheckoutAction();

    await assertHealthyPage(page, errors);
    assert.equal(await page.locator('[role="button"] button, button button').count(), 0);

    const searchToggle = page.getByRole("button", { name: "Search commits" });
    assert.equal(await searchToggle.getAttribute("aria-controls"), "commit-search-form");
    assert.equal(await searchToggle.getAttribute("aria-expanded"), "false");

    await searchToggle.click();
    const closeSearchToggle = page.getByRole("button", { name: "Close commit search" });
    await closeSearchToggle.waitFor();
    assert.equal(await closeSearchToggle.getAttribute("aria-controls"), "commit-search-form");
    assert.equal(await closeSearchToggle.getAttribute("aria-expanded"), "true");
    await page.locator("#commit-search-form").waitFor();
    await page.getByRole("searchbox", { name: "Search commits" }).fill("footer");
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 1/2");
    await page.getByRole("status").filter({ hasText: "Showing 1/2" }).waitFor();
    await page.getByRole("searchbox", { name: "Search commits" }).press("Enter");
    assert.equal(await page.locator(".commit-row.is-selected .commit-title-text").innerText(), "Fix footer changed now toggle");

    await page.getByRole("searchbox", { name: "Search commits" }).press("Escape");
    assert.equal(await page.getByRole("searchbox", { name: "Search commits" }).count(), 0);
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 2");
    await page.getByRole("status").filter({ hasText: "Showing 2" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Search commits");
    assert.equal(await searchToggle.getAttribute("aria-expanded"), "false");

    const firstCommit = page.getByRole("button", { name: /Add commit search polish/ });
    await firstCommit.focus();
    await firstCommit.press("Enter");
    assert.equal(await page.locator(".commit-row.is-selected .commit-title-text").innerText(), "Add commit search polish");

    const footerCommit = page.getByRole("button", { name: /Fix footer changed now toggle/ });
    await footerCommit.focus();
    await footerCommit.press("Enter");
    assert.equal(await page.locator(".commit-row.is-selected .commit-title-text").innerText(), "Fix footer changed now toggle");

    await page.getByRole("button", { name: "Search commits" }).click();
    await page.getByRole("searchbox", { name: "Search commits" }).fill("search");
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 1/2");
    assert.equal(await page.locator(".commit-row.is-selected").count(), 0);
    await page.getByRole("searchbox", { name: "Search commits" }).press("Escape");
    await footerCommit.focus();
    await footerCommit.press("Enter");
    assert.equal(await page.locator(".commit-row.is-selected .commit-title-text").innerText(), "Fix footer changed now toggle");

    await page.getByRole("button", { name: "Branch", exact: true }).click();
    const createBranchDialog = page.getByRole("dialog", { name: "Create branch" });
    await createBranchDialog.waitFor();
    assert.equal(await createBranchDialog.getAttribute("aria-labelledby"), "action-dialog-title");
    assert.equal(await createBranchDialog.getAttribute("aria-describedby"), "action-dialog-body");
    assert.equal(await page.locator("#action-dialog-title").innerText(), "Create branch");
    assert.equal(await page.locator("#action-dialog-body").innerText(), "Start a new branch from d4e5f6a.");
    assert.equal(await page.getByRole("textbox", { name: "Branch name" }).inputValue(), "d4e5f6a");
    const invalidBranchNameInput = page.getByRole("textbox", { name: "Branch name" });
    assert.equal(await page.locator(".action-branch-preview").getAttribute("id"), "action-branch-preview");
    assert.equal(await invalidBranchNameInput.getAttribute("aria-describedby"), "action-branch-preview");
    await invalidBranchNameInput.fill("/");
    assert.equal(await page.locator(".action-branch-error").innerText(), "Enter a branch name.");
    assert.equal(await page.locator(".action-branch-preview").count(), 0);
    assert.equal(await invalidBranchNameInput.getAttribute("aria-describedby"), "action-branch-error");
    await invalidBranchNameInput.fill("HEAD");
    assert.equal(await page.locator(".action-branch-error").innerText(), "Branch names cannot be HEAD.");
    await invalidBranchNameInput.fill("bad branch");
    assert.equal(await page.locator(".action-branch-error").innerText(), "Branch names cannot contain spaces or ~ ^ : ? * [ \\.");
    assert.equal(await invalidBranchNameInput.getAttribute("aria-describedby"), "action-branch-preview action-branch-error");
    assert.equal(await page.getByRole("button", { name: "Confirm" }).isDisabled(), true);
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    await invalidBranchNameInput.press("Enter");
    assert.equal(await page.getByRole("dialog", { name: "Create branch" }).count(), 1);
    await assertGitActions(page, []);
    await clickActionDialogBackdrop(page);
    assert.equal(await page.getByRole("dialog", { name: "Create branch" }).count(), 0);
    await assertGitActions(page, []);

    await page.getByRole("button", { name: "Branch", exact: true }).click();
    await page.getByRole("dialog", { name: "Create branch" }).waitFor();
    const branchNameInput = page.getByRole("textbox", { name: "Branch name" });
    assert.equal(await page.locator("select[aria-label='Branch prefix']").count(), 0);
    const branchPrefixButton = page.getByRole("button", { name: "Branch prefix" });
    await branchPrefixButton.click();
    assert.equal(await branchPrefixButton.getAttribute("aria-expanded"), "true");
    const prefixMenuPlacement = await page.locator("#action-branch-prefix-menu").evaluate((menu) => {
      const trigger = document.querySelector("#action-branch-prefix-trigger");
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger?.getBoundingClientRect();

      return {
        menuTop: menuRect.top,
        menuBottom: menuRect.bottom,
        triggerTop: triggerRect?.top ?? 0,
        viewportHeight: window.innerHeight,
      };
    });
    assert.ok(prefixMenuPlacement.menuTop >= 0, `branch prefix menu should stay within viewport: ${JSON.stringify(prefixMenuPlacement)}`);
    assert.ok(
      prefixMenuPlacement.menuBottom <= prefixMenuPlacement.triggerTop,
      `branch prefix menu should open above the trigger: ${JSON.stringify(prefixMenuPlacement)}`,
    );
    await page.locator("#action-branch-prefix-menu").getByRole("menuitem", { name: "feat" }).click();
    assert.equal(await branchPrefixButton.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/d4e5f6a");
    await branchNameInput.fill("feat/ready");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/ready");
    await branchNameInput.fill("d4e5f6a");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/d4e5f6a");
    await branchNameInput.press("Enter");
    await page.getByRole("dialog", { name: "Create branch" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction]);

    await page.getByRole("button", { name: "Merge", exact: true }).click();
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor();
    assert.equal(await page.locator("#action-dialog-title").innerText(), "Merge commit");
    assert.equal(
      await page.locator("#action-dialog-body").innerText(),
      "Merge d4e5f6a into the selected target branch. The working folder will end on that branch.",
    );
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await clickActionDialogBackdrop(page);
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction]);

    await page.getByRole("button", { name: "Merge", exact: true }).click();
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor();
    assert.equal(await page.locator("#action-dialog-title").innerText(), "Merge commit");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    const mergeTargetButton = page.getByRole("button", { name: "Merge target branch" });
    assert.equal(await mergeTargetButton.innerText(), "main");
    await mergeTargetButton.click();
    assert.equal(await mergeTargetButton.getAttribute("aria-expanded"), "true");
    const mergeMenuPlacement = await page.locator("#action-merge-target-menu").evaluate((menu) => {
      const trigger = document.querySelector("#action-merge-target-trigger");
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger?.getBoundingClientRect();

      return {
        menuTop: menuRect.top,
        menuBottom: menuRect.bottom,
        triggerTop: triggerRect?.top ?? 0,
        viewportHeight: window.innerHeight,
      };
    });
    assert.ok(mergeMenuPlacement.menuTop >= 0, `merge target menu should stay within viewport: ${JSON.stringify(mergeMenuPlacement)}`);
    assert.ok(
      mergeMenuPlacement.menuBottom <= mergeMenuPlacement.triggerTop,
      `merge target menu should open above the trigger: ${JSON.stringify(mergeMenuPlacement)}`,
    );
    await page.locator("#action-merge-target-menu").getByRole("menuitem", { name: "feature/footer-toggle" }).click();
    assert.equal(await mergeTargetButton.innerText(), "feature/footer-toggle");
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction, mergeAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await clickActionDialogBackdrop(page);
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction, mergeAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("dialog", { name: "Checkout commit" }).count(), 0);
    await assertGitActions(page, [createdBranchAction, mergeAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog", { name: "Checkout commit" }).count(), 0);
    await assertGitActions(page, [createdBranchAction, mergeAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction, mergeAction, checkoutAction]);

    await page.getByRole("button", { name: "Search commits" }).click();
    await page.getByRole("searchbox", { name: "Search commits" }).fill("nothing-here");
    assert.equal(await page.locator(".commit-empty-state").innerText(), 'No commits match "nothing-here".');
    assert.equal(await page.locator(".commit-empty-state").getAttribute("aria-live"), "polite");
    await page.getByRole("searchbox", { name: "Search commits" }).press("Enter");
    assert.equal(await page.locator(".commit-row.is-selected").count(), 0);
    await page.getByRole("searchbox", { name: "Search commits" }).press("Escape");
    assert.equal(await page.getByRole("searchbox", { name: "Search commits" }).count(), 0);
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 2");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Search commits");

    const changedNow = page.getByRole("button", { name: "Open Changed now" });
    await changedNow.click();
    const closeChangedNow = page.getByRole("button", { name: "Close Changed now" });
    await closeChangedNow.waitFor();
    assert.equal(await closeChangedNow.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload?.kind), "changed-files");
    assert.equal(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload?.files?.length), 2);

    await closeChangedNow.click();
    assert.equal(await page.getByRole("button", { name: "Open Changed now" }).getAttribute("aria-pressed"), "false");
    assert.equal(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload), null);

    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testMergeFailureStaysInDialog(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, {
    ...mergeFailureScenario(),
    preferences: { createMergeCommit: false },
  });
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /Fix footer changed now toggle/ }).click();
    await page.getByRole("button", { name: "Merge", exact: true }).click();
    const mergeDialog = page.getByRole("dialog", { name: "Merge commit" });
    await mergeDialog.waitFor();
    await page.getByRole("button", { name: "Confirm" }).click();

    await mergeDialog.waitFor();
    const error = page.locator("#action-dialog-error");
    await error.waitFor();
    assert.equal(await error.getAttribute("role"), "alert");
    const errorText = await error.innerText();
    assert.match(errorText, /Auto-merging src\/App\.tsx/);
    assert.match(errorText, /CONFLICT \(content\): Merge conflict in src\/App\.tsx/);
    assert.match(errorText, /Automatic merge failed/);
    assert.deepEqual(await page.evaluate(() => window.__gitPeekActions), [expectedMergeAction("main", false)]);

    await page.getByRole("button", { name: "Copy agent prompt" }).click();
    await page.getByRole("button", { name: "Copied prompt" }).waitFor();
    const copiedPrompt = await page.evaluate(() => window.__gitPeekCopiedText);
    assert.match(copiedPrompt, /A Git merge failed in this repository/);
    assert.match(copiedPrompt, /Source ref\/commit: d4e5f6a000000000000000000000000000000000/);
    assert.match(copiedPrompt, /Target branch: main/);
    assert.match(copiedPrompt, /CONFLICT \(content\): Merge conflict in src\/App\.tsx/);
    assert.match(copiedPrompt, /keep unrelated worktree changes intact/);
    assert.doesNotMatch(copiedPrompt, /No-fast-forward merges are enabled/);

    const mergeTargetButton = page.getByRole("button", { name: "Merge target branch" });
    await mergeTargetButton.click();
    await page.locator("#action-merge-target-menu").getByRole("menuitem", { name: "feature/footer-toggle" }).click();
    assert.equal(await page.locator("#action-dialog-error").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testMergeFailurePromptHonorsNoFastForwardSetting(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, {
    ...mergeFailureScenario(),
    preferences: { createMergeCommit: true },
  });
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /Fix footer changed now toggle/ }).click();
    await page.getByRole("button", { name: "Merge", exact: true }).click();
    const mergeDialog = page.getByRole("dialog", { name: "Merge commit" });
    await mergeDialog.waitFor();
    await page.getByRole("button", { name: "Confirm" }).click();

    await mergeDialog.waitFor();
    await page.locator("#action-dialog-error").waitFor();
    assert.deepEqual(await page.evaluate(() => window.__gitPeekActions), [expectedMergeAction("main", true)]);

    await page.getByRole("button", { name: "Copy agent prompt" }).click();
    await page.getByRole("button", { name: "Copied prompt" }).waitFor();
    const copiedPrompt = await page.evaluate(() => window.__gitPeekCopiedText);
    assert.match(copiedPrompt, /No-fast-forward merges are enabled in Settings/);
    assert.match(copiedPrompt, /do not complete this as a fast-forward merge/);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testMergeStateSurvivesStartup(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mergeInProgressScenario());
  try {
    await assertHealthyPage(page, errors);

    await page.locator(".repository-state-banner").filter({ hasText: "Merge in progress" }).waitFor();
    await page.locator(".repository-state-banner").filter({ hasText: "2 conflicted files" }).waitFor();
    await page.getByText("Merge in progress: 2 conflicted files.").waitFor();

    await page.getByRole("button", { name: "Open Changed now" }).click();
    await page.waitForFunction(() => window.__gitPeekTemporaryInfoPayload?.files?.length === 2);
    assert.deepEqual(
      await page.evaluate(() => window.__gitPeekTemporaryInfoPayload?.files.map((file) => file.statusLabel)),
      ["Conflicted", "Conflicted"],
    );
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoCopyPrompt(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, {
    ...mockedSnapshotScenario(mockCommits),
    temporaryInfoPayload: {
      kind: "changed-files",
      files: snapshotForCommits(mockCommits).changedFiles,
      filter: "all",
      selectedFileKey: "",
      workspaceOpenTarget: "cursor",
    },
  });
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Changed now" }).waitFor();
    assert.equal(await page.locator(".changed-section").getAttribute("aria-labelledby"), "changed-now-title");
    assert.equal(await page.locator("#changed-now-title").innerText(), "Changed now");
    assert.equal(await page.locator(".vite-error-overlay").count(), 0, "Vite error overlay should not render");
    assert.equal(await page.locator(".changed-side-panel").count(), 0);

    await page.getByRole("button", { name: /src\/components\/RecentCommits\.tsx/ }).click();
    await page.getByRole("complementary", { name: "src/components/RecentCommits.tsx" }).waitFor();
    assert.equal(await page.locator(".changed-side-panel").getAttribute("aria-labelledby"), "changed-file-details-title");
    assert.equal(await page.locator(".changed-side-header h2").innerText(), "src/components/RecentCommits.tsx");
    await page.getByRole("button", { name: "Open file in Cursor" }).click();
    assert.deepEqual(await page.evaluate(() => window.__gitPeekOpenedWorkspaceFiles), [
      { target: "cursor", filePath: "src/components/RecentCommits.tsx" },
    ]);
    await page.getByRole("button", { name: "Close changed file details" }).click();
    assert.equal(await page.locator(".changed-side-panel").count(), 0);

    await page.evaluate(() => {
      const payload = {
        ...window.__gitPeekTemporaryInfoPayload,
        selectedFileKey: "M-src/styles.css-",
        workspaceOpenTarget: "finder",
      };
      window.__gitPeekTemporaryInfoPayload = payload;
      window.__gitPeekTemporaryInfoListeners.forEach((callback) => callback(payload));
    });
    await page.getByRole("complementary", { name: "src/styles.css" }).waitFor();
    assert.equal(await page.locator(".changed-side-header h2").innerText(), "src/styles.css");
    assert.equal(await page.getByRole("button", { name: /src\/styles\.css/ }).getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Open file in Finder" }).click();
    assert.deepEqual(await page.evaluate(() => window.__gitPeekOpenedWorkspaceFiles), [
      { target: "cursor", filePath: "src/components/RecentCommits.tsx" },
      { target: "finder", filePath: "src/styles.css" },
    ]);

    await page.getByRole("button", { name: "Copy prompt to commit changes" }).click();
    await page.getByRole("button", { name: "Copied prompt" }).waitFor();
    const copiedPrompt = await page.evaluate(() => window.__gitPeekCopiedText);
    assert.match(copiedPrompt, /Run or review the necessary git status \/ git diff/);
    assert.match(copiedPrompt, /Do not run git commit before Yes/);
    assert.match(copiedPrompt, /Current Changed Now list \(filter: all, files: 2\):/);
    assert.match(copiedPrompt, /\- \[M\] src\/components\/RecentCommits\.tsx: Modified \(\+12 -2\)/);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoCopyFailure(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, {
    ...mockedSnapshotScenario(mockCommits),
    copyTextError: "Clipboard unavailable.",
    temporaryInfoPayload: {
      kind: "changed-files",
      files: snapshotForCommits(mockCommits).changedFiles,
      filter: "all",
      selectedFileKey: "",
    },
  });
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Changed now" }).waitFor();
    await page.getByRole("button", { name: "Copy prompt to commit changes" }).click();
    await page.getByRole("button", { name: "Copy failed" }).waitFor();
    assert.equal(await page.evaluate(() => window.__gitPeekCopiedText), "");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoCopyFallback(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, {
    ...mockedSnapshotScenario(mockCommits),
    clipboardAvailable: true,
    copyTextError: "Native clipboard unavailable.",
    temporaryInfoPayload: {
      kind: "changed-files",
      files: snapshotForCommits(mockCommits).changedFiles,
      filter: "all",
      selectedFileKey: "",
    },
  });
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Changed now" }).waitFor();
    await page.getByRole("button", { name: "Copy prompt to commit changes" }).click();
    await page.getByRole("button", { name: "Copied prompt" }).waitFor();
    assert.equal(await page.evaluate(() => window.__gitPeekCopiedText), "");
    const fallbackPrompt = await page.evaluate(() => window.__gitPeekClipboardText);
    assert.match(fallbackPrompt, /Run or review the necessary git status \/ git diff/);
    assert.match(fallbackPrompt, /Current Changed Now list \(filter: all, files: 2\):/);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoHiddenChangedFiles(browser, baseUrl) {
  const files = Array.from({ length: 10 }, (_, index) =>
    changedFile(`src/generated/file-${index}.ts`, {
      additions: index + 1,
      deletions: 0,
    }),
  );
  const { page, errors } = await openMockedPage(
    browser,
    `${baseUrl}?window=temporary-info`,
    {
      ...mockedSnapshotScenario(mockCommits),
      temporaryInfoPayload: {
        kind: "changed-files",
        files,
        filter: "all",
        selectedFileKey: "",
      },
    },
    { viewport: temporaryInfoViewport },
  );
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Changed now" }).waitFor();
    assert.equal(await page.locator(".temporary-info-panel").evaluate((node) => node.classList.contains("has-detail")), false);
    const fileListBox = await page.locator(".file-list").boundingBox();
    assert.ok(fileListBox && fileListBox.height > 140, `temporary file list should fill the small window: ${JSON.stringify(fileListBox)}`);
    assert.equal(await page.locator(".file-row").count(), 10);
    assert.equal(await page.locator(".file-list-more").count(), 0);
    await assertNoHorizontalOverflow(page, "temporary changed files list");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoEmptyChangedFiles(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, {
    ...mockedSnapshotScenario(mockCommits),
    temporaryInfoPayload: {
      kind: "changed-files",
      files: [],
      filter: "all",
      selectedFileKey: "",
    },
  });
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Changed now" }).waitFor();
    await page.getByRole("status").filter({ hasText: "No files in this view." }).waitFor();
    assert.equal(await page.locator(".empty-state").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator(".file-row").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testLargeCommitListVirtualizes(browser, baseUrl) {
  const largeCommits = numberedCommits(160);
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(largeCommits));
  try {
    await assertHealthyPage(page, errors);
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 160");
    assert.ok(await page.locator(".commit-list-spacer").count(), "large lists should include virtual spacers");
    assert.ok((await page.locator(".commit-row").count()) < 80, "large lists should not render every commit row");

    await page.locator(".scroll-region").first().evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.getByRole("button", { name: /Virtualized commit 160/ }).waitFor();
    assert.ok((await page.locator(".commit-row").count()) < 80, "scrolled large lists should stay virtualized");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testEmptyCommitState(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario([]));
  try {
    await assertHealthyPage(page, errors);
    assert.equal(await page.locator(".commit-empty-state").innerText(), "No commits yet.");
    assert.equal(await page.locator(".commit-empty-state").getAttribute("aria-live"), "polite");
    assert.equal(await page.getByRole("button", { name: "Search commits" }).isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testResponsiveShell(browser, baseUrl) {
  for (const { name, viewport } of [
    { name: "compact", viewport: compactViewport },
    { name: "desktop", viewport: desktopViewport },
  ]) {
    const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits), { viewport });
    try {
      await assertHealthyPage(page, errors);
      await assertNoHorizontalOverflow(page, `${name} shell`);
      await assertVisibleWithinViewport(page, page.getByRole("button", { name: "Settings" }), `${name} settings button`);
      await assertVisibleWithinViewport(page, page.getByRole("button", { name: "Open Changed now" }), `${name} Changed now button`);
      await assertVisibleWithinViewport(page, page.getByRole("button", { name: "Enter Zen mode" }), `${name} Zen button`);

      await page.getByRole("button", { name: "Search commits" }).click();
      await page.getByRole("searchbox", { name: "Search commits" }).fill("footer");
      await assertNoHorizontalOverflow(page, `${name} commit search`);
      await assertVisibleWithinViewport(page, page.getByRole("searchbox", { name: "Search commits" }), `${name} commit search input`);
      assert.equal(await page.locator(".commit-count").innerText(), "Showing 1/2");
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
}

async function testCollapsedRailChangedNowToggle(browser, baseUrl) {
  const branchName = "refactor/codebase-optimization";
  const branchColor = "#25b7ba";
  const collapsedRailCommits = [
    commit({
      hash: "b7c8d9e",
      title: "Tune collapsed rail branch label",
      refs: [branchName],
      lane: "topic",
      branchColor,
      refColors: [branchColor],
    }),
    ...mockCommits,
  ];
  const { page, errors } = await openMockedPage(
    browser,
    baseUrl,
    mockedSnapshotScenario(collapsedRailCommits, {
      branch: { name: branchName, upstream: "origin/refactor/codebase-optimization", ahead: 1, behind: 0, detached: false },
    }),
  );
  try {
    await assertHealthyPage(page, errors);
    const mainBranchColor = await page.evaluate((name) => {
      const refPill = Array.from(document.querySelectorAll(".ref-pill")).find((node) => node.textContent?.trim() === name);
      return refPill ? getComputedStyle(refPill).getPropertyValue("--branch-color").trim() : "";
    }, branchName);
    assert.equal(mainBranchColor, branchColor);

    await page.getByRole("button", { name: "Collapse side peek" }).click();
    await page.setViewportSize({ width: 38, height: 268 });
    await page.getByLabel("Collapsed Git Peek").waitFor();
    await assertNoHorizontalOverflow(page, "collapsed rail");

    const branchLabel = page.getByLabel(`Current branch ${branchName}`);
    await branchLabel.waitFor();
    assert.equal(await branchLabel.locator("span").innerText(), branchName);
    assert.equal(await branchLabel.getAttribute("title"), branchName);

    const railMetrics = await page.locator(".collapsed-rail").evaluate((rail) => {
      const branch = rail.querySelector(".rail-branch");
      const count = rail.querySelector(".rail-count");
      const label = branch?.querySelector("span");
      const toPlainRect = (rect) => ({
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });

      return branch && count && label
        ? {
            rail: toPlainRect(rail.getBoundingClientRect()),
            branch: toPlainRect(branch.getBoundingClientRect()),
            count: toPlainRect(count.getBoundingClientRect()),
            label: toPlainRect(label.getBoundingClientRect()),
            whiteSpace: getComputedStyle(branch).whiteSpace,
            branchColor: getComputedStyle(branch).getPropertyValue("--branch-color").trim(),
            countColor: getComputedStyle(count).getPropertyValue("--branch-color").trim(),
          }
        : null;
    });
    assert.ok(railMetrics, "collapsed rail branch label should render");
    assert.equal(railMetrics.branchColor, mainBranchColor);
    assert.equal(railMetrics.countColor, mainBranchColor);
    assert.equal(railMetrics.whiteSpace, "nowrap");
    assert.ok(railMetrics.label.width <= 16, `label should stay in one vertical column: ${JSON.stringify(railMetrics)}`);
    assert.ok(
      railMetrics.count.top - railMetrics.branch.bottom >= 7,
      `count should have breathing room below branch icon: ${JSON.stringify(railMetrics)}`,
    );
    assert.ok(railMetrics.branch.top >= railMetrics.rail.top - 1, `branch starts inside rail: ${JSON.stringify(railMetrics)}`);
    assert.ok(railMetrics.branch.bottom <= railMetrics.rail.bottom + 1, `branch ends inside rail: ${JSON.stringify(railMetrics)}`);
    assert.ok(railMetrics.label.top >= railMetrics.branch.top - 1, `label starts inside branch slot: ${JSON.stringify(railMetrics)}`);
    assert.ok(railMetrics.label.bottom <= railMetrics.branch.bottom + 1, `label ends inside branch slot: ${JSON.stringify(railMetrics)}`);

    const openChangedNow = page.getByRole("button", { name: "Open Changed now, 2 working tree changes" });
    await openChangedNow.waitFor();
    assert.equal(await openChangedNow.getAttribute("aria-pressed"), "false");

    await openChangedNow.click();
    const closeChangedNow = page.getByRole("button", { name: "Close Changed now, 2 working tree changes" });
    await closeChangedNow.waitFor();
    assert.equal(await closeChangedNow.getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload?.kind), "changed-files");

    await closeChangedNow.click();
    await openChangedNow.waitFor();
    assert.equal(await openChangedNow.getAttribute("aria-pressed"), "false");
    assert.equal(await page.evaluate(() => window.__gitPeekTemporaryInfoPayload), null);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testExternalWorktreeCheckoutDisabled(browser, baseUrl) {
  const { page, errors } = await openMockedPage(
    browser,
    baseUrl,
    mockedSnapshotScenario(externalWorktreeCommits, {
      branches: [
        {
          name: "main",
          fullName: "refs/heads/main",
          type: "local",
          current: true,
          upstream: "origin/main",
        },
        {
          name: "feature/external-worktree",
          fullName: "refs/heads/feature/external-worktree",
          type: "local",
          current: false,
          upstream: "",
        },
      ],
    }),
  );
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /External worktree head/ }).click();
    const merge = page.getByRole("button", { name: "Merge", exact: true });
    const checkout = page.getByRole("button", { name: "Checkout", exact: true });
    await merge.waitFor();
    await checkout.waitFor();

    assert.equal(await merge.isDisabled(), false);
    assert.equal(await merge.getAttribute("title"), null);
    await merge.click();
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog", { name: "Merge commit" }).waitFor({ state: "detached" });

    assert.equal(await checkout.isDisabled(), true);
    assert.equal(await checkout.getAttribute("title"), "Open that worktree first to checkout there.");
    assert.equal(await page.getByRole("dialog", { name: "Checkout commit" }).count(), 0);
    await assertGitActions(page, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testFolderWithoutGitInitialize(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, folderWithoutGitScenario());
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Folder without Git" }).waitFor();
    assert.equal(await page.locator(".empty-repository").getAttribute("aria-labelledby"), "empty-repository-title");
    assert.equal(await page.locator("#empty-repository-title").innerText(), "Folder without Git");
    assert.equal(await page.locator(".empty-folder-path").innerText(), "/Users/junrong/codespace/plain-folder");
    await page.getByText("Adds a starter .gitignore.").waitFor();

    await page.getByRole("button", { name: "Initialize Git" }).click();
    await page.getByRole("heading", { name: "Commits" }).waitFor();
    assert.equal(await page.locator(".repo-title strong").innerText(), "plain-folder");
    await assertGitActions(page, [expectedInitializeRepositoryAction()]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testEmptyRepositoryRecentOverflow(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, noRepositoryScenario());
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByRole("heading", { name: "Open a working folder" }).waitFor();
    await page.getByRole("status").filter({ hasText: "No working folder selected." }).waitFor();
    assert.equal(await page.getByRole("status").filter({ hasText: "No working folder selected." }).getAttribute("aria-live"), "polite");
    await page.getByLabel("Recent repositories").waitFor();
    assert.equal(await page.locator(".empty-recent-repos button").count(), 4);
    assert.equal(await page.locator(".empty-recent-repos-more").innerText(), "+1 more repository");
    assert.equal(await page.locator(".empty-recent-repos-more").getAttribute("aria-live"), "polite");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testBranchViewDoesNotCheckout(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, branchViewScenario());
  try {
    await assertHealthyPage(page, errors);

    const allViewButton = page.getByRole("button", { name: "All" });
    const branchViewButton = page.getByRole("button", { name: "Choose branch view" });
    assert.equal(await allViewButton.getAttribute("aria-pressed"), "true");
    assert.equal(await branchViewButton.getAttribute("aria-pressed"), "false");

    await branchViewButton.click();
    await page.getByRole("menuitem", { name: "feature/footer-toggle", exact: true }).click();
    await page.getByLabel("Viewing branch feature/footer-toggle").waitFor();
    assert.equal(await allViewButton.getAttribute("aria-pressed"), "false");
    assert.equal(await branchViewButton.getAttribute("aria-pressed"), "true");

    assert.deepEqual(await page.evaluate(() => window.__gitPeekSnapshotRequests.at(-1)), {
      mode: "branch",
      ref: "feature/footer-toggle",
    });
    await assertGitActions(page, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testSwitchBranchFromBranchMenu(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, branchViewScenario());
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: "Choose branch view" }).click();
    await page.getByRole("menuitem", { name: "Switch to feature/footer-toggle", exact: true }).click();
    const switchDialog = page.getByRole("dialog", { name: "Switch branch" });
    await switchDialog.waitFor();
    assert.equal(await page.locator("#action-dialog-body").innerText(), "Switch the working folder to feature/footer-toggle.");
    await assertGitActions(page, []);

    await page.getByRole("button", { name: "Confirm" }).click();
    await switchDialog.waitFor({ state: "detached" });
    await assertGitActions(page, [expectedSwitchBranchAction()]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testBranchSwitchDisabledTooltipIsCompact(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, dismissableMenuScenario());
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: "Choose branch view" }).click();
    const disabledSwitch = page.getByRole("menuitem", { name: /^Cannot switch to feature\/footer-toggle:/ });
    await disabledSwitch.waitFor();
    assert.equal(await disabledSwitch.isDisabled(), true);
    assert.equal(await disabledSwitch.getAttribute("title"), "Checked out in another worktree");

    const tooltip = page.locator(".branch-switch-tooltip", { has: disabledSwitch });
    await tooltip.hover();
    await page.waitForFunction(() => {
      const bubble = document.querySelector(".branch-switch-tooltip-bubble");
      return bubble && Number(window.getComputedStyle(bubble).opacity) > 0.95;
    });
    const bubbleMetrics = await tooltip.locator(".branch-switch-tooltip-bubble").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return {
        text: element.textContent?.trim() ?? "",
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
      };
    });
    assert.match(bubbleMetrics.text, /Checked out elsewhere/);
    assert.match(bubbleMetrics.text, /Open that worktree before switching/);
    assert.doesNotMatch(bubbleMetrics.text, /\/Users|git-tree-vis-linked/);
    assert.ok(Number(bubbleMetrics.opacity) >= 0.95, `tooltip should be visible: ${JSON.stringify(bubbleMetrics)}`);
    assert.ok(bubbleMetrics.width <= 196, `tooltip should stay compact: ${JSON.stringify(bubbleMetrics)}`);
    assert.ok(bubbleMetrics.height <= 64, `tooltip should stay compact: ${JSON.stringify(bubbleMetrics)}`);

    await page.getByRole("menuitem", { name: "feature/footer-toggle", exact: true }).click();
    await page.getByLabel("Viewing branch feature/footer-toggle").waitFor();
    await assertGitActions(page, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testMergeTargetDropdownShowsPriorityBranches(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, crowdedMergeTargetScenario(), { viewport: { width: 640, height: 720 } });
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /Fix footer changed now toggle/ }).click();
    await page.getByRole("button", { name: "Merge", exact: true }).click();
    await page.getByRole("button", { name: "Merge target branch" }).click();
    const menu = page.locator("#action-merge-target-menu");
    await menu.waitFor();

    const metrics = await menu.evaluate((element) => {
      const menuRect = element.getBoundingClientRect();
      const triggerRect = document.querySelector("#action-merge-target-trigger")?.getBoundingClientRect();
      const labels = Array.from(element.querySelectorAll(".action-merge-target-menu-item span"));
      const labelText = labels.map((label) => label.textContent?.trim() ?? "");
      const mainLabel = labels.find((label) => label.textContent?.trim() === "main");
      const longLabel = labels.find((label) => label.textContent?.includes("super-long-branch-name"));
      const mainRect = mainLabel?.getBoundingClientRect();
      const longStyle = longLabel ? getComputedStyle(longLabel) : null;
      const menuStyle = getComputedStyle(element);

      return {
        width: menuRect.width,
        triggerWidth: triggerRect?.width ?? 0,
        left: menuRect.left,
        triggerLeft: triggerRect?.left ?? 0,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        labelText,
        mainVisible:
          Boolean(mainRect) &&
          mainRect.top >= menuRect.top &&
          mainRect.bottom <= menuRect.bottom &&
          mainRect.left >= menuRect.left &&
          mainRect.right <= menuRect.right,
        longWhiteSpace: longStyle?.whiteSpace ?? "",
        longOverflowWrap: longStyle?.overflowWrap ?? "",
        longTextOverflow: longStyle?.textOverflow ?? "",
        menuOverflowY: menuStyle.overflowY,
        menuScrollbarGutter: menuStyle.scrollbarGutter,
      };
    });

    assert.deepEqual(metrics.labelText.slice(0, 4), ["feat/branch-swift current", "main", "develop", "master"]);
    assert.ok(metrics.mainVisible, `main should be visible without scrolling: ${JSON.stringify(metrics)}`);
    assert.ok(Math.abs(metrics.width - metrics.triggerWidth) <= 1, `menu should match trigger width: ${JSON.stringify(metrics)}`);
    assert.ok(Math.abs(metrics.left - metrics.triggerLeft) <= 1, `menu should align with trigger left edge: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.clientHeight > 184, `merge target menu should show more rows before scrolling: ${JSON.stringify(metrics)}`);
    assert.ok(
      metrics.scrollHeight > metrics.clientHeight,
      `merge target menu should scroll when branches overflow: ${JSON.stringify(metrics)}`,
    );
    assert.equal(metrics.longWhiteSpace, "normal");
    assert.match(metrics.longOverflowWrap, /anywhere|break-word/);
    assert.equal(metrics.longTextOverflow, "clip");
    assert.equal(metrics.menuOverflowY, "auto");
    assert.match(metrics.menuScrollbarGutter, /stable/);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testOpenWorktreeKeepsCommitView(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, dismissableMenuScenario(), { viewport: desktopViewport });
  try {
    await assertHealthyPage(page, errors);

    const allViewButton = page.getByRole("button", { name: "All" });
    assert.equal(await allViewButton.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name: "Choose worktree" }).click();
    await page.getByRole("menuitem", { name: "feature/footer-toggle - git-tree-vis-linked" }).click();
    await page.waitForFunction(() => window.__gitPeekActions.length === 1);

    await assertGitActions(page, [expectedOpenWorktreeAction({ mode: "all" })]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testRefreshFailureRecovers(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, refreshFailureScenario());
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: "Refresh Git status" }).click();
    await page.locator(".is-spinning").waitFor({ state: "detached" });

    assert.equal(await page.evaluate(() => window.__gitPeekRefreshCount), 1);
    await page.getByText("Native refresh failed.").waitFor();
    assert.equal(await page.locator(".notice-line").getAttribute("aria-live"), "polite");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testPreviewRefreshWithoutBridge(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
  try {
    await assertHealthyPage(page, errors);
    await page.evaluate(() => {
      delete window.gitPeek;
    });

    await page.getByRole("button", { name: "Refresh Git status" }).click();
    const refreshingButton = page.getByRole("button", { name: "Refreshing Git status" });
    await refreshingButton.waitFor();
    assert.equal(await refreshingButton.isDisabled(), true);
    assert.equal(await refreshingButton.getAttribute("aria-busy"), "true");
    await page.locator(".is-spinning").waitFor({ state: "detached" });
    await page.getByText("Preview refreshed.").waitFor();
    assert.equal(await page.locator(".notice-line").getAttribute("aria-live"), "polite");
    assert.equal(await page.getByRole("button", { name: "Refresh Git status" }).isDisabled(), false);

    assert.equal(await page.evaluate(() => window.__gitPeekRefreshCount), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

function optionalStartupFailureScenario() {
  return {
    ...mockedSnapshotScenario(mockCommits),
    systemThemeError: "System theme unavailable.",
    preferencesError: "Preferences unavailable.",
    availableWorkspaceTargetsError: "Workspace target scan failed.",
    recentRepositoriesError: "Recent repositories unavailable.",
    setTemporaryInfoPanelError: "Temporary panel unavailable.",
  };
}

function temporaryInfoStartupFailureScenario() {
  return {
    ...mockedSnapshotScenario(mockCommits),
    temporaryInfoPayloadError: "Temporary payload unavailable.",
    preferencesError: "Preferences unavailable.",
    systemThemeError: "System theme unavailable.",
  };
}

async function testOptionalStartupFailuresDoNotBreakMainWindow(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, optionalStartupFailureScenario());
  try {
    await assertHealthyPage(page, errors);
    assert.equal(await page.locator(".commit-count").innerText(), "Showing 2");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testTemporaryInfoStartupFailuresDoNotBreakWindow(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, temporaryInfoStartupFailureScenario());
  try {
    assert.match(await page.title(), /Git Peek/);
    await page.getByLabel("Temporary information").waitFor();
    await page.getByRole("status").filter({ hasText: "No file selected." }).waitFor();
    assert.equal(await page.locator(".temporary-info-empty").innerText(), "No file selected.");
    assert.equal(await page.locator(".temporary-info-empty").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator(".vite-error-overlay").count(), 0, "Vite error overlay should not render");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testDismissableMenus(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, dismissableMenuScenario(), { viewport: desktopViewport });
  try {
    await assertHealthyPage(page, errors);

    const repoMenuButton = page.getByRole("button", { name: "Switch recent repository" });
    await repoMenuButton.click();
    await page.locator("#repo-switch-menu").waitFor();
    assert.equal(await repoMenuButton.getAttribute("id"), "repo-switch-trigger");
    assert.equal(await repoMenuButton.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#repo-switch-menu").getAttribute("aria-labelledby"), "repo-switch-trigger");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#repo-switch-menu").count(), 0);
    assert.equal(await repoMenuButton.getAttribute("aria-expanded"), "false");

    const branchMenuButton = page.getByRole("button", { name: "Choose branch view" });
    await branchMenuButton.click();
    await page.locator("#branch-ref-menu").waitFor();
    assert.equal(await branchMenuButton.getAttribute("id"), "branch-ref-trigger");
    assert.equal(await branchMenuButton.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#branch-ref-menu").getAttribute("aria-labelledby"), "branch-ref-trigger");
    await page.getByRole("heading", { name: "Commits" }).click();
    assert.equal(await page.locator("#branch-ref-menu").count(), 0);
    assert.equal(await branchMenuButton.getAttribute("aria-expanded"), "false");

    const workspaceMenuButton = page.getByRole("button", { name: "Choose external app" });
    await workspaceMenuButton.click();
    await page.locator("#workspace-open-menu").waitFor();
    assert.equal(await workspaceMenuButton.getAttribute("id"), "workspace-open-menu-toggle");
    assert.equal(await workspaceMenuButton.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#workspace-open-menu").getAttribute("aria-labelledby"), "workspace-open-menu-toggle");
    assert.equal(await page.locator("#workspace-open-menu .workspace-open-menu-item.is-active").innerText(), "Finder");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#workspace-open-menu").count(), 0);
    assert.equal(await workspaceMenuButton.getAttribute("aria-expanded"), "false");

    await workspaceMenuButton.click();
    await page.getByRole("menuitem", { name: "Finder" }).click();
    assert.deepEqual(await page.evaluate(() => window.__gitPeekOpenedWorkspaces), ["finder"]);
    await page.getByRole("button", { name: "Open in Finder" }).click();
    assert.deepEqual(await page.evaluate(() => window.__gitPeekOpenedWorkspaces), ["finder", "finder"]);
    await page.getByRole("button", { name: "Open Changed now" }).click();
    await page.waitForFunction(() => window.__gitPeekTemporaryInfoPayload?.workspaceOpenTarget === "finder");

    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testFocusedViewEscapeControls(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
  try {
    await assertHealthyPage(page, errors);

    const pinButton = page.getByRole("button", { name: "Pin floating panel" });
    const unpinButton = page.getByRole("button", { name: "Unpin floating panel" });
    await pinButton.waitFor();
    assert.equal(await pinButton.getAttribute("aria-pressed"), "false");
    await page.evaluate(() => window.__gitPeekPinnedListeners.forEach((callback) => callback(true)));
    await unpinButton.waitFor();
    assert.equal(await unpinButton.getAttribute("aria-pressed"), "true");
    await page.evaluate(() => window.__gitPeekPinnedListeners.forEach((callback) => callback(false)));
    await pinButton.waitFor();
    assert.equal(await pinButton.getAttribute("aria-pressed"), "false");
    await pinButton.click();
    await unpinButton.waitFor();
    assert.equal(await unpinButton.getAttribute("aria-pressed"), "true");
    await unpinButton.click();
    await pinButton.waitFor();
    assert.equal(await pinButton.getAttribute("aria-pressed"), "false");

    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    assert.equal(await page.locator(".settings-page").getAttribute("aria-labelledby"), "settings-panel-title");
    assert.equal(await page.locator("#settings-panel-title").innerText(), "Settings");
    assert.equal(await page.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByRole("button", { name: "Light" }).getAttribute("aria-pressed"), "false");
    assert.equal(await page.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByRole("button", { name: "Comfort" }).getAttribute("aria-pressed"), "false");
    assert.equal(await page.getByRole("button", { name: "Solid" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByRole("button", { name: "Soft" }).getAttribute("aria-pressed"), "false");
    assert.equal(await page.getByRole("button", { name: "English" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.getByRole("button", { name: "中文" }).getAttribute("aria-pressed"), "false");
    await page.getByRole("combobox", { name: "Light theme preset" }).waitFor();
    await page.getByRole("combobox", { name: "Dark theme preset" }).waitFor();
    await page.getByRole("combobox", { name: "Font family" }).waitFor();
    const refreshDropdown = page.getByRole("button", { name: "Auto refresh interval" });
    await refreshDropdown.waitFor();
    assert.equal(await refreshDropdown.innerText(), "Off");
    await refreshDropdown.click();
    const refreshMenu = page.locator("#settings-refresh-menu");
    await refreshMenu.waitFor();
    assert.equal(await refreshMenu.getAttribute("role"), "menu");
    assert.equal(await page.getByRole("menuitemradio", { name: "Off" }).getAttribute("aria-checked"), "true");
    await page.getByRole("menuitemradio", { name: "5 min", exact: true }).click();
    await refreshMenu.waitFor({ state: "detached" });
    assert.equal(await refreshDropdown.innerText(), "5 min");
    assert.equal(await page.evaluate(() => window.__gitPeekSavedPreferences.at(-1)?.autoRefreshInterval), "5m");
    const behaviorToggleLabels = [
      "Launch at login",
      "Show menu bar icon",
      "Disable fast-forward merges",
      "Show Zen mode entry",
    ];
    const behaviorToggleBounds = await Promise.all(
      behaviorToggleLabels.map(async (name) => {
        const box = await page.getByRole("checkbox", { name }).boundingBox();
        assert.ok(box, `${name} toggle should be visible`);
        return { name, right: Math.round(box.x + box.width) };
      }),
    );
    const firstBehaviorToggle = behaviorToggleBounds[0];
    behaviorToggleBounds.forEach((toggle) => {
      assert.ok(
        Math.abs(toggle.right - firstBehaviorToggle.right) <= 1,
        `${toggle.name} should align with ${firstBehaviorToggle.name}: ${JSON.stringify(behaviorToggleBounds)}`,
      );
    });
    await page.evaluate(() => {
      window.__gitPeekPreferencesListeners.forEach((callback) => callback({ zenMode: true }));
    });
    await page.getByRole("button", { name: "Exit Zen mode" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Settings" }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "true");
    assert.deepEqual(
      await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.autoRefreshInterval)),
      ["5m"],
    );
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "false");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [
      false,
      false,
    ]);

    await page.getByRole("button", { name: "Open external app settings" }).click();
    await page.getByRole("heading", { name: "Open in" }).waitFor();
    assert.equal(await page.locator(".settings-page").getAttribute("aria-labelledby"), "settings-panel-title");
    assert.equal(await page.locator("#settings-panel-title").innerText(), "Open in");
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Open in" }).count(), 0);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Commits" }).waitFor();

    await page.getByRole("button", { name: "Enter Zen mode" }).click();
    await page.getByRole("button", { name: "Exit Zen mode" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "true");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [
      false,
      false,
      true,
    ]);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Commits" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "false");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [
      false,
      false,
      true,
      false,
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testSettingsOpenInEmptyState(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, {
    ...mockedSnapshotScenario(mockCommits),
    availableWorkspaceTargets: [],
  });
  try {
    await assertHealthyPage(page, errors);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    await page.getByRole("button", { name: "Open external app settings" }).click();
    await page.getByRole("heading", { name: "Open in" }).waitFor();
    await page.getByRole("status").filter({ hasText: "No external apps available." }).waitFor();
    assert.equal(await page.locator(".empty-state").getAttribute("aria-live"), "polite");
    assert.equal(await page.locator(".workspace-target-list").count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function main() {
  const [{ chromium }, { createServer }] = await Promise.all([import("playwright"), import("vite")]);
  const server = await createServer({
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });

  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(port, "Vite did not expose a local port");

  const baseUrl = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ headless: true });

  try {
    await testSelectedCommitGraphAnchor(browser, baseUrl);
    await testCommitHoverPanel(browser, baseUrl);
    await testCommitInfoPanel(browser, baseUrl);
    await testCommitSearch(browser, baseUrl);
    await testLargeCommitListVirtualizes(browser, baseUrl);
    await testMergeFailureStaysInDialog(browser, baseUrl);
    await testMergeFailurePromptHonorsNoFastForwardSetting(browser, baseUrl);
    await testMergeStateSurvivesStartup(browser, baseUrl);
    await testTemporaryInfoCopyPrompt(browser, baseUrl);
    await testTemporaryInfoCopyFallback(browser, baseUrl);
    await testTemporaryInfoCopyFailure(browser, baseUrl);
    await testTemporaryInfoHiddenChangedFiles(browser, baseUrl);
    await testTemporaryInfoEmptyChangedFiles(browser, baseUrl);
    await testEmptyCommitState(browser, baseUrl);
    await testResponsiveShell(browser, baseUrl);
    await testCollapsedRailChangedNowToggle(browser, baseUrl);
    await testExternalWorktreeCheckoutDisabled(browser, baseUrl);
    await testFolderWithoutGitInitialize(browser, baseUrl);
    await testEmptyRepositoryRecentOverflow(browser, baseUrl);
    await testBranchViewDoesNotCheckout(browser, baseUrl);
    await testSwitchBranchFromBranchMenu(browser, baseUrl);
    await testBranchSwitchDisabledTooltipIsCompact(browser, baseUrl);
    await testMergeTargetDropdownShowsPriorityBranches(browser, baseUrl);
    await testOpenWorktreeKeepsCommitView(browser, baseUrl);
    await testRefreshFailureRecovers(browser, baseUrl);
    await testPreviewRefreshWithoutBridge(browser, baseUrl);
    await testOptionalStartupFailuresDoNotBreakMainWindow(browser, baseUrl);
    await testTemporaryInfoStartupFailuresDoNotBreakWindow(browser, baseUrl);
    await testDismissableMenus(browser, baseUrl);
    await testFocusedViewEscapeControls(browser, baseUrl);
    await testSettingsOpenInEmptyState(browser, baseUrl);
    console.log(`UI smoke checks passed at ${baseUrl}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
