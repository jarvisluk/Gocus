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

function expectedInitializeRepositoryAction() {
  return {
    type: "initializeRepository",
    repositoryPath: "/Users/junrong/codespace/plain-folder",
    view: { mode: "all" },
  };
}

function graph(overrides = {}) {
  return {
    column: 0,
    laneCount: 1,
    currentColor: "#2f80ed",
    currentVariant: "solid",
    currentContinues: true,
    passThrough: [],
    parentStems: [],
    bridges: [],
    isMerge: false,
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
    additions: overrides.additions ?? 8,
    deletions: overrides.deletions ?? 1,
    filesChanged: overrides.filesChanged ?? 2,
    parents: overrides.parents ?? ["0000000"],
    refs: overrides.refs ?? [],
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
    branch: { name: "main", upstream: "origin/main", ahead: 1, behind: 0, detached: false },
    branches: overrides.branches ?? [],
    worktrees: overrides.worktrees ?? [],
    view: overrides.view ?? { mode: "all" },
    counts: { modified: 1, staged: 0, untracked: 1 },
    commits,
    changedFiles: [
      changedFile("src/components/RecentCommits.tsx"),
      changedFile("src/styles.css", { additions: 6, deletions: 0 }),
    ],
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
  window.__gitPeekTemporaryInfoListeners = [];
  window.__gitPeekPreferencesListeners = [];
  window.__gitPeekPinnedListeners = [];
  window.__gitPeekPinnedState = Boolean(config.pinned);
  window.__gitPeekSavedPreferences = [];
  window.__gitPeekSnapshotRequests = [];
  window.__gitPeekOpenedWorkspaces = [];
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
      return null;
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
    onTemporaryInfoPayloadUpdated: (callback) => {
      window.__gitPeekTemporaryInfoListeners.push(callback);
      return () => {
        window.__gitPeekTemporaryInfoListeners = window.__gitPeekTemporaryInfoListeners.filter((listener) => listener !== callback);
      };
    },
    onTemporaryInfoPanelClosed: () => () => {},
    setTemporaryInfoPanel: async (payload) => {
      if (config.setTemporaryInfoPanelError) throw new Error(config.setTemporaryInfoPanelError);
      window.__gitPeekTemporaryInfoPayload = payload;
      window.__gitPeekTemporaryInfoListeners.forEach((callback) => callback(payload));
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
    openWorktree: async () => ({ ok: true, snapshot: actionSnapshot }),
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
  await page.getByRole("heading", { name: "Recent commits" }).waitFor();
  assert.equal(await page.locator(".commits-section").getAttribute("aria-labelledby"), "recent-commits-title");
  assert.equal(await page.locator("#recent-commits-title").innerText(), "Recent commits");
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
    const bottomSvg = row.querySelector(".graph-svg-bottom");
    const timeline = row.querySelector(".timeline-cell");

    if (!node || !topSvg || !bottomSvg || !timeline) return null;

    const nodeRect = node.getBoundingClientRect();
    const topSvgRect = topSvg.getBoundingClientRect();
    const bottomSvgRect = bottomSvg.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();

    return {
      nodeCenterY: nodeRect.top + nodeRect.height / 2,
      topSvgBottomY: topSvgRect.bottom,
      bottomSvgTopY: bottomSvgRect.top,
      rowHeight: rowRect.height,
      timelineHeight: timelineRect.height,
      topViewBox: topSvg.getAttribute("viewBox"),
      bottomViewBox: bottomSvg.getAttribute("viewBox"),
    };
  });

  assert.ok(metrics, "selected commit should render graph segments and a node");
  assert.equal(metrics.topViewBox, "0 0 42 32");
  assert.equal(metrics.bottomViewBox, "0 32 42 68");
  assert.ok(metrics.rowHeight > 90, `selected row should be expanded: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.timelineHeight >= metrics.rowHeight - 1, `timeline should span selected row: ${JSON.stringify(metrics)}`);
  assert.ok(
    Math.abs(metrics.nodeCenterY - metrics.topSvgBottomY) <= 0.75,
    `top graph segment should end at node: ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    Math.abs(metrics.nodeCenterY - metrics.bottomSvgTopY) <= 0.75,
    `bottom graph segment should start at node: ${JSON.stringify(metrics)}`,
  );
}

async function assertGitActions(page, expectedActions) {
  assert.deepEqual(await page.evaluate(() => window.__gitPeekActions), expectedActions);
}

async function testSelectedCommitGraphAnchor(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
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

    await page.getByRole("button", { name: /Add commit search polish/ }).hover();
    const hoverPanel = page.locator(".commit-hover-panel");
    await hoverPanel.waitFor();

    const panelText = await hoverPanel.innerText();
    assert.match(panelText, /Codex/);
    assert.match(panelText, /2 minutes ago/);
    assert.match(panelText, /Add commit search polish and keyboard selection/);
    assert.match(panelText, /2 files changed, 8 insertions\(\+\), 1 deletion\(-\)/);
    assert.match(panelText, /main/);
    assert.match(panelText, /a1b2c3d/);
    await assertVisibleWithinViewport(page, hoverPanel, "commit hover panel");
    await assertNoHorizontalOverflow(page, "commit hover panel");

    await page.mouse.move(1, 1);
    await hoverPanel.waitFor({ state: "detached" });
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function testCommitSearch(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
  try {
    const createdBranchAction = expectedCreateBranchAction("feat/d4e5f6a");
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
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog", { name: "Create branch" }).count(), 0);
    await assertGitActions(page, []);

    await page.getByRole("button", { name: "Branch", exact: true }).click();
    await page.getByRole("dialog", { name: "Create branch" }).waitFor();
    const branchNameInput = page.getByRole("textbox", { name: "Branch name" });
    await page.getByLabel("Branch prefix").selectOption("feat");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/d4e5f6a");
    await branchNameInput.fill("feat/ready");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/ready");
    await branchNameInput.fill("d4e5f6a");
    assert.equal(await page.locator(".action-branch-preview").innerText(), "feat/d4e5f6a");
    await branchNameInput.press("Enter");
    await page.getByRole("dialog", { name: "Create branch" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("dialog", { name: "Checkout commit" }).count(), 0);
    await assertGitActions(page, [createdBranchAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Cancel");
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog", { name: "Checkout commit" }).count(), 0);
    await assertGitActions(page, [createdBranchAction]);

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByRole("dialog", { name: "Checkout commit" }).waitFor({ state: "detached" });
    await assertGitActions(page, [createdBranchAction, checkoutAction]);

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

async function testTemporaryInfoCopyPrompt(browser, baseUrl) {
  const { page, errors } = await openMockedPage(browser, `${baseUrl}?window=temporary-info`, {
    ...mockedSnapshotScenario(mockCommits),
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
    assert.equal(await page.locator(".changed-section").getAttribute("aria-labelledby"), "changed-now-title");
    assert.equal(await page.locator("#changed-now-title").innerText(), "Changed now");
    assert.equal(await page.locator(".vite-error-overlay").count(), 0, "Vite error overlay should not render");
    assert.equal(await page.locator(".changed-side-panel").count(), 0);

    await page.getByRole("button", { name: /src\/components\/RecentCommits\.tsx/ }).click();
    await page.getByRole("complementary", { name: "src/components/RecentCommits.tsx" }).waitFor();
    assert.equal(await page.locator(".changed-side-panel").getAttribute("aria-labelledby"), "changed-file-details-title");
    assert.equal(await page.locator(".changed-side-header h2").innerText(), "src/components/RecentCommits.tsx");
    await page.getByRole("button", { name: "Close changed file details" }).click();
    assert.equal(await page.locator(".changed-side-panel").count(), 0);

    await page.evaluate(() => {
      const payload = {
        ...window.__gitPeekTemporaryInfoPayload,
        selectedFileKey: "M-src/styles.css-",
      };
      window.__gitPeekTemporaryInfoPayload = payload;
      window.__gitPeekTemporaryInfoListeners.forEach((callback) => callback(payload));
    });
    await page.getByRole("complementary", { name: "src/styles.css" }).waitFor();
    assert.equal(await page.locator(".changed-side-header h2").innerText(), "src/styles.css");
    assert.equal(await page.getByRole("button", { name: /src\/styles\.css/ }).getAttribute("aria-pressed"), "true");

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
    assert.equal(await page.locator(".file-row").count(), 8);
    assert.equal(await page.locator(".file-list-more").innerText(), "+2 more files");
    assert.equal(await page.locator(".file-list-more").getAttribute("aria-live"), "polite");
    await assertNoHorizontalOverflow(page, "temporary changed files overflow hint");
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
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(mockCommits));
  try {
    await assertHealthyPage(page, errors);
    await page.getByRole("button", { name: "Collapse side peek" }).click();
    await page.getByLabel("Collapsed Git Peek").waitFor();

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
  const { page, errors } = await openMockedPage(browser, baseUrl, mockedSnapshotScenario(externalWorktreeCommits));
  try {
    await assertHealthyPage(page, errors);

    await page.getByRole("button", { name: /External worktree head/ }).click();
    const checkout = page.getByRole("button", { name: "Checkout", exact: true });
    await checkout.waitFor();

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
    await page.getByRole("heading", { name: "Recent commits" }).waitFor();
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
    await page.getByRole("menuitem", { name: "feature/footer-toggle" }).click();
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
    await page.getByRole("heading", { name: "Recent commits" }).click();
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
    await page.getByRole("combobox", { name: "Auto refresh interval" }).waitFor();
    await page.getByRole("checkbox", { name: "Show menu bar icon" }).waitFor();
    await page.evaluate(() => {
      window.__gitPeekPreferencesListeners.forEach((callback) => callback({ zenMode: true }));
    });
    await page.getByRole("button", { name: "Exit Zen mode" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Settings" }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "true");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences), []);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "false");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [false]);

    await page.getByRole("button", { name: "Open external app settings" }).click();
    await page.getByRole("heading", { name: "Open in" }).waitFor();
    assert.equal(await page.locator(".settings-page").getAttribute("aria-labelledby"), "settings-panel-title");
    assert.equal(await page.locator("#settings-panel-title").innerText(), "Open in");
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Settings" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Open in" }).count(), 0);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Recent commits" }).waitFor();

    await page.getByRole("button", { name: "Enter Zen mode" }).click();
    await page.getByRole("button", { name: "Exit Zen mode" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "true");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [
      false,
      true,
    ]);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "Recent commits" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.zenMode), "false");
    assert.deepEqual(await page.evaluate(() => window.__gitPeekSavedPreferences.map((preferences) => preferences.zenMode)), [
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
    await testCommitSearch(browser, baseUrl);
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
