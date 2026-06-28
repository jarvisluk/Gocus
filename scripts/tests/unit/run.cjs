#!/usr/bin/env node

process.env.TZ = process.env.TZ || "Asia/Shanghai";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  resolveDevelopReleaseVersion,
  targetVersionFromPackageVersion,
} = require("../../resolve-develop-version.cjs");

const projectRoot = path.resolve(__dirname, "../../..");

function projectRelative(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function gitAcceptsBranchName(branchName) {
  return spawnSync("git", ["check-ref-format", "--branch", branchName], { stdio: "ignore" }).status === 0;
}

function runGitFixture(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    ...options,
  });

  if (options.allowFailure) return result;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function testDevelopReleaseVersionScript() {
  assert.equal(targetVersionFromPackageVersion("0.1.1"), "0.1.2");
  assert.equal(targetVersionFromPackageVersion("0.1.1-beta.4"), "0.1.2");

  assert.deepEqual(
    resolveDevelopReleaseVersion({
      inputVersion: "0.3.0-dev.7",
      developNextVersion: "0.2.0",
      packageVersion: "0.1.1",
      runNumber: "99",
    }),
    {
      source: "manual",
      targetVersion: "",
      version: "0.3.0-dev.7",
    },
  );
  assert.deepEqual(
    resolveDevelopReleaseVersion({
      developNextVersion: "0.2.0\n",
      packageVersion: "0.1.1",
      runNumber: "42",
    }),
    {
      source: "develop-next-version",
      targetVersion: "0.2.0",
      version: "0.2.0-dev.42",
    },
  );
  assert.deepEqual(
    resolveDevelopReleaseVersion({
      developNextVersion: "",
      packageVersion: "0.1.1",
      runNumber: "9",
    }),
    {
      source: "package-json-patch",
      targetVersion: "0.1.2",
      version: "0.1.2-dev.9",
    },
  );
  assert.throws(
    () =>
      resolveDevelopReleaseVersion({
        developNextVersion: "0.2.0-dev.1",
        packageVersion: "0.1.1",
        runNumber: "9",
      }),
    /Develop target version must be stable semver/,
  );
  assert.throws(
    () =>
      resolveDevelopReleaseVersion({
        developNextVersion: "0.2.0",
        packageVersion: "0.1.1",
        runNumber: "",
      }),
    /GITHUB_RUN_NUMBER is required/,
  );
}

function commit(overrides = {}) {
  return {
    id: "a1b2c3d",
    fullHash: "a1b2c3d000000000000000000000000000000000",
    hash: "a1b2c3d",
    title: "Add commit search polish",
    message: "Add commit search polish and keyboard selection",
    author: "Codex",
    relativeTime: "2 minutes ago",
    authoredAt: "2026-06-10T02:26:00+08:00",
    additions: 8,
    deletions: 1,
    filesChanged: 2,
    parents: ["0000000"],
    refs: ["main"],
    mergedRefs: [],
    containedBranches: [],
    lane: "main",
    branchColor: "#2f80ed",
    refColors: ["#2f80ed"],
    graph: {
      column: 0,
      laneCount: 1,
      currentColor: "#2f80ed",
      currentLabel: "main",
      currentVariant: "solid",
      incomingColor: "#2f80ed",
      incomingVariant: "solid",
      currentContinues: true,
      passThrough: [],
      parentStems: [],
      bridges: [],
      isMerge: false,
      isCurrentHead: false,
    },
    checkedOutWorktrees: [],
    ...overrides,
  };
}

function gitSnapshot(overrides = {}) {
  return {
    repoPath: "/Users/junrong/repo",
    repoName: "repo",
    repositoryKey: "repo-key",
    branch: { name: "main", upstream: "", ahead: 0, behind: 0, detached: false },
    branches: [],
    worktrees: [],
    view: { mode: "all" },
    counts: { modified: 0, staged: 0, untracked: 0 },
    commits: [commit({ id: "keep" }), commit({ id: "other" })],
    changedFiles: [],
    repositoryState: { operation: "none", operationLabel: "Ready", hasConflicts: false, conflictedFiles: [] },
    lastFetchedAt: "2026-06-10T00:00:00.000Z",
    isSample: false,
    ...overrides,
  };
}

async function loadTsModule(server, relativePath) {
  return server.ssrLoadModule(pathToFileURL(path.join(projectRoot, relativePath)).href);
}

async function testRootMount(server) {
  const { rootElementFromDocument, rootWindowModeFromUrl } = await loadTsModule(server, "src/lib/rootMount.ts");
  const rootElement = { id: "root" };

  assert.equal(rootWindowModeFromUrl("http://127.0.0.1/"), "main");
  assert.equal(rootWindowModeFromUrl("http://127.0.0.1/?window=temporary-info"), "temporary-info");
  assert.equal(rootWindowModeFromUrl("http://127.0.0.1/?window=changed-file-info"), "changed-file-info");
  assert.equal(rootWindowModeFromUrl("http://127.0.0.1/?window=commit-info"), "commit-info");
  assert.equal(rootWindowModeFromUrl("http://127.0.0.1/?window=main"), "main");
  assert.equal(rootWindowModeFromUrl("not a url"), "main");
  assert.equal(
    rootElementFromDocument({
      getElementById: (id) => (id === "root" ? rootElement : null),
    }),
    rootElement,
  );
  assert.throws(
    () =>
      rootElementFromDocument({
        getElementById: () => null,
      }),
    /Missing #root root element/,
  );
  assert.throws(
    () =>
      rootElementFromDocument(
        {
          getElementById: () => null,
        },
        "app",
      ),
    /Missing #app root element/,
  );
}

async function testIconButtonView(server) {
  const { iconButtonView } = await loadTsModule(server, "src/lib/iconButtonView.ts");

  assert.deepEqual(iconButtonView({ label: "Refresh Git status" }), {
    className: "icon-button",
    ariaLabel: "Refresh Git status",
    ariaBusy: undefined,
    ariaPressed: undefined,
    title: "Refresh Git status",
  });
  assert.deepEqual(iconButtonView({ label: "Refreshing Git status", busy: true }), {
    className: "icon-button",
    ariaLabel: "Refreshing Git status",
    ariaBusy: true,
    ariaPressed: undefined,
    title: "Refreshing Git status",
  });
  assert.deepEqual(iconButtonView({ label: "Pin floating panel", active: false }), {
    className: "icon-button",
    ariaLabel: "Pin floating panel",
    ariaBusy: undefined,
    ariaPressed: false,
    title: "Pin floating panel",
  });
  assert.deepEqual(iconButtonView({ label: "Unpin floating panel", active: true }), {
    className: "icon-button is-active",
    ariaLabel: "Unpin floating panel",
    ariaBusy: undefined,
    ariaPressed: true,
    title: "Unpin floating panel",
  });
}

async function testStatusView(server) {
  const { politeStatusView } = await loadTsModule(server, "src/lib/statusView.ts");

  assert.deepEqual(politeStatusView({ className: "notice-line", message: "Ready." }), {
    className: "notice-line",
    message: "Ready.",
    role: "status",
    ariaLive: "polite",
  });
  assert.deepEqual(politeStatusView({ role: "alert", ariaLive: "assertive", message: "Softened." }), {
    role: "status",
    ariaLive: "polite",
    message: "Softened.",
  });
}

function testFileChecksUtility() {
  const {
    collectMatchingFiles,
    formatProcessFailure,
    processFailure,
    relativePath,
  } = require(path.join(projectRoot, "scripts/lib/file-checks.cjs"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-file-checks-"));

  try {
    fs.mkdirSync(path.join(tempDir, "src/nested"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "src/node_modules"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "README.md"), "# Fixture\n", "utf8");
    fs.writeFileSync(path.join(tempDir, "src/check.cjs"), "module.exports = true;\n", "utf8");
    fs.writeFileSync(path.join(tempDir, "src/nested/skip.js"), "console.log('skip');\n", "utf8");
    fs.writeFileSync(path.join(tempDir, "src/node_modules/ignored.cjs"), "module.exports = false;\n", "utf8");

    const files = collectMatchingFiles({
      projectRoot: tempDir,
      roots: ["src", "missing-root"],
      rootFiles: ["README.md", "src/check.cjs", "missing.md"],
      extensions: new Set([".cjs", ".md"]),
    });
    assert.deepEqual(files.map((filePath) => relativePath(tempDir, filePath)), ["README.md", "src/check.cjs"]);

    const failure = processFailure(tempDir, path.join(tempDir, "src/check.cjs"), {
      status: 2,
      signal: null,
      stdout: " stdout \n",
      stderr: " stderr \n",
    });
    assert.deepEqual(failure, {
      filePath: path.join(tempDir, "src/check.cjs"),
      relativeFilePath: "src/check.cjs",
      status: 2,
      signal: null,
      stdout: "stdout",
      stderr: "stderr",
    });
    assert.equal(formatProcessFailure(failure, "fixture --check"), "\nsrc/check.cjs\nstderr\nstdout");

    assert.equal(
      formatProcessFailure({ ...failure, stdout: "", stderr: "" }, "fixture --check"),
      "\nsrc/check.cjs\nfixture --check exited with 2",
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testSecretScanScript() {
  const {
    collectSecretScanFiles,
    findSecretFindingsInContent,
    formatFinding,
    lineNumberFromIndex,
    runSecretScan,
  } = require(path.join(projectRoot, "scripts/check-secrets.cjs"));

  assert.equal(lineNumberFromIndex("one\ntwo\nthree\n", 4), 2);
  assert.deepEqual(
    findSecretFindingsInContent(
      "fixture.txt",
      [
        "safe reference: secrets.DEVELOP_RELEASE_TOKEN",
        `aws=${"AKIA"}${"ABCDEFGHIJKLMNOP"}`,
        `openai=${"sk-"}${"abcdefghijklmnopqrstuvwxyz"}`,
        `key=${"-----BEGIN OPENSSH"}${" PRIVATE KEY-----"}`,
      ].join("\n"),
    ),
    [
      { label: "AWS access key", lineNumber: 2, relativeFilePath: "fixture.txt" },
      { label: "OpenAI-style API key", lineNumber: 3, relativeFilePath: "fixture.txt" },
      { label: "private key", lineNumber: 4, relativeFilePath: "fixture.txt" },
    ],
  );
  assert.deepEqual(findSecretFindingsInContent("workflow.yml", "token: ${{ secrets.DEVELOP_RELEASE_TOKEN }}\n"), []);
  assert.equal(
    formatFinding({ label: "GitHub token", lineNumber: 7, relativeFilePath: ".github/workflows/release.yml" }),
    ".github/workflows/release.yml:7: possible GitHub token",
  );

  const secretFileLabels = collectSecretScanFiles().map((filePath) => path.relative(projectRoot, filePath));
  assert.ok(secretFileLabels.includes(".github/workflows/release.yml"));
  assert.ok(secretFileLabels.includes("package-lock.json"));
  assert.ok(secretFileLabels.includes("scripts/check-secrets.cjs"));
  assert.deepEqual(secretFileLabels, [...secretFileLabels].sort((left, right) => left.localeCompare(right)));

  const currentResult = runSecretScan();
  assert.ok(currentResult.checkedFiles.length >= secretFileLabels.length);
  assert.deepEqual(currentResult.findings, []);
}

function testWorkspaceModule() {
  const { __private } = require(path.join(projectRoot, "electron/lib/workspace.cjs"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-workspace-"));

  try {
    const nodeVersionsDir = path.join(tempDir, ".nvm", "versions", "node");
    fs.mkdirSync(path.join(nodeVersionsDir, "v20.19.6", "bin"), { recursive: true });
    fs.mkdirSync(path.join(nodeVersionsDir, "v24.14.1", "bin"), { recursive: true });

    const expectedNvmPaths = [
      path.join(nodeVersionsDir, "v24.14.1", "bin", "codex"),
      path.join(nodeVersionsDir, "v20.19.6", "bin", "codex"),
    ];
    assert.deepEqual(__private.nvmCodexCliCandidatePaths(tempDir), expectedNvmPaths);
    assert.deepEqual(__private.codexCliCandidatePaths({ env: {}, homeDir: tempDir, platform: "darwin" }), [
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      path.join(tempDir, ".local", "bin", "codex"),
      ...expectedNvmPaths,
    ]);
    assert.deepEqual(__private.codexCliCandidatePaths({ env: { GOCUS_CODEX_CLI: "/tmp/codex" }, homeDir: tempDir, platform: "darwin" }), [
      "/tmp/codex",
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      path.join(tempDir, ".local", "bin", "codex"),
      ...expectedNvmPaths,
    ]);
    assert.deepEqual(
      __private.codexCliCandidatePaths({
        env: {
          APPDATA: path.join(tempDir, "Roaming"),
          LOCALAPPDATA: path.join(tempDir, "Local"),
          GOCUS_CODEX_CLI: "C:\\Tools\\codex.exe",
        },
        homeDir: tempDir,
        platform: "win32",
      }),
      [
        "C:\\Tools\\codex.exe",
        path.join(tempDir, "Roaming", "npm", "codex.exe"),
        path.join(tempDir, "Roaming", "npm", "codex.cmd"),
        path.join(tempDir, "Roaming", "npm", "codex"),
      ],
    );
    assert.deepEqual(
      __private.windowsCliCandidatePaths("antigravity", {
        env: {
          LOCALAPPDATA: path.join(tempDir, "Local"),
          GOCUS_ANTIGRAVITY_CLI: "C:\\Tools\\antigravity.cmd",
        },
        homeDir: tempDir,
      }),
      [
        "C:\\Tools\\antigravity.cmd",
        path.join(tempDir, "Local", "Programs", "Antigravity", "bin", "antigravity.cmd"),
        path.join(tempDir, "Local", "Programs", "Antigravity", "bin", "antigravity"),
      ],
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testSourceHygieneScript() {
  const {
    checkBackdropFilterTokens,
    checkBoxShadowTokens,
    checkContent,
    checkDuplicateCssDeclarationBlocks,
    checkRawCssColorTokens,
    checkRootStylesheetManifestOrder,
    checkStylesheetManifest,
    checkUnusedCssClassSelectors,
    checkUnusedCssCustomProperties,
    collectCheckedFiles,
    cssClassSelectors,
    cssClassSelectorsByName,
    cssClassUsageContent,
    cssDeclarationSignature,
    cssCustomPropertyDefinitions,
    cssCustomPropertyUsages,
    cssRuleDeclarationBlocks,
    hasGitTreeBarrelImport,
    hasInlinePoliteStatusViewLiteral,
    hasReactImport,
    hasRendererRuntimeImport,
    isCssStateClassSelector,
    isRendererSourceFile,
    isGroupedStylesheetManifest,
    isSrcLibFile,
    isThemeTokenStylesheet,
    isViewModelFile,
    maxLineLength,
    resolveStylesheetImport,
    rootStylesheetManifestFiles,
    runHygieneCheck,
    stylesheetManifestImports,
    usesCssClass,
  } = require(path.join(projectRoot, "scripts/check-source-hygiene.cjs"));
  const longLine = "x".repeat(maxLineLength + 1);

  assert.equal(isSrcLibFile("src/lib/commitListView.ts"), true);
  assert.equal(isSrcLibFile("src/components/RecentCommits.tsx"), false);
  assert.equal(isRendererSourceFile("src/components/RecentCommits.tsx"), true);
  assert.equal(isRendererSourceFile("electron/main.cjs"), false);
  assert.equal(isRendererSourceFile("scripts/dev.cjs"), false);
  assert.equal(isThemeTokenStylesheet("src/styles/theme.css"), true);
  assert.equal(isThemeTokenStylesheet("src/styles/theme-presets-dark.css"), false);
  assert.equal(isThemeTokenStylesheet("src/styles/base.css"), false);
  assert.equal(isCssStateClassSelector("is-open"), true);
  assert.equal(isCssStateClassSelector("has-conflicts"), true);
  assert.equal(isCssStateClassSelector("ui-button"), false);
  assert.equal(isGroupedStylesheetManifest("src/styles/foundation-imports.css"), true);
  assert.equal(isGroupedStylesheetManifest("src/styles/foundation.css"), false);
  assert.equal(isGroupedStylesheetManifest("src/styles.css"), false);
  assert.equal(isViewModelFile("src/lib/commitListView.ts"), true);
  assert.equal(isViewModelFile("src/lib/useDismissableLayer.ts"), false);
  assert.equal(isViewModelFile("src/components/RecentCommits.tsx"), false);
  assert.equal(hasInlinePoliteStatusViewLiteral('role: "status" as const,'), true);
  assert.equal(hasInlinePoliteStatusViewLiteral('ariaLive: "polite" as const,'), true);
  assert.equal(hasInlinePoliteStatusViewLiteral('role="status" aria-live="polite"'), false);
  assert.equal(hasReactImport('import type { CSSProperties } from "react";'), true);
  assert.equal(hasReactImport('import { useEffect } from "react";'), true);
  assert.equal(hasReactImport('import { Search } from "lucide-react";'), false);
  assert.equal(hasRendererRuntimeImport('import { ipcRenderer } from "electron";'), true);
  assert.equal(hasRendererRuntimeImport('import path from "node:path";'), true);
  assert.equal(hasRendererRuntimeImport('const fs = require("fs");'), true);
  assert.equal(hasRendererRuntimeImport('import { Search } from "lucide-react";'), false);
  assert.equal(hasGitTreeBarrelImport('import { GitTreeCell } from "../git-tree";'), true);
  assert.equal(hasGitTreeBarrelImport('import { GitTreeCell } from "../git-tree/GitTreeCell";'), false);
  assert.equal(hasGitTreeBarrelImport('import { getGitTreeRailWidth } from "../git-tree/renderGraph";'), false);

  assert.deepEqual(checkContent("sample.ts", "const ok = true;\n"), []);
  assert.deepEqual(checkContent("sample.ts", "const ok = true;\r\n"), []);
  assert.deepEqual(checkContent("sample.ts", `const bad = true;  \nconst tab =\ttrue;\n${longLine}\n`), [
    "sample.ts:1: trailing whitespace",
    "sample.ts:2: tab character",
    `sample.ts:3: ${maxLineLength + 1} chars`,
  ]);
  assert.deepEqual(checkContent("src/lib/example.ts", 'const empty = { role: "status", ariaLive: "polite" };\n'), [
    "src/lib/example.ts:1: use politeStatusView for polite status live-region props",
  ]);
  assert.deepEqual(checkContent("src/lib/statusView.ts", 'const status = { role: "status", ariaLive: "polite" };\n'), []);
  assert.deepEqual(checkContent("src/git-tree/exampleView.ts", 'import type { CSSProperties } from "react";\n'), [
    "src/git-tree/exampleView.ts:1: keep view-model files free of React imports",
  ]);
  assert.deepEqual(checkContent("src/components/Example.tsx", 'import { useEffect } from "react";\n'), []);
  assert.deepEqual(checkContent("src/components/Example.tsx", 'import { ipcRenderer } from "electron";\n'), [
    "src/components/Example.tsx:1: keep renderer source free of Node/Electron runtime imports",
  ]);
  assert.deepEqual(checkContent("src/components/Example.tsx", 'import { GitTreeCell } from "../git-tree";\n'), [
    "src/components/Example.tsx:1: import git-tree modules directly instead of the barrel",
  ]);
  assert.deepEqual(checkContent("electron/preload.cjs", 'const { ipcRenderer } = require("electron");\n'), []);
  assert.deepEqual(checkBackdropFilterTokens("src/components/Example.tsx", "backdrop-filter: blur(1px);\n"), []);
  assert.deepEqual(checkBackdropFilterTokens("src/styles/example.css", "backdrop-filter: none;\n"), []);
  assert.deepEqual(checkBackdropFilterTokens("src/styles/example.css", "backdrop-filter: var(--panel-backdrop-filter);\n"), []);
  assert.deepEqual(checkBackdropFilterTokens("src/styles/example.css", "-webkit-backdrop-filter: var(--panel-backdrop-filter);\n"), []);
  assert.deepEqual(checkBackdropFilterTokens("src/styles/example.css", "backdrop-filter: blur(24px) saturate(1.18);\n"), [
    "src/styles/example.css:1: use a backdrop-filter custom property or none",
  ]);
  assert.deepEqual(checkBoxShadowTokens("src/components/Example.tsx", "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n"), []);
  assert.deepEqual(checkBoxShadowTokens("src/styles/theme.css", "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n"), []);
  assert.deepEqual(checkBoxShadowTokens("src/styles/example.css", "box-shadow: var(--popover-shadow);\n"), []);
  assert.deepEqual(checkBoxShadowTokens("src/styles/example.css", "box-shadow: 0 0 0 2px var(--focus-soft);\n"), []);
  assert.deepEqual(checkBoxShadowTokens("src/styles/example.css", "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n"), [
    "src/styles/example.css:1: move rgba box-shadow values into theme custom properties",
  ]);
  assert.deepEqual(checkRawCssColorTokens("src/components/Example.tsx", "color: #fff;\n"), []);
  assert.deepEqual(checkRawCssColorTokens("src/styles/theme.css", "--surface: rgba(255, 255, 255, 0.72);\n"), []);
  assert.deepEqual(
    checkRawCssColorTokens(
      "src/styles/example.css",
      "color: var(--text);\nbackground: color-mix(in srgb, var(--panel) 80%, transparent);\n",
    ),
    [],
  );
  assert.deepEqual(checkRawCssColorTokens("src/styles/example.css", "/* color: #fff; */\n.foo { color: rgb(1, 2, 3); }\n"), [
    "src/styles/example.css:2: move raw color values into theme custom properties",
  ]);
  assert.deepEqual(checkRawCssColorTokens("src/styles/example.css", ".foo { color: #fff; }\n"), [
    "src/styles/example.css:1: move raw color values into theme custom properties",
  ]);
  assert.deepEqual(checkRawCssColorTokens("src/styles/example.css", ".foo { color: hsl(0 0% 100%); }\n"), [
    "src/styles/example.css:1: move raw color values into theme custom properties",
  ]);
  assert.deepEqual(cssCustomPropertyDefinitions("src/styles/example.css", ":root {\n  --unused-token: red;\n}\n"), [
    { name: "--unused-token", relativeFilePath: "src/styles/example.css", lineNumber: 2 },
  ]);
  assert.deepEqual(cssCustomPropertyDefinitions("src/components/Example.tsx", 'const style = "--unused-token";\n'), []);
  assert.deepEqual([...cssCustomPropertyUsages("color: var(--used-token);\ncolor: var( --spaced-token, red);\n")], [
    "--used-token",
    "--spaced-token",
  ]);
  assert.deepEqual(
    checkUnusedCssCustomProperties([
      {
        relativeFilePath: "src/styles/example.css",
        content: ":root {\n  --used-token: red;\n  --unused-token: blue;\n}\n.foo { color: var(--used-token); }\n",
      },
      {
        relativeFilePath: "src/components/Example.tsx",
        content: 'const fallback = "var(--external-token)";\n',
      },
    ]),
    ["src/styles/example.css:3: remove unused CSS custom property --unused-token"],
  );
  assert.deepEqual(
    cssClassSelectors("src/styles/example.css", ".used-class,\n.is-active,\n.has-state .also-used {\n  color: var(--text);\n}\n"),
    [
      { name: "used-class", relativeFilePath: "src/styles/example.css", lineNumber: 1 },
      { name: "also-used", relativeFilePath: "src/styles/example.css", lineNumber: 3 },
    ],
  );
  assert.deepEqual(cssClassSelectors("src/components/Example.tsx", ".unused-class { color: red; }\n"), []);
  assert.deepEqual(
    cssClassUsageContent([
      { relativeFilePath: "src/components/Example.tsx", content: 'const className = "used-class";\n' },
      { relativeFilePath: "src/styles/example.css", content: ".ignored-css-only {}\n" },
      { relativeFilePath: "README.md", content: "ignored-doc-class\n" },
    ]),
    'const className = "used-class";\n',
  );
  assert.equal(usesCssClass('const className = "used-class";', "used-class"), true);
  assert.equal(usesCssClass('const className = "unused-classic";', "unused-class"), false);
  assert.deepEqual(
    [...cssClassSelectorsByName([
      { relativeFilePath: "src/styles/a.css", content: ".used-class {}\n" },
      { relativeFilePath: "src/styles/b.css", content: ".used-class {}\n" },
    ]).keys()],
    ["used-class"],
  );
  assert.deepEqual(
    checkUnusedCssClassSelectors([
      { relativeFilePath: "src/styles/example.css", content: ".used-class {}\n.unused-class {}\n.is-open {}\n" },
      { relativeFilePath: "src/components/Example.tsx", content: 'const className = "used-class";\n' },
    ]),
    ["src/styles/example.css:2: remove unused CSS class selector .unused-class"],
  );
  assert.equal(
    cssDeclarationSignature("gap: 1px;\n  display: grid;\n  min-width: 0;\n"),
    "display: grid;gap: 1px;min-width: 0",
  );
  assert.deepEqual(
    cssRuleDeclarationBlocks(
      "src/styles/example.css",
      ".one {\n  display: grid;\n  gap: 1px;\n  min-width: 0;\n}\n.two {\n  display: grid;\n  gap: 1px;\n}\n",
    ),
    [
      {
        declarationCount: 3,
        lineNumber: 1,
        relativeFilePath: "src/styles/example.css",
        selector: ".one",
        signature: "display: grid;gap: 1px;min-width: 0",
      },
    ],
  );
  assert.equal(
    cssRuleDeclarationBlocks(
      "src/styles/example.css",
      "/* shared pattern\n   kept here */\n.one {\n  display: grid;\n  gap: 1px;\n  min-width: 0;\n}\n",
    )[0].lineNumber,
    3,
  );
  assert.deepEqual(
    checkDuplicateCssDeclarationBlocks([
      {
        relativeFilePath: "src/styles/a.css",
        content: ".one {\n  display: grid;\n  gap: 1px;\n  min-width: 0;\n}\n",
      },
      {
        relativeFilePath: "src/styles/b.css",
        content: ".two {\n  min-width: 0;\n  display: grid;\n  gap: 1px;\n}\n.small {\n  display: grid;\n  gap: 1px;\n}\n",
      },
    ]),
    [
      "src/styles/b.css:1: duplicate CSS declaration block (3 declarations) also used by src/styles/a.css:1 .one",
    ],
  );
  assert.deepEqual(stylesheetManifestImports('@import "./styles/base.css";\n@import "./styles/theme.css";\n'), [
    { lineNumber: 1, relativeFilePath: "src/styles/base.css" },
    { lineNumber: 2, relativeFilePath: "src/styles/theme.css" },
  ]);
  assert.deepEqual(
    checkRootStylesheetManifestOrder(
      rootStylesheetManifestFiles.map((relativeFilePath, index) => ({ lineNumber: index + 1, relativeFilePath })),
    ),
    [],
  );
  assert.deepEqual(
    checkRootStylesheetManifestOrder([
      { lineNumber: 1, relativeFilePath: "src/styles/ui-imports.css" },
      { lineNumber: 2, relativeFilePath: "src/styles/foundation-imports.css" },
    ]),
    [
      "src/styles.css:1: keep root stylesheet imports ordered as " +
        rootStylesheetManifestFiles.join(", "),
    ],
  );
  assert.deepEqual(
    checkRootStylesheetManifestOrder([{ lineNumber: 1, relativeFilePath: "src/styles/base.css" }]),
    [],
  );
  assert.equal(resolveStylesheetImport("src/styles.css", "./styles/base.css"), "src/styles/base.css");
  assert.equal(resolveStylesheetImport("src/styles/foundation.css", "./base.css"), "src/styles/base.css");
  assert.equal(resolveStylesheetImport("src/styles/foundation.css", "../styles.css"), "");
  assert.deepEqual(stylesheetManifestImports('@import "./base.css";\n', "src/styles/foundation.css"), [
    { lineNumber: 1, relativeFilePath: "src/styles/base.css" },
  ]);
  const rootStylesheetManifestContent =
    rootStylesheetManifestFiles.map((relativeFilePath) => `@import "./styles/${path.basename(relativeFilePath)}";`).join("\n") +
    "\n";
  const groupedManifestFixtureFiles = rootStylesheetManifestFiles.map((relativeFilePath) => ({
    relativeFilePath,
    content: relativeFilePath === "src/styles/foundation-imports.css" ? '@import "./base.css";\n@import "./theme.css";\n' : "",
  }));
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: rootStylesheetManifestContent },
      ...groupedManifestFixtureFiles,
      { relativeFilePath: "src/styles/base.css", content: ".base {}\n" },
      { relativeFilePath: "src/styles/theme.css", content: ".theme {}\n" },
    ]),
    [],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: '@import "./styles/foundation.css";\n' },
      { relativeFilePath: "src/styles/foundation.css", content: '@import "./base.css";\n' },
      { relativeFilePath: "src/styles/base.css", content: ".base {}\n" },
    ]),
    [
      "src/styles.css:1: import grouped stylesheet manifest src/styles/foundation.css",
      "src/styles/foundation.css:1: name stylesheet manifest with -imports.css suffix",
    ],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: rootStylesheetManifestContent },
      ...rootStylesheetManifestFiles.map((relativeFilePath) => ({
        relativeFilePath,
        content: relativeFilePath === "src/styles/foundation-imports.css" ? '@import "./base.css";\n' : "",
      })),
      { relativeFilePath: "src/styles/base.css", content: '@import "./theme.css";\n' },
      { relativeFilePath: "src/styles/theme.css", content: ".theme {}\n" },
    ]),
    ["src/styles/base.css:1: name stylesheet manifest with -imports.css suffix"],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: '@import "./styles/base.css";\n' },
      { relativeFilePath: "src/styles/base.css", content: ".base {}\n" },
    ]),
    ["src/styles.css:1: import grouped stylesheet manifest src/styles/base.css"],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: '@import "./styles/base.css";\n@import "./styles/missing.css";\n' },
      { relativeFilePath: "src/styles/base.css", content: ".base {}\n" },
      { relativeFilePath: "src/styles/theme.css", content: ".theme {}\n" },
    ]),
    [
      "src/styles.css:1: import grouped stylesheet manifest src/styles/base.css",
      "src/styles.css:2: import existing stylesheet src/styles/missing.css",
      "src/styles.css:1: import stylesheet src/styles/theme.css",
    ],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: '@import "./styles/base.css";\n@import "./styles/base.css";\n' },
      { relativeFilePath: "src/styles/base.css", content: ".base {}\n" },
    ]),
    [
      "src/styles.css:1: import grouped stylesheet manifest src/styles/base.css",
      "src/styles.css:2: remove duplicate stylesheet import src/styles/base.css",
    ],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: rootStylesheetManifestContent },
      ...rootStylesheetManifestFiles.map((relativeFilePath) => ({
        relativeFilePath,
        content: relativeFilePath === "src/styles/foundation-imports.css" ? '@import "./a-imports.css";\n' : "",
      })),
      { relativeFilePath: "src/styles/a-imports.css", content: '@import "./b-imports.css";\n' },
      { relativeFilePath: "src/styles/b-imports.css", content: '@import "./a-imports.css";\n' },
    ]),
    ["src/styles/b-imports.css:1: remove cyclic stylesheet import src/styles/a-imports.css"],
  );
  assert.deepEqual(
    checkStylesheetManifest([
      { relativeFilePath: "src/styles.css", content: `${rootStylesheetManifestContent}.peek-panel {}\n` },
      ...rootStylesheetManifestFiles.map((relativeFilePath) => ({
        relativeFilePath,
        content: relativeFilePath === "src/styles/foundation-imports.css" ? ".base {}\n" : "",
      })),
    ]),
    [
      "src/styles.css:7: keep stylesheet manifest import-only",
      "src/styles/foundation-imports.css:1: keep stylesheet manifest import-only",
    ],
  );

  const checkedFileLabels = collectCheckedFiles().map(projectRelative);
  assert.ok(checkedFileLabels.includes("electron/main.cjs"));
  assert.ok(checkedFileLabels.includes("scripts/check-source-hygiene.cjs"));
  assert.ok(checkedFileLabels.includes("DESIGN.md"));
  assert.deepEqual(checkedFileLabels, [...checkedFileLabels].sort((left, right) => left.localeCompare(right)));

  const currentResult = runHygieneCheck();
  assert.ok(currentResult.checkedFiles.length >= checkedFileLabels.length);
  assert.deepEqual(currentResult.failures, []);
}

function testSourceHelperUnitCoverage() {
  const { collectMatchingFiles, relativePath } = require(path.join(projectRoot, "scripts/lib/file-checks.cjs"));
  const helperCoverageExclusions = new Set();
  const coveredModules = new Set(
    [...fs.readFileSync(__filename, "utf8").matchAll(/loadTsModule\(\s*server,\s*"([^"]+)"/g)].map((match) => match[1]),
  );
  const sourceHelperFiles = collectMatchingFiles({
    projectRoot,
    roots: ["src/lib", "src/git-tree"],
    extensions: new Set([".ts", ".tsx"]),
  })
    .map((filePath) => relativePath(projectRoot, filePath))
    .filter((filePath) => !helperCoverageExclusions.has(filePath));

  assert.deepEqual(
    sourceHelperFiles.filter((filePath) => !coveredModules.has(filePath)),
    [],
  );
}

function testNodeSyntaxScript() {
  const {
    checkNodeFileSyntax,
    collectNodeFiles,
    runNodeSyntaxCheck,
  } = require(path.join(projectRoot, "scripts/check-node-syntax.cjs"));

  const nodeFileLabels = collectNodeFiles().map(projectRelative);
  assert.ok(nodeFileLabels.includes("electron/main.cjs"));
  assert.ok(nodeFileLabels.includes("scripts/check-node-syntax.cjs"));
  assert.ok(nodeFileLabels.includes("tools/stylelint/gocus-design.cjs"));
  assert.deepEqual(nodeFileLabels, [...nodeFileLabels].sort((left, right) => left.localeCompare(right)));
  assert.equal(checkNodeFileSyntax(path.join(projectRoot, "scripts/check-node-syntax.cjs")), null);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-node-syntax-"));
  const invalidFile = path.join(tempDir, "invalid.cjs");
  fs.writeFileSync(invalidFile, "function broken( {\n", "utf8");

  try {
    const failure = checkNodeFileSyntax(invalidFile);
    assert.ok(failure);
    assert.equal(failure.filePath, invalidFile);
    assert.equal(failure.status, 1);
    assert.match(failure.stderr, /SyntaxError/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const currentResult = runNodeSyntaxCheck();
  assert.ok(currentResult.checkedFiles.length >= nodeFileLabels.length);
  assert.deepEqual(currentResult.failures, []);
}

function testShellSyntaxScript() {
  const {
    checkShellFileSyntax,
    collectShellFiles,
    isBashAvailable,
    runShellSyntaxCheck,
  } = require(path.join(projectRoot, "scripts/check-shell-syntax.cjs"));

  const shellFileLabels = collectShellFiles().map(projectRelative);
  const bashAvailable = isBashAvailable();
  assert.ok(shellFileLabels.includes("scripts/package-macos.sh"));
  assert.deepEqual(shellFileLabels, [...shellFileLabels].sort((left, right) => left.localeCompare(right)));
  assert.equal(checkShellFileSyntax(path.join(projectRoot, "scripts/package-macos.sh")), null);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-shell-syntax-"));
  const invalidFile = path.join(tempDir, "invalid.sh");
  fs.writeFileSync(invalidFile, "if true; then\n  echo bad\n", "utf8");

  try {
    const failure = checkShellFileSyntax(invalidFile);
    if (bashAvailable) {
      assert.ok(failure);
      assert.equal(failure.filePath, invalidFile);
      assert.equal(failure.status, 2);
      assert.match(failure.stderr, /syntax error|unexpected end of file/i);
    } else {
      assert.equal(failure, null);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const currentResult = runShellSyntaxCheck();
  assert.ok(currentResult.checkedFiles.length >= shellFileLabels.length);
  assert.deepEqual(currentResult.failures, []);
  assert.equal(currentResult.skipped, !bashAvailable);
}

function testCommitMessageScript() {
  const {
    commitSubject,
    isConventionalCommitSubject,
    validateCommitMessage,
  } = require(path.join(projectRoot, "scripts/check-commit-messages.cjs"));

  assert.equal(commitSubject("fix: handle Windows tray labels\n\nBody"), "fix: handle Windows tray labels");
  assert.equal(isConventionalCommitSubject("feat: add release validation"), true);
  assert.equal(isConventionalCommitSubject("fix(windows): animate collapsed window"), true);
  assert.equal(isConventionalCommitSubject("feat!: change update metadata"), true);
  assert.equal(isConventionalCommitSubject("Add Windows installer auto updates"), false);
  assert.deepEqual(validateCommitMessage("docs: update release notes\n\nDetails"), {
    subject: "docs: update release notes",
    valid: true,
  });
  assert.deepEqual(validateCommitMessage("Update release notes"), {
    subject: "Update release notes",
    valid: false,
  });
}

function testWindowGeometryModule() {
  const {
    clampCommitInfoWindowHeight,
    clampCollapsedRailHeight,
    changedFileInfoBounds,
    changedFileInfoWindowSize,
    collapsedSize,
    expandedMinimumSize,
    clampExpandedSize,
    mainWindowBounds,
    rightAlignedWindowBounds,
    commitInfoBounds,
    commitInfoWindowSize,
    temporaryInfoBounds,
    windowBoundsEqual,
    expandedMaximumSize,
  } = require(path.join(projectRoot, "electron/lib/windowGeometry.cjs"));
  const display = { x: 0, y: 24, width: 1440, height: 876 };

  assert.deepEqual(collapsedSize, { width: 38, height: 136 });
  assert.deepEqual(changedFileInfoWindowSize, { width: 280, height: 252 });
  assert.deepEqual(commitInfoWindowSize, { width: 348, height: 132 });
  assert.deepEqual(expandedMinimumSize, { width: 320, height: 620 });
  assert.deepEqual(expandedMaximumSize(display), { width: 1420, height: 860 });
  assert.deepEqual(expandedMaximumSize({ x: 0, y: 0, width: 280, height: 500 }), { width: 320, height: 620 });
  assert.equal(clampCollapsedRailHeight(96, display), 136);
  assert.equal(clampCollapsedRailHeight(355, display), 355);
  assert.equal(clampCollapsedRailHeight(9999, display), 420);
  assert.equal(clampCollapsedRailHeight("bad", display), 136);
  assert.equal(clampCommitInfoWindowHeight(72, display), 92);
  assert.equal(clampCommitInfoWindowHeight(104, display), 104);
  assert.equal(clampCommitInfoWindowHeight(9999, display), 240);
  assert.equal(clampCommitInfoWindowHeight("bad", display), 132);
  assert.deepEqual(clampExpandedSize({ width: 1, height: 9999 }, display), { width: 320, height: 860 });
  assert.deepEqual(
    mainWindowBounds({
      currentBounds: { x: 20, y: 40, width: 500, height: 700 },
      display,
      collapsed: false,
      expandedSize: { width: 360, height: 700 },
    }),
    { x: 1070, y: 40, width: 360, height: 700 },
  );
  assert.deepEqual(
    mainWindowBounds({
      currentBounds: null,
      display,
      collapsed: true,
      expandedSize: { width: 360, height: 700 },
    }),
    { x: 1402, y: 394, width: 38, height: 136 },
  );
  assert.deepEqual(
    mainWindowBounds({
      currentBounds: null,
      display,
      collapsed: true,
      collapsedWindowSize: { width: 38, height: 355 },
      expandedSize: { width: 360, height: 700 },
    }),
    { x: 1402, y: 284, width: 38, height: 355 },
  );
  assert.deepEqual(
    rightAlignedWindowBounds({ x: 1402, y: 394, width: 54, height: 136 }, display),
    { x: 1386, y: 394, width: 54, height: 136 },
  );
  assert.deepEqual(
    temporaryInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
    }),
    { x: 780, y: 640, width: 280, height: 252 },
  );
  assert.deepEqual(
    temporaryInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      alignTop: true,
    }),
    { x: 780, y: 200, width: 280, height: 252 },
  );
  assert.deepEqual(
    changedFileInfoBounds({
      temporaryInfoBounds: { x: 780, y: 640, width: 280, height: 252 },
      display,
    }),
    { x: 490, y: 640, width: 280, height: 252 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
    }),
    { x: 712, y: 200, width: 348, height: 132 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      size: { width: 348, height: 104 },
    }),
    { x: 712, y: 200, width: 348, height: 104 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      avoidBounds: { x: 780, y: 640, width: 280, height: 252 },
    }),
    { x: 712, y: 200, width: 348, height: 132 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      anchorBounds: { top: 148, height: 96 },
    }),
    { x: 712, y: 348, width: 348, height: 132 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      anchorBounds: { top: 430, height: 96 },
      avoidBounds: { x: 780, y: 640, width: 280, height: 252 },
    }),
    { x: 712, y: 630, width: 348, height: 132 },
  );
  assert.deepEqual(
    commitInfoBounds({
      mainBounds: { x: 1070, y: 200, width: 360, height: 700 },
      display,
      anchorBounds: { top: 800, height: 96 },
    }),
    { x: 712, y: 1000, width: 348, height: 132 },
  );
  assert.equal(windowBoundsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 }), true);
  assert.equal(windowBoundsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 3, width: 3, height: 4 }), false);
  assert.equal(windowBoundsEqual(null, { x: 1, y: 2, width: 3, height: 4 }), false);
}

function testWindowAnimationModule() {
  const {
    easeOutCubic,
    interpolatedWindowBounds,
    windowBoundsAnimationFrameCount,
  } = require(path.join(projectRoot, "electron/lib/windowAnimation.cjs"));
  const fromBounds = { x: 1000, y: 80, width: 320, height: 780 };
  const toBounds = { x: 1402, y: 394, width: 38, height: 136 };

  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.deepEqual(interpolatedWindowBounds(fromBounds, toBounds, 0), fromBounds);
  assert.deepEqual(interpolatedWindowBounds(fromBounds, toBounds, 1), toBounds);
  assert.deepEqual(interpolatedWindowBounds(fromBounds, toBounds, 0.5), { x: 1352, y: 355, width: 73, height: 217 });
  assert.equal(windowBoundsAnimationFrameCount(180, 16), 12);
  assert.equal(windowBoundsAnimationFrameCount(1, 16), 1);
}

function testIpcHandlersModule() {
  const { preferencesSaveSideEffects } = require(path.join(projectRoot, "electron/lib/ipcHandlers.cjs"));
  const preferences = {
    launchAtLogin: false,
    showMenuBarIcon: true,
    showDockIcon: true,
    autoUpdateChannel: "stable",
    autoUpdateChecks: true,
    autoUpdateInstall: false,
  };

  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: false,
      syncDockIcon: false,
      syncAutoUpdates: false,
      checkAutoUpdatesNow: false,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, launchAtLogin: true }),
    {
      syncLaunchAtLogin: true,
      syncMenuBarIcon: false,
      syncDockIcon: false,
      syncAutoUpdates: false,
      checkAutoUpdatesNow: false,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, showMenuBarIcon: false }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: true,
      syncDockIcon: true,
      syncAutoUpdates: false,
      checkAutoUpdatesNow: false,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, showDockIcon: false }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: false,
      syncDockIcon: true,
      syncAutoUpdates: false,
      checkAutoUpdatesNow: false,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, autoUpdateChecks: false }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: false,
      syncDockIcon: false,
      syncAutoUpdates: true,
      checkAutoUpdatesNow: false,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, autoUpdateChannel: "develop" }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: false,
      syncDockIcon: false,
      syncAutoUpdates: true,
      checkAutoUpdatesNow: true,
    },
  );
  assert.deepEqual(
    preferencesSaveSideEffects(preferences, preferences, { ...preferences, autoUpdateInstall: true }),
    {
      syncLaunchAtLogin: false,
      syncMenuBarIcon: false,
      syncDockIcon: false,
      syncAutoUpdates: true,
      checkAutoUpdatesNow: false,
    },
  );
}

function testConfigStoreModule() {
  const {
    createConfigStore,
    defaultActiveWorkspaceOpenTarget,
    sanitizeActiveWorkspaceOpenTarget,
  } = require(path.join(projectRoot, "electron/lib/config.cjs"));
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-config-"));
  const app = {
    getPath(name) {
      assert.equal(name, "userData");
      return userDataDir;
    },
  };

  try {
    const config = createConfigStore(app);
    assert.equal(defaultActiveWorkspaceOpenTarget, "vscode");
    assert.equal(sanitizeActiveWorkspaceOpenTarget("finder"), "finder");
    assert.equal(sanitizeActiveWorkspaceOpenTarget("unknown"), "vscode");
    assert.equal(sanitizeActiveWorkspaceOpenTarget("unknown", "terminal"), "terminal");
    assert.equal(config.readActiveWorkspaceOpenTarget(), "vscode");
    assert.equal(config.readPreferences().autoUpdateChannel, "stable");
    assert.equal(config.readPreferences().autoUpdateChecks, true);
    assert.equal(config.readPreferences().autoUpdateInstall, false);
    assert.equal(config.readPreferences().showDockIcon, false);

    config.saveActiveWorkspaceOpenTarget("finder");
    assert.equal(config.readActiveWorkspaceOpenTarget(), "finder");
    assert.equal(createConfigStore(app).readActiveWorkspaceOpenTarget(), "finder");
    assert.equal(JSON.parse(fs.readFileSync(path.join(userDataDir, "config.json"), "utf8")).activeWorkspaceOpenTarget, "finder");

    config.saveActiveWorkspaceOpenTarget("unknown");
    assert.equal(config.readActiveWorkspaceOpenTarget(), "finder");
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function testAutoUpdateModule() {
  const { EventEmitter } = require("node:events");
  const updateEnvNames = [
    "GOCUS_UPDATE_REPO",
    "GOCUS_UPDATE_STABLE_REPO",
    "GOCUS_UPDATE_DEVELOP_REPO",
    "GOCUS_UPDATE_CHANNEL",
    "GOCUS_UPDATE_CHANNELS",
  ];
  const previousUpdateEnv = Object.fromEntries(updateEnvNames.map((name) => [name, process.env[name]]));
  for (const name of updateEnvNames) delete process.env[name];

  try {
    const {
      autoUpdateSupportReason,
      buildUpdateFeedConfig,
      buildUpdateFeedUrl,
      buildWindowsUpdateFeedConfig,
      createAutoUpdateController,
      defaultChannelSwitchVersion,
      normalizeUpdateChannel,
      normalizeUpdateRepository,
      updateChannelFromPackage,
      updateChannelsFromPackage,
      releaseUrlForRepository,
      updateRepositoryFromPackage,
      updateRepositoryForChannel,
    } = require(path.join(projectRoot, "electron/lib/autoUpdate.cjs"));

    assert.equal(normalizeUpdateRepository("jarvisluk/gocus"), "jarvisluk/gocus");
    assert.equal(normalizeUpdateRepository("https://github.com/jarvisluk/gocus.git"), "jarvisluk/gocus");
    assert.equal(normalizeUpdateRepository("git@github.com:jarvisluk/gocus.git"), "jarvisluk/gocus");
    assert.equal(normalizeUpdateRepository("https://example.com/jarvisluk/gocus"), "");
    assert.equal(normalizeUpdateChannel("develop"), "develop");
    assert.equal(normalizeUpdateChannel("nightly"), "stable");
    assert.equal(defaultChannelSwitchVersion, "0.0.0");
    assert.equal(updateChannelFromPackage({ updateChannel: "develop" }), "develop");
    assert.equal(
      updateRepositoryFromPackage({ repository: { url: "git+https://github.com/jarvisluk/gocus.git" } }),
      "jarvisluk/gocus",
    );
    assert.deepEqual(
      updateChannelsFromPackage({
        updateRepository: "jarvisluk/gocus",
        updateChannels: { develop: "jarvisluk/gocus-develop" },
      }),
      {
        stable: "jarvisluk/gocus",
        develop: "jarvisluk/gocus-develop",
      },
    );
    assert.equal(
      updateRepositoryForChannel(
        {
          updateRepository: "jarvisluk/gocus",
          updateChannels: { develop: "jarvisluk/gocus-develop" },
        },
        "develop",
      ),
      "jarvisluk/gocus-develop",
    );
    process.env.GOCUS_UPDATE_CHANNELS = JSON.stringify({ develop: "jarvisluk/gocus-dev-env" });
    assert.equal(updateRepositoryForChannel({}, "develop"), "jarvisluk/gocus-dev-env");
    delete process.env.GOCUS_UPDATE_CHANNELS;
    process.env.GOCUS_UPDATE_DEVELOP_REPO = "jarvisluk/gocus-develop-env";
    assert.equal(updateRepositoryForChannel({}, "develop"), "jarvisluk/gocus-develop-env");
    delete process.env.GOCUS_UPDATE_DEVELOP_REPO;
    assert.equal(
      buildUpdateFeedUrl({
        repository: "jarvisluk/gocus",
        platform: "darwin",
        arch: "arm64",
        version: "0.2.0",
      }),
      "https://update.electronjs.org/jarvisluk/gocus/darwin-arm64/0.2.0",
    );
    assert.deepEqual(
      buildUpdateFeedConfig({
        repository: "jarvisluk/gocus",
        platform: "darwin",
        arch: "arm64",
        version: "0.2.0",
      }),
      {
        url: "https://update.electronjs.org/jarvisluk/gocus/darwin-arm64/0.2.0",
      },
    );
    assert.deepEqual(buildWindowsUpdateFeedConfig({ repository: "https://github.com/jarvisluk/gocus.git" }), {
      provider: "github",
      owner: "jarvisluk",
      repo: "gocus",
    });
    assert.deepEqual(
      buildUpdateFeedConfig({
        repository: "jarvisluk/gocus",
        platform: "win32",
        arch: "x64",
        version: "0.2.0",
      }),
      {
        provider: "github",
        owner: "jarvisluk",
        repo: "gocus",
      },
    );
    assert.equal(releaseUrlForRepository("jarvisluk/gocus"), "https://github.com/jarvisluk/gocus/releases");
    assert.equal(releaseUrlForRepository("https://github.com/jarvisluk/gocus.git"), "https://github.com/jarvisluk/gocus/releases");
    assert.equal(releaseUrlForRepository("https://example.com/jarvisluk/gocus"), "");
    assert.equal(
      autoUpdateSupportReason({
        platform: "darwin",
        isPackaged: true,
        isDevRuntime: false,
        repository: "jarvisluk/gocus",
      }),
      "",
    );
    assert.equal(
      autoUpdateSupportReason({
        platform: "linux",
        isPackaged: true,
        isDevRuntime: false,
        repository: "jarvisluk/gocus",
      }),
      "unsupported_platform",
    );
    assert.equal(
      autoUpdateSupportReason({
        platform: "win32",
        isPackaged: true,
        isDevRuntime: false,
        repository: "jarvisluk/gocus",
      }),
      "",
    );
    assert.equal(
      autoUpdateSupportReason({
        platform: "win32",
        isPackaged: true,
        isDevRuntime: false,
        isPortableRuntime: true,
        repository: "jarvisluk/gocus",
      }),
      "portable",
    );
    assert.equal(
      autoUpdateSupportReason({
        platform: "win32",
        isPackaged: true,
        isDevRuntime: false,
        repository: "jarvisluk/gocus",
        hasAutoUpdater: false,
      }),
      "missing_updater",
    );
    assert.equal(
      autoUpdateSupportReason({
        platform: "darwin",
        isPackaged: false,
        isDevRuntime: false,
        repository: "jarvisluk/gocus",
      }),
      "unpackaged",
    );

    const events = new EventEmitter();
    const dialogs = [];
    let feedOptions = null;
    let checkedForUpdates = false;
    let preparedForInstall = false;
    let installed = false;
    const controller = createAutoUpdateController({
      app: {
        isPackaged: true,
        getVersion: () => "0.2.0",
      },
      autoUpdater: {
        setFeedURL(options) {
          feedOptions = options;
        },
        on(eventName, handler) {
          events.on(eventName, handler);
        },
        checkForUpdates() {
          checkedForUpdates = true;
        },
        quitAndInstall() {
          installed = true;
        },
      },
      dialog: {
        showMessageBox(options) {
          dialogs.push(options);
          return Promise.resolve({ response: 0 });
        },
      },
      logger: {
        info() {},
        warn() {},
      },
      packageMetadata: {
        repository: "https://github.com/jarvisluk/gocus.git",
        updateChannels: { develop: "jarvisluk/gocus-develop" },
      },
      platform: "darwin",
      arch: "arm64",
      isDevRuntime: false,
      prepareForInstall() {
        preparedForInstall = true;
      },
    });

    assert.equal(controller.isSupported(), true);
    assert.equal(controller.updateChannel(), "stable");
    assert.equal(controller.updateFeedVersion(), "0.2.0");
    assert.equal(controller.updateRepository(), "jarvisluk/gocus");
    controller.setPreferences({ autoUpdateChecks: false, autoUpdateInstall: false });
    assert.equal(controller.start(), false);
    assert.equal(controller.isStarted(), false);
    controller.setPreferences({ autoUpdateChecks: true, autoUpdateInstall: false });
    assert.equal(controller.checkForUpdates({ manual: true }), true);
    assert.equal(checkedForUpdates, true);
    assert.deepEqual(feedOptions, {
      url: "https://update.electronjs.org/jarvisluk/gocus/darwin-arm64/0.2.0",
    });

    events.emit("update-not-available");
    assert.equal(dialogs.at(-1).message, "Gocus is up to date.");

    controller.checkForUpdates({ manual: true });
    events.emit("update-downloaded", {}, "Fixed spacing", "Gocus 0.2.1");
    await Promise.resolve();
    assert.equal(dialogs.at(-1).message, "Gocus 0.2.1 is ready to install.");
    assert.equal(preparedForInstall, true);
    assert.equal(installed, true);

    controller.setPreferences({ autoUpdateChannel: "develop", autoUpdateChecks: true, autoUpdateInstall: false });
    assert.equal(controller.updateChannel(), "develop");
    assert.equal(controller.updateFeedVersion(), "0.0.0");
    assert.equal(controller.updateRepository(), "jarvisluk/gocus-develop");
    checkedForUpdates = false;
    assert.equal(controller.checkForUpdates(), true);
    assert.equal(checkedForUpdates, true);
    assert.deepEqual(feedOptions, {
      url: "https://update.electronjs.org/jarvisluk/gocus-develop/darwin-arm64/0.0.0",
    });
    events.emit("update-not-available");

    const stableSwitchFeedOptions = [];
    const installedDevelopController = createAutoUpdateController({
      app: {
        isPackaged: true,
        getVersion: () => "0.2.0-dev.4",
      },
      autoUpdater: {
        setFeedURL(options) {
          stableSwitchFeedOptions.push(options);
        },
        on() {},
        checkForUpdates() {},
        quitAndInstall() {},
      },
      packageMetadata: {
        updateChannel: "develop",
        updateRepository: "jarvisluk/gocus",
        updateChannels: { develop: "jarvisluk/gocus-develop" },
      },
      platform: "darwin",
      arch: "arm64",
      isDevRuntime: false,
    });
    installedDevelopController.setPreferences({ autoUpdateChannel: "stable", autoUpdateChecks: true });
    assert.equal(installedDevelopController.updateChannel(), "stable");
    assert.equal(installedDevelopController.updateFeedVersion(), "0.0.0");
    assert.equal(installedDevelopController.checkForUpdates(), true);
    assert.deepEqual(stableSwitchFeedOptions.at(-1), {
      url: "https://update.electronjs.org/jarvisluk/gocus/darwin-arm64/0.0.0",
    });

    preparedForInstall = false;
    installed = false;
    controller.setPreferences({ autoUpdateChecks: true, autoUpdateInstall: true });
    controller.checkForUpdates({ manual: true });
    events.emit("update-downloaded", {}, "Fixed spacing", "Gocus 0.2.2");
    await Promise.resolve();
    assert.equal(dialogs.at(-1).message, "Gocus 0.2.1 is ready to install.");
    assert.equal(preparedForInstall, true);
    assert.equal(installed, true);

    const missingChannelDialogs = [];
    const missingChannelController = createAutoUpdateController({
      app: {
        isPackaged: true,
        getVersion: () => "0.2.0",
      },
      autoUpdater: {
        setFeedURL() {
          throw new Error("Missing channel feed should not be configured.");
        },
        on() {},
        checkForUpdates() {},
        quitAndInstall() {},
      },
      dialog: {
        showMessageBox(options) {
          missingChannelDialogs.push(options);
          return Promise.resolve({ response: 0 });
        },
      },
      packageMetadata: { updateRepository: "jarvisluk/gocus" },
      platform: "darwin",
      arch: "arm64",
      isDevRuntime: false,
    });
    missingChannelController.setPreferences({ autoUpdateChannel: "develop", autoUpdateChecks: true });
    assert.equal(missingChannelController.isSupported(), false);
    assert.equal(missingChannelController.supportReason(), "missing_repository");
    assert.equal(missingChannelController.checkForUpdates({ manual: true }), false);
    assert.equal(
      missingChannelDialogs.at(-1).detail,
      "The develop update channel has no GitHub Releases feed configured for this build.",
    );

    const windowsEvents = new EventEmitter();
    const windowsDialogs = [];
    const windowsFeedOptions = [];
    let windowsCheckedForUpdates = false;
    let windowsInstalled = false;
    const windowsAutoUpdater = {
      allowDowngrade: false,
      setFeedURL(options) {
        windowsFeedOptions.push(options);
      },
      on(eventName, handler) {
        windowsEvents.on(eventName, handler);
      },
      checkForUpdates() {
        windowsCheckedForUpdates = true;
        return Promise.resolve();
      },
      quitAndInstall() {
        windowsInstalled = true;
      },
    };
    const windowsController = createAutoUpdateController({
      app: {
        isPackaged: true,
        getVersion: () => "0.2.0",
      },
      autoUpdater: windowsAutoUpdater,
      dialog: {
        showMessageBox(options) {
          windowsDialogs.push(options);
          return Promise.resolve({ response: 0 });
        },
      },
      packageMetadata: {
        updateRepository: "jarvisluk/gocus",
        updateChannels: { develop: "jarvisluk/gocus-develop" },
      },
      platform: "win32",
      arch: "x64",
      isDevRuntime: false,
    });
    assert.equal(windowsController.isSupported(), true);
    assert.equal(windowsController.checkForUpdates({ manual: true }), true);
    assert.equal(windowsCheckedForUpdates, true);
    assert.deepEqual(windowsFeedOptions.at(-1), {
      provider: "github",
      owner: "jarvisluk",
      repo: "gocus",
    });
    windowsEvents.emit("update-not-available");
    assert.equal(windowsDialogs.at(-1).message, "Gocus is up to date.");
    windowsController.setPreferences({ autoUpdateChannel: "develop", autoUpdateChecks: true });
    assert.equal(windowsController.checkForUpdates(), true);
    assert.equal(windowsAutoUpdater.allowDowngrade, true);
    assert.deepEqual(windowsFeedOptions.at(-1), {
      provider: "github",
      owner: "jarvisluk",
      repo: "gocus-develop",
    });
    windowsController.setPreferences({ autoUpdateInstall: true, autoUpdateChannel: "develop" });
    windowsEvents.emit("update-downloaded", { version: "0.2.1", releaseNotes: "Fixed Windows updater" });
    assert.equal(windowsInstalled, true);

    const windowsPortableDialogs = [];
    const windowsPortableController = createAutoUpdateController({
      app: {
        isPackaged: true,
        getVersion: () => "0.2.0",
      },
      autoUpdater: {
        setFeedURL() {
          throw new Error("Windows portable builds should not configure an update feed.");
        },
        on() {},
        checkForUpdates() {},
        quitAndInstall() {},
      },
      dialog: {
        showMessageBox(options) {
          windowsPortableDialogs.push(options);
          return Promise.resolve({ response: 0 });
        },
      },
      packageMetadata: { updateRepository: "jarvisluk/gocus" },
      platform: "win32",
      arch: "x64",
      isDevRuntime: false,
      isPortableRuntime: true,
    });
    assert.equal(windowsPortableController.isSupported(), false);
    assert.equal(windowsPortableController.checkForUpdates({ manual: true }), false);
    assert.equal(
      windowsPortableDialogs.at(-1).detail,
      "Windows portable builds do not support automatic updates. " +
        "Install Gocus with the Windows Setup package to receive automatic updates.",
    );
  } finally {
    for (const [name, value] of Object.entries(previousUpdateEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

function testGitStatusModule() {
  const { applyNumstat, isConflictedStatus, parseStatus } = require(path.join(projectRoot, "electron/lib/gitStatus.cjs"));
  const status = parseStatus("## main...origin/main [ahead 2, behind 1]\n M src/App.tsx\nA  README.md\n?? notes.txt\nUU src/conflict.ts\n");

  assert.deepEqual(status.branch, {
    name: "main",
    upstream: "origin/main",
    ahead: 2,
    behind: 1,
    detached: false,
  });
  assert.deepEqual(status.counts, { modified: 2, staged: 2, untracked: 1 });
  assert.equal(status.files[0].statusLabel, "Modified");
  assert.equal(status.files[1].statusLabel, "Added");
  assert.equal(status.files[2].statusLabel, "Untracked");
  assert.equal(status.files[3].statusLabel, "Conflicted");
  assert.equal(isConflictedStatus("UU"), true);
  assert.equal(isConflictedStatus(" M"), false);

  applyNumstat(status.files, "12\t2\tsrc/App.tsx\n-\t-\tnotes.txt\n");
  assert.equal(status.files[0].additions, 12);
  assert.equal(status.files[0].deletions, 2);
  assert.equal(status.files[2].additions, 0);
  assert.equal(status.files[2].deletions, 0);
}

async function testGitModule() {
  const {
    checkout,
    checkoutArgsForRef,
    cleanupWorktree,
    defaultCommitLogLimit,
    dirtyWorkspaceMergeNotice,
    logArgsForView,
    merge,
    mergeArgs,
    mergeMessage,
    normalizeCommitLogLimit,
    readGitSnapshot,
    repositoryStateForGit,
  } = require(path.join(projectRoot, "electron/lib/git.cjs"));
  const { parseStatus } = require(path.join(projectRoot, "electron/lib/gitStatus.cjs"));

  assert.equal(normalizeCommitLogLimit(), defaultCommitLogLimit);
  assert.equal(normalizeCommitLogLimit("42"), 42);
  assert.equal(normalizeCommitLogLimit("9999"), 2000);
  assert.equal(normalizeCommitLogLimit("0"), defaultCommitLogLimit);
  assert.ok(logArgsForView({ mode: "all" }).args.includes(`--max-count=${defaultCommitLogLimit}`));
  assert.deepEqual(logArgsForView({ mode: "branch", ref: "main" }).args.slice(-1), ["main"]);
  assert.equal(mergeMessage("feature/footer-toggle", "main"), "chore: merge feature/footer-toggle into main");
  assert.equal(mergeMessage("71a6953196b80d5abc4263b476ee2c603f5e4468", "main"), "chore: merge 71a6953 into main");
  assert.deepEqual(mergeArgs("feature/footer-toggle", "main"), [
    "merge",
    "-m",
    "chore: merge feature/footer-toggle into main",
    "--no-ff",
    "feature/footer-toggle",
  ]);
  assert.deepEqual(mergeArgs("feature/footer-toggle", "main", { createMergeCommit: true }), [
    "merge",
    "-m",
    "chore: merge feature/footer-toggle into main",
    "--no-ff",
    "feature/footer-toggle",
  ]);
  assert.deepEqual(mergeArgs("feature/footer-toggle", "main", { createMergeCommit: false }), [
    "merge",
    "-m",
    "chore: merge feature/footer-toggle into main",
    "feature/footer-toggle",
  ]);

  const checkoutRemoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-checkout-remote-"));
  try {
    runGitFixture(checkoutRemoteDir, ["init", "--bare", "origin.git"]);
    const originPath = path.join(checkoutRemoteDir, "origin.git");
    const repoPath = path.join(checkoutRemoteDir, "repo");
    runGitFixture(checkoutRemoteDir, ["clone", originPath, repoPath]);
    runGitFixture(repoPath, ["config", "user.name", "Gocus Test"]);
    runGitFixture(repoPath, ["config", "user.email", "gocus@example.com"]);
    runGitFixture(repoPath, ["checkout", "-b", "main"]);
    fs.writeFileSync(path.join(repoPath, "base.txt"), "base\n", "utf8");
    runGitFixture(repoPath, ["add", "base.txt"]);
    runGitFixture(repoPath, ["commit", "-m", "base"]);
    runGitFixture(repoPath, ["push", "-u", "origin", "main"]);
    runGitFixture(repoPath, ["checkout", "-b", "develop"]);
    fs.writeFileSync(path.join(repoPath, "develop.txt"), "develop\n", "utf8");
    runGitFixture(repoPath, ["add", "develop.txt"]);
    runGitFixture(repoPath, ["commit", "-m", "develop"]);
    runGitFixture(repoPath, ["push", "-u", "origin", "develop"]);
    runGitFixture(repoPath, ["checkout", "main"]);
    runGitFixture(repoPath, ["branch", "-D", "develop"]);
    runGitFixture(repoPath, ["fetch", "origin"]);

    assert.deepEqual(await checkoutArgsForRef(repoPath, "origin/develop"), [
      "checkout",
      "--track",
      "-b",
      "develop",
      "origin/develop",
    ]);
    const snapshot = await checkout(repoPath, "origin/develop", { mode: "current" });
    assert.equal(snapshot.branch.name, "develop");
    assert.equal(runGitFixture(repoPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]), "origin/develop");
    assert.deepEqual(await checkoutArgsForRef(repoPath, "origin/main"), ["checkout", "main"]);
    assert.equal(snapshot.branches.some((branch) => branch.name === "origin" && branch.fullName.endsWith("/HEAD")), false);
  } finally {
    fs.rmSync(checkoutRemoteDir, { force: true, recursive: true });
  }

  const mergeMessageDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-merge-message-"));
  try {
    runGitFixture(mergeMessageDir, ["init"]);
    runGitFixture(mergeMessageDir, ["checkout", "-b", "main"]);
    runGitFixture(mergeMessageDir, ["config", "user.name", "Gocus Test"]);
    runGitFixture(mergeMessageDir, ["config", "user.email", "gocus@example.com"]);
    fs.writeFileSync(path.join(mergeMessageDir, "base.txt"), "base\n", "utf8");
    runGitFixture(mergeMessageDir, ["add", "base.txt"]);
    runGitFixture(mergeMessageDir, ["commit", "-m", "base"]);
    runGitFixture(mergeMessageDir, ["checkout", "-b", "feature/footer-toggle"]);
    fs.writeFileSync(path.join(mergeMessageDir, "feature.txt"), "feature\n", "utf8");
    runGitFixture(mergeMessageDir, ["add", "feature.txt"]);
    runGitFixture(mergeMessageDir, ["commit", "-m", "feature"]);
    runGitFixture(mergeMessageDir, ["checkout", "main"]);
    fs.writeFileSync(path.join(mergeMessageDir, "main.txt"), "main\n", "utf8");
    runGitFixture(mergeMessageDir, ["add", "main.txt"]);
    runGitFixture(mergeMessageDir, ["commit", "-m", "main"]);
    runGitFixture(mergeMessageDir, mergeArgs("feature/footer-toggle", "main"));

    assert.equal(runGitFixture(mergeMessageDir, ["log", "-1", "--pretty=%s"]), "chore: merge feature/footer-toggle into main");
  } finally {
    fs.rmSync(mergeMessageDir, { force: true, recursive: true });
  }

  const dirtyMergeDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-dirty-merge-"));
  try {
    runGitFixture(dirtyMergeDir, ["init"]);
    runGitFixture(dirtyMergeDir, ["checkout", "-b", "main"]);
    runGitFixture(dirtyMergeDir, ["config", "user.name", "Gocus Test"]);
    runGitFixture(dirtyMergeDir, ["config", "user.email", "gocus@example.com"]);
    fs.writeFileSync(path.join(dirtyMergeDir, "base.txt"), "base\n", "utf8");
    runGitFixture(dirtyMergeDir, ["add", "base.txt"]);
    runGitFixture(dirtyMergeDir, ["commit", "-m", "base"]);
    runGitFixture(dirtyMergeDir, ["checkout", "-b", "feature/footer-toggle"]);
    fs.writeFileSync(path.join(dirtyMergeDir, "feature.txt"), "feature\n", "utf8");
    runGitFixture(dirtyMergeDir, ["add", "feature.txt"]);
    runGitFixture(dirtyMergeDir, ["commit", "-m", "feature"]);
    fs.writeFileSync(path.join(dirtyMergeDir, "local-notes.txt"), "local\n", "utf8");

    await assert.rejects(
      () => merge(dirtyMergeDir, "feature/footer-toggle", "main", { mode: "current" }),
      { message: dirtyWorkspaceMergeNotice },
    );
    assert.equal(runGitFixture(dirtyMergeDir, ["branch", "--show-current"]), "feature/footer-toggle");
    assert.notEqual(runGitFixture(dirtyMergeDir, ["rev-parse", "--verify", "MERGE_HEAD"], { allowFailure: true }).status, 0);
    assert.match(runGitFixture(dirtyMergeDir, ["status", "--porcelain=v1"]), /\?\? local-notes\.txt/);
  } finally {
    fs.rmSync(dirtyMergeDir, { force: true, recursive: true });
  }

  const cleanupDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-worktree-cleanup-"));
  const cleanupRepo = path.join(cleanupDir, "repo");
  const attachedWorktree = path.join(cleanupDir, "attached");
  const unmergedAttachedWorktree = path.join(cleanupDir, "attached-unmerged");
  const canonicalWorktree = path.join(cleanupDir, "canonical");
  const canonicalWorktreeLink = path.join(cleanupDir, "canonical-link");
  const modifiedWorktree = path.join(cleanupDir, "modified");
  const removableWorktree = path.join(cleanupDir, "removable");
  const reviewWorktree = path.join(cleanupDir, "review");
  const stagedWorktree = path.join(cleanupDir, "staged");
  const staleWorktree = path.join(cleanupDir, "stale");
  const untrackedWorktree = path.join(cleanupDir, "untracked");
  try {
    const comparableFixturePath = (value) => {
      const resolvedPath = path.resolve(value);
      const suffix = [];
      let currentPath = resolvedPath;

      while (true) {
        try {
          return path.join(fs.realpathSync(currentPath), ...suffix.reverse());
        } catch (error) {
          if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
          const parentPath = path.dirname(currentPath);
          if (parentPath === currentPath) return resolvedPath;
          suffix.push(path.basename(currentPath));
          currentPath = parentPath;
        }
      }
    };
    const worktreeByRealPath = (snapshot, worktreePath) => {
      const realWorktreePath = comparableFixturePath(worktreePath);
      return snapshot.worktrees.find((candidate) => comparableFixturePath(candidate.path) === realWorktreePath);
    };

    fs.mkdirSync(cleanupRepo);
    runGitFixture(cleanupRepo, ["init"]);
    runGitFixture(cleanupRepo, ["checkout", "-b", "main"]);
    runGitFixture(cleanupRepo, ["config", "user.name", "Gocus Test"]);
    runGitFixture(cleanupRepo, ["config", "user.email", "gocus@example.com"]);
    fs.writeFileSync(path.join(cleanupRepo, "base.txt"), "base\n", "utf8");
    runGitFixture(cleanupRepo, ["add", "base.txt"]);
    runGitFixture(cleanupRepo, ["commit", "-m", "base"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "-b", "feature/attached-cleanup", attachedWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "-b", "feature/unmerged-attached-cleanup", unmergedAttachedWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", canonicalWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", modifiedWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", removableWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", reviewWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", stagedWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", staleWorktree, "HEAD"]);
    runGitFixture(cleanupRepo, ["worktree", "add", "--detach", untrackedWorktree, "HEAD"]);
    fs.symlinkSync(canonicalWorktree, canonicalWorktreeLink, "dir");
    fs.writeFileSync(path.join(unmergedAttachedWorktree, "unmerged.txt"), "unmerged\n", "utf8");
    runGitFixture(unmergedAttachedWorktree, ["add", "unmerged.txt"]);
    runGitFixture(unmergedAttachedWorktree, ["commit", "-m", "unmerged attached"]);
    fs.appendFileSync(path.join(modifiedWorktree, "base.txt"), "modified\n", "utf8");
    fs.writeFileSync(path.join(reviewWorktree, "review.txt"), "review\n", "utf8");
    runGitFixture(reviewWorktree, ["add", "review.txt"]);
    runGitFixture(reviewWorktree, ["commit", "-m", "review"]);
    fs.writeFileSync(path.join(stagedWorktree, "staged.txt"), "staged\n", "utf8");
    runGitFixture(stagedWorktree, ["add", "staged.txt"]);
    fs.rmSync(staleWorktree, { force: true, recursive: true });
    fs.writeFileSync(path.join(untrackedWorktree, "untracked.txt"), "untracked\n", "utf8");

    const cleanupSnapshot = await readGitSnapshot(cleanupRepo, { mode: "all" });
    const attached = worktreeByRealPath(cleanupSnapshot, attachedWorktree);
    const unmergedAttached = worktreeByRealPath(cleanupSnapshot, unmergedAttachedWorktree);
    const modified = worktreeByRealPath(cleanupSnapshot, modifiedWorktree);
    const removable = worktreeByRealPath(cleanupSnapshot, removableWorktree);
    const review = worktreeByRealPath(cleanupSnapshot, reviewWorktree);
    const staged = worktreeByRealPath(cleanupSnapshot, stagedWorktree);
    const untracked = worktreeByRealPath(cleanupSnapshot, untrackedWorktree);
    const stale = worktreeByRealPath(cleanupSnapshot, staleWorktree);
    assert.equal(worktreeByRealPath(cleanupSnapshot, cleanupRepo).cleanup.status, "current");
    assert.equal(attached.cleanup.status, "merged");
    assert.equal(attached.cleanup.safeToRemove, true);
    assert.equal(attached.cleanup.baseBranch, "main");
    assert.equal(attached.cleanup.reason, "Merged into main.");
    assert.deepEqual(attached.cleanup.containedBranches, ["feature/attached-cleanup"]);
    assert.equal(unmergedAttached.cleanup.status, "branch-preserved");
    assert.equal(unmergedAttached.cleanup.safeToRemove, true);
    assert.deepEqual(unmergedAttached.cleanup.containedBranches, ["feature/unmerged-attached-cleanup"]);
    assert.equal(modified.cleanup.status, "dirty");
    assert.equal(removable.cleanup.status, "merged");
    assert.equal(removable.cleanup.safeToRemove, true);
    assert.equal(review.cleanup.status, "review");
    assert.equal(review.cleanup.safeToRemove, false);
    assert.equal(staged.cleanup.status, "dirty");
    assert.equal(stale.cleanup.status, "prunable");
    assert.equal(untracked.cleanup.status, "dirty");

    const linkedSnapshot = await readGitSnapshot(canonicalWorktreeLink, { mode: "all" });
    const canonical = worktreeByRealPath(linkedSnapshot, canonicalWorktree);
    assert.equal(canonical.current, true);
    assert.equal(canonical.cleanup.status, "current");

    await assert.rejects(
      () => cleanupWorktree(cleanupRepo, cleanupRepo, { mode: "all" }),
      /Open another worktree/,
    );
    await assert.rejects(
      () => cleanupWorktree(cleanupRepo, modifiedWorktree, { mode: "all" }),
      /Commit, stash/,
    );
    await assert.rejects(
      () => cleanupWorktree(cleanupRepo, stagedWorktree, { mode: "all" }),
      /Commit, stash/,
    );
    await assert.rejects(
      () => cleanupWorktree(cleanupRepo, untrackedWorktree, { mode: "all" }),
      /Commit, stash/,
    );

    await cleanupWorktree(cleanupRepo, attachedWorktree, { mode: "all" });
    assert.equal(fs.existsSync(attachedWorktree), false);
    assert.equal(
      runGitFixture(cleanupRepo, ["show-ref", "--verify", "--quiet", "refs/heads/feature/attached-cleanup"], { allowFailure: true })
        .status,
      0,
    );
    await cleanupWorktree(cleanupRepo, canonicalWorktreeLink, { mode: "all" });
    assert.equal(fs.existsSync(canonicalWorktree), false);
    await cleanupWorktree(cleanupRepo, removableWorktree, { mode: "all" });
    assert.equal(fs.existsSync(removableWorktree), false);
    await assert.rejects(
      () => cleanupWorktree(cleanupRepo, reviewWorktree, { mode: "all" }),
      /unique patch content/,
    );
    assert.equal(fs.existsSync(reviewWorktree), true);
    const prunedSnapshot = await cleanupWorktree(cleanupRepo, staleWorktree, { mode: "all" });
    assert.equal(prunedSnapshot.worktrees.some((candidate) => path.resolve(candidate.path) === staleWorktree), false);
  } finally {
    fs.rmSync(cleanupDir, { force: true, recursive: true });
  }

  const developCleanupDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-worktree-cleanup-develop-"));
  const developCleanupRepo = path.join(developCleanupDir, "repo");
  const developDetachedWorktree = path.join(developCleanupDir, "detached");
  try {
    fs.mkdirSync(developCleanupRepo);
    runGitFixture(developCleanupRepo, ["init"]);
    runGitFixture(developCleanupRepo, ["checkout", "-b", "develop"]);
    runGitFixture(developCleanupRepo, ["config", "user.name", "Gocus Test"]);
    runGitFixture(developCleanupRepo, ["config", "user.email", "gocus@example.com"]);
    fs.writeFileSync(path.join(developCleanupRepo, "base.txt"), "base\n", "utf8");
    runGitFixture(developCleanupRepo, ["add", "base.txt"]);
    runGitFixture(developCleanupRepo, ["commit", "-m", "base"]);
    runGitFixture(developCleanupRepo, ["worktree", "add", "--detach", developDetachedWorktree, "HEAD"]);

    const developCleanupSnapshot = await readGitSnapshot(developCleanupRepo, { mode: "all" });
    const realDevelopDetachedWorktree = fs.realpathSync(developDetachedWorktree);
    const developDetached = developCleanupSnapshot.worktrees.find(
      (candidate) => fs.realpathSync(candidate.path) === realDevelopDetachedWorktree,
    );
    assert.equal(developDetached.cleanup.status, "merged");
    assert.equal(developDetached.cleanup.baseBranch, "develop");

    await cleanupWorktree(developCleanupRepo, developDetachedWorktree, { mode: "all" });
    assert.equal(fs.existsSync(developDetachedWorktree), false);
  } finally {
    fs.rmSync(developCleanupDir, { force: true, recursive: true });
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-merge-state-"));
  try {
    runGitFixture(tempDir, ["init"]);
    runGitFixture(tempDir, ["checkout", "-b", "main"]);
    runGitFixture(tempDir, ["config", "user.name", "Gocus Test"]);
    runGitFixture(tempDir, ["config", "user.email", "gocus@example.com"]);
    fs.writeFileSync(path.join(tempDir, "file.txt"), "base\n", "utf8");
    runGitFixture(tempDir, ["add", "file.txt"]);
    runGitFixture(tempDir, ["commit", "-m", "base"]);
    runGitFixture(tempDir, ["checkout", "-b", "feature"]);
    fs.writeFileSync(path.join(tempDir, "file.txt"), "feature\n", "utf8");
    runGitFixture(tempDir, ["commit", "-am", "feature"]);
    runGitFixture(tempDir, ["checkout", "main"]);
    fs.writeFileSync(path.join(tempDir, "file.txt"), "main\n", "utf8");
    runGitFixture(tempDir, ["commit", "-am", "main"]);

    const mergeResult = runGitFixture(tempDir, ["merge", "feature"], { allowFailure: true });
    assert.notEqual(mergeResult.status, 0);

    const shortStatus = runGitFixture(tempDir, ["status", "--porcelain=v1", "-b"]);
    const repositoryState = await repositoryStateForGit(tempDir, parseStatus(shortStatus));
    assert.deepEqual(repositoryState, {
      operation: "merge",
      operationLabel: "Merge",
      hasConflicts: true,
      conflictedFiles: ["file.txt"],
    });
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

function testGitGraphModule() {
  const {
    buildCommitGraph,
    branchKindFromRefs,
    commitMessageMaxLength,
    normalizeCommitMessage,
    parseLog,
  } = require(path.join(projectRoot, "electron/lib/gitGraph.cjs"));
  const { graphContextForWorktrees } = require(path.join(projectRoot, "electron/lib/git.cjs"));
  const firstHash = "a".repeat(40);
  const secondHash = "b".repeat(40);
  const longCommitMessage = "x".repeat(commitMessageMaxLength + 20);

  assert.equal(normalizeCommitMessage("", "Fallback"), "Fallback");
  assert.equal(normalizeCommitMessage(longCommitMessage, "").length, commitMessageMaxLength);
  assert.ok(normalizeCommitMessage(longCommitMessage, "").endsWith("..."));
  assert.equal(branchKindFromRefs("feat/search-scroll-stash-graph", 0), "feature");
  assert.equal(branchKindFromRefs("refs/stash", 0), "stash");
  const rawLog = [
    "\x1e",
    [
      firstHash,
      "aaaaaaa",
      secondHash,
      "Codex",
      "2 minutes ago",
      "2026-06-10T02:26:00+08:00",
      "Add graph split",
      "HEAD -> main",
      "Body",
    ].join("\x1f"),
    "\x1d\n",
    "8\t1\tsrc/App.tsx\n",
    "\x1e",
    [
      secondHash,
      "bbbbbbb",
      "",
      "Codex",
      "3 minutes ago",
      "2026-06-10T02:20:00+08:00",
      "Base commit",
      "feature/base",
      "Base body",
    ].join("\x1f"),
    "\x1d\n",
    "1\t0\tREADME.md\n",
  ].join("");
  const commits = parseLog(rawLog, {
    currentHead: firstHash,
    currentBranch: "main",
    containedBranchTips: [
      { name: "main", hash: firstHash },
      { name: "feature/base", hash: secondHash },
    ],
  });

  assert.equal(commits.length, 2);
  assert.equal(commits[0].fullHash, firstHash);
  assert.equal(commits[0].authoredAt, "2026-06-10T02:26:00+08:00");
  assert.deepEqual(commits[0].refs, ["main"]);
  assert.deepEqual(commits[0].containedBranches, ["main"]);
  assert.deepEqual(commits[1].containedBranches, ["main", "feature/base"]);
  assert.equal(commits[0].additions, 8);
  assert.equal(commits[0].deletions, 1);
  assert.equal(commits[0].graph.currentLabel, "main");
  assert.equal(commits[0].graph.currentVariant, "solid");
  assert.equal(commits[0].graph.incomingVariant, "solid");
  assert.equal(commits[0].graph.isCurrentHead, true);

  const commitsWithMergedLocalRefs = parseLog(rawLog, {
    currentHead: firstHash,
    currentBranch: "main",
    mergedLocalBranches: ["main", "feature/base"],
    containedBranchTips: [
      { name: "main", hash: firstHash },
      { name: "feature/base", hash: secondHash },
    ],
  });
  assert.deepEqual(commitsWithMergedLocalRefs[0].refs, ["main"]);
  assert.deepEqual(commitsWithMergedLocalRefs[0].mergedRefs, []);
  assert.deepEqual(commitsWithMergedLocalRefs[1].refs, []);
  assert.deepEqual(commitsWithMergedLocalRefs[1].mergedRefs, ["feature/base"]);

  const propagatedGraph = buildCommitGraph([
    {
      ...commit({ fullHash: firstHash, parents: [secondHash], refs: ["main"] }),
      branchColor: "#111111",
      refColors: ["#111111"],
    },
    {
      ...commit({ fullHash: secondHash, hash: "bbbbbbb", parents: [], refs: [], refColors: [] }),
      branchColor: "#222222",
      refColors: [],
    },
  ]);
  assert.equal(propagatedGraph[1].refs.length, 0);
  assert.equal(propagatedGraph[1].graph.currentLabel, "main");
  assert.equal(propagatedGraph[1].graph.currentColor, "#111111");
  const externalHeadHash = "e".repeat(40);
  const currentHeadHash = "c".repeat(40);
  const currentParentHash = "d".repeat(40);
  const sharedMainHash = "f".repeat(40);
  const sharedRootHash = "0".repeat(40);
  const sharedMainGraph = buildCommitGraph(
    [
      {
        ...commit({ fullHash: externalHeadHash, hash: "eeeeeee", parents: [sharedMainHash], refs: ["feat/external-worktree"] }),
        branchColor: "#333333",
        refColors: ["#333333"],
      },
      {
        ...commit({ fullHash: currentHeadHash, hash: "ccccccc", parents: [currentParentHash], refs: ["refactor/current-worktree"] }),
        branchColor: "#111111",
        refColors: ["#111111"],
      },
      {
        ...commit({ fullHash: currentParentHash, hash: "ddddddd", parents: [sharedMainHash], refs: [], refColors: [] }),
        branchColor: "#111111",
        refColors: [],
      },
      {
        ...commit({ fullHash: sharedMainHash, hash: "fffffff", parents: [sharedRootHash], refs: ["main"] }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
      {
        ...commit({ fullHash: sharedRootHash, hash: "0000000", parents: [], refs: [], refColors: [] }),
        branchColor: "#f0a400",
        refColors: [],
      },
    ],
    {
      currentHead: currentHeadHash,
      currentBranch: "refactor/current-worktree",
      localBranches: ["refactor/current-worktree"],
      externalHeads: [externalHeadHash],
      externalBranches: ["feat/external-worktree"],
    },
  );
  const sharedMainGraphByHash = new Map(sharedMainGraph.map((item) => [item.fullHash, item]));
  assert.equal(sharedMainGraphByHash.get(externalHeadHash).graph.currentVariant, "dashed");
  assert.equal(sharedMainGraphByHash.get(currentHeadHash).graph.currentVariant, "solid");
  assert.equal(sharedMainGraphByHash.get(currentHeadHash).graph.isCurrentHead, true);
  assert.equal(sharedMainGraphByHash.get(externalHeadHash).graph.isCurrentHead, false);
  assert.equal(sharedMainGraphByHash.get(currentParentHash).graph.currentVariant, "solid");
  assert.equal(sharedMainGraphByHash.get(sharedMainHash).graph.currentVariant, "solid");
  assert.equal(sharedMainGraphByHash.get(sharedMainHash).graph.currentColor, "#f0a400");
  assert.equal(sharedMainGraphByHash.get(sharedMainHash).graph.incomingColor, "#111111");
  assert.equal(sharedMainGraphByHash.get(sharedMainHash).graph.incomingVariant, "solid");
  assert.equal(sharedMainGraphByHash.get(sharedRootHash).graph.currentVariant, "solid");

  const externalChildHash = "7".repeat(40);
  const localParentHash = "8".repeat(40);
  const sourceStyledParentEdge = buildCommitGraph(
    [
      {
        ...commit({ fullHash: externalChildHash, hash: "7777777", parents: [localParentHash], refs: ["feature/external"] }),
        branchColor: "#333333",
        refColors: ["#333333"],
      },
      {
        ...commit({ fullHash: localParentHash, hash: "8888888", parents: [], refs: ["main"] }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
    ],
    {
      currentBranch: "main",
      localBranches: ["main"],
      externalHeads: [externalChildHash],
      externalBranches: ["feature/external"],
    },
  );
  assert.equal(sourceStyledParentEdge[0].graph.currentColor, "#333333");
  assert.equal(sourceStyledParentEdge[0].graph.currentVariant, "dashed");
  assert.deepEqual(sourceStyledParentEdge[0].graph.parentStems, [
    { column: 0, color: "#333333", variant: "dashed" },
  ]);
  assert.equal(sourceStyledParentEdge[1].graph.currentColor, "#f0a400");
  assert.equal(sourceStyledParentEdge[1].graph.currentVariant, "solid");
  assert.equal(sourceStyledParentEdge[1].graph.incomingColor, "#333333");
  assert.equal(sourceStyledParentEdge[1].graph.incomingVariant, "dashed");

  const branchReturnMergeTipHash = "9".repeat(40);
  const branchReturnFirstParentHash = "a".repeat(40);
  const branchReturnParentHash = "b".repeat(40);
  const branchReturnGraph = buildCommitGraph([
    {
      ...commit({
        fullHash: branchReturnMergeTipHash,
        hash: "9999999",
        parents: [branchReturnFirstParentHash, branchReturnParentHash],
        refs: ["main"],
      }),
      branchColor: "#f0a400",
      refColors: ["#f0a400"],
    },
    {
      ...commit({ fullHash: branchReturnFirstParentHash, hash: "aaaaaaa", parents: [], refs: [], refColors: [] }),
      branchColor: "#f0a400",
      refColors: [],
    },
    {
      ...commit({ fullHash: branchReturnParentHash, hash: "bbbbbbb", parents: [], refs: ["refactor/codebase"] }),
      branchColor: "#48ad62",
      refColors: ["#48ad62"],
    },
  ]);
  assert.deepEqual(branchReturnGraph[0].graph.bridges, [
    { fromColumn: 0, toColumn: 1, color: "#48ad62", variant: "solid" },
  ]);
  assert.equal(branchReturnGraph[2].graph.currentColor, "#48ad62");
  assert.equal(branchReturnGraph[2].graph.incomingColor, "#48ad62");

  const mainTipHash = "2".repeat(40);
  const mainMiddleHash = "3".repeat(40);
  const topicPointerHash = "4".repeat(40);
  const mainThroughTopicPointerGraph = buildCommitGraph([
    {
      ...commit({ fullHash: mainTipHash, hash: "2222222", parents: [mainMiddleHash], refs: ["main"] }),
      branchColor: "#f0a400",
      refColors: ["#f0a400"],
    },
    {
      ...commit({ fullHash: mainMiddleHash, hash: "3333333", parents: [topicPointerHash], refs: [], refColors: [] }),
      branchColor: "#f0a400",
      refColors: [],
    },
    {
      ...commit({ fullHash: topicPointerHash, hash: "4444444", parents: [], refs: ["fiery-comet-drifts-21h04"] }),
      branchColor: "#48ad62",
      refColors: ["#48ad62"],
    },
  ]);
  const topicPointerGraph = mainThroughTopicPointerGraph.find((item) => item.fullHash === topicPointerHash).graph;
  assert.equal(topicPointerGraph.currentColor, "#f0a400");
  assert.equal(topicPointerGraph.currentLabel, "main");

  const mergeTipHash = "7".repeat(40);
  const mainFirstParentHash = "8".repeat(40);
  const topicTipHash = "9".repeat(40);
  const sharedAncestorHash = "0a".repeat(20);
  const mainFirstParentGraph = buildCommitGraph([
    {
      ...commit({ fullHash: mergeTipHash, hash: "7777777", parents: [mainFirstParentHash, topicTipHash], refs: ["main"] }),
      branchColor: "#f0a400",
      refColors: ["#f0a400"],
    },
    {
      ...commit({ fullHash: topicTipHash, hash: "9999999", parents: [sharedAncestorHash], refs: ["refactor/codebase"] }),
      branchColor: "#2f86d8",
      refColors: ["#2f86d8"],
    },
    {
      ...commit({ fullHash: mainFirstParentHash, hash: "8888888", parents: [sharedAncestorHash], refs: [], refColors: [] }),
      branchColor: "#f0a400",
      refColors: [],
    },
    {
      ...commit({ fullHash: sharedAncestorHash, hash: "0a0a0a0", parents: [], refs: ["fiery-comet-drifts-21h04"] }),
      branchColor: "#48ad62",
      refColors: ["#48ad62"],
    },
  ]);
  const sharedAncestorGraph = mainFirstParentGraph.find((item) => item.fullHash === sharedAncestorHash).graph;
  assert.equal(sharedAncestorGraph.currentColor, "#f0a400");
  assert.equal(sharedAncestorGraph.currentLabel, "main");
  assert.deepEqual(mainFirstParentGraph[2].graph.bridges, []);
  assert.ok(sharedAncestorGraph.bridges.some((bridge) => bridge.fromColumn === 1 && bridge.toColumn === 0 && bridge.color === "#2f86d8"));

  const featureTipHash = "5".repeat(40);
  const mainBaseHash = "6".repeat(40);
  const featureJoiningMainGraph = buildCommitGraph([
    {
      ...commit({ fullHash: featureTipHash, hash: "5555555", parents: [mainBaseHash], refs: ["feature/preview"] }),
      branchColor: "#48ad62",
      refColors: ["#48ad62"],
    },
    {
      ...commit({ fullHash: mainBaseHash, hash: "6666666", parents: [], refs: ["main"] }),
      branchColor: "#f0a400",
      refColors: ["#f0a400"],
    },
  ]);
  assert.equal(featureJoiningMainGraph[1].graph.currentColor, "#f0a400");
  assert.equal(featureJoiningMainGraph[1].graph.currentLabel, "main");

  const stashNamedFeatureTipHash = "5f".repeat(20);
  const stashNamedFeatureParentHash = "6f".repeat(20);
  const stashNamedFeatureGraph = parseLog(
    [
      "\x1e",
      [
        stashNamedFeatureTipHash,
        "5f5f5f5",
        stashNamedFeatureParentHash,
        "Codex",
        "2 minutes ago",
        "2026-06-11T19:27:43+08:00",
        "Keep selected commit visible after search clears",
        "feat/search-scroll-stash-graph",
        "Keep selected commit visible after search clears",
      ].join("\x1f"),
      "\x1d\n",
      "\x1e",
      [
        stashNamedFeatureParentHash,
        "6f6f6f6",
        "",
        "Codex",
        "3 minutes ago",
        "2026-06-11T19:24:43+08:00",
        "Render stash as auxiliary graph node",
        "main",
        "Render stash as auxiliary graph node",
      ].join("\x1f"),
      "\x1d\n",
    ].join(""),
  );
  assert.equal(stashNamedFeatureGraph[0].lane, "feature");
  assert.deepEqual(stashNamedFeatureGraph[0].parents, [stashNamedFeatureParentHash]);
  assert.deepEqual(stashNamedFeatureGraph[0].graph.parentStems, [
    { column: 0, color: "#2f86d8", variant: "solid" },
  ]);

  const localOnlyHeadHash = "1".repeat(40);
  const graphWithDetachedExternalInsideLocalBranch = buildCommitGraph(
    [
      {
        ...commit({ fullHash: localOnlyHeadHash, hash: "1111111", parents: [externalHeadHash], refs: ["feat/local-only"] }),
        branchColor: "#25b7ba",
        refColors: ["#25b7ba"],
      },
      {
        ...commit({ fullHash: externalHeadHash, hash: "eeeeeee", parents: [sharedMainHash], refs: [], refColors: [] }),
        branchColor: "#25b7ba",
        refColors: [],
      },
      {
        ...commit({ fullHash: sharedMainHash, hash: "fffffff", parents: [], refs: ["main"] }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
    ],
    {
      currentHead: sharedMainHash,
      currentBranch: "main",
      localBranches: ["main", "feat/local-only"],
      externalHeads: [externalHeadHash],
    },
  );
  const localBranchGraphByHash = new Map(graphWithDetachedExternalInsideLocalBranch.map((item) => [item.fullHash, item]));
  assert.equal(localBranchGraphByHash.get(localOnlyHeadHash).graph.currentVariant, "solid");
  assert.equal(localBranchGraphByHash.get(externalHeadHash).graph.currentVariant, "solid");

  const contextWithExternalWorktreeBranches = graphContextForWorktrees(
    [
      {
        path: "/repo",
        branch: "refactor/current-worktree",
        head: currentHeadHash,
        current: true,
        detached: false,
        bare: false,
      },
      {
        path: "/repo-linked",
        branch: "feat/external-worktree",
        head: externalHeadHash,
        current: false,
        detached: false,
        bare: false,
      },
    ],
    { branch: { name: "refactor/current-worktree", detached: false } },
    [
      { name: "refactor/current-worktree", type: "local", current: true },
      { name: "feat/external-worktree", type: "local", current: false },
      { name: "feat/local-only", type: "local", current: false },
      { name: "origin/main", type: "remote", current: false },
      { name: "v1.0.0", type: "tag", current: false },
    ],
  );
  assert.deepEqual(contextWithExternalWorktreeBranches, {
    currentHead: currentHeadHash,
    currentBranch: "refactor/current-worktree",
    localBranches: ["refactor/current-worktree", "feat/local-only"],
    mergedLocalBranches: [],
    externalHeads: [externalHeadHash],
    externalBranches: ["feat/external-worktree"],
  });

  const mainMergeHash = "m".repeat(40);
  const externalMergeHash = "e1".repeat(20);
  const mergeFirstParentHash = "p".repeat(40);
  const mergeSecondParentHash = "s".repeat(40);
  const mergeRootHash = "r".repeat(40);
  const externalMergeGraph = buildCommitGraph(
    [
      {
        ...commit({ fullHash: mainMergeHash, hash: "mmmmmmm", parents: [mergeFirstParentHash, mergeSecondParentHash], refs: ["main"] }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
      {
        ...commit({
          fullHash: externalMergeHash,
          hash: "e1e1e1e",
          parents: [mergeFirstParentHash, mergeSecondParentHash],
          refs: ["feat/branch-switch-message"],
        }),
        branchColor: "#2f86d8",
        refColors: ["#2f86d8"],
      },
      {
        ...commit({ fullHash: mergeSecondParentHash, hash: "sssssss", parents: [mergeRootHash], refs: ["feat/commit-block"] }),
        branchColor: "#25b7ba",
        refColors: ["#25b7ba"],
      },
      {
        ...commit({ fullHash: mergeFirstParentHash, hash: "ppppppp", parents: [mergeRootHash], refs: [], refColors: [] }),
        branchColor: "#f0a400",
        refColors: [],
      },
      {
        ...commit({ fullHash: mergeRootHash, hash: "rrrrrrr", parents: [], refs: [], refColors: [] }),
        branchColor: "#f0a400",
        refColors: [],
      },
    ],
    {
      currentHead: mainMergeHash,
      currentBranch: "main",
      localBranches: ["main", "feat/commit-block"],
      externalHeads: [externalMergeHash],
      externalBranches: ["feat/branch-switch-message"],
    },
  );
  const externalMergeGraphByHash = new Map(externalMergeGraph.map((item) => [item.fullHash, item.graph]));
  assert.equal(externalMergeGraphByHash.get(externalMergeHash).currentVariant, "dashed");
  assert.deepEqual(externalMergeGraphByHash.get(externalMergeHash).parentStems, [
    { column: 2, color: "#2f86d8", variant: "dashed" },
  ]);
  assert.deepEqual(externalMergeGraphByHash.get(externalMergeHash).bridges, [
    { fromColumn: 2, toColumn: 1, color: "#25b7ba", variant: "solid", to: "lane" },
  ]);
  assert.ok(externalMergeGraphByHash.get(mergeSecondParentHash).passThrough.some((lane) => lane.column === 2 && lane.variant === "dashed"));
  assert.ok(
    externalMergeGraphByHash
      .get(mergeFirstParentHash)
      .bridges.some((bridge) => bridge.fromColumn === 2 && bridge.toColumn === 0 && bridge.variant === "dashed"),
  );

  const overlappingExternalHeadHash = "aa".repeat(20);
  const overlappingCurrentHeadHash = "bb".repeat(20);
  const overlappingMergeHash = "cc".repeat(20);
  const overlappingFirstParentHash = "dd".repeat(20);
  const overlappingSecondParentHash = "ee".repeat(20);
  const overlappingRootHash = "ff".repeat(20);
  const overlappingFirstParentGraph = buildCommitGraph(
    [
      {
        ...commit({
          fullHash: overlappingExternalHeadHash,
          hash: "aaaaaaa",
          parents: [overlappingFirstParentHash],
          refs: ["feat/external-worktree"],
        }),
        branchColor: "#2f86d8",
        refColors: ["#2f86d8"],
      },
      {
        ...commit({
          fullHash: overlappingCurrentHeadHash,
          hash: "bbbbbbb",
          parents: [overlappingMergeHash],
          refs: ["main"],
        }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
      {
        ...commit({
          fullHash: overlappingMergeHash,
          hash: "ccccccc",
          parents: [overlappingFirstParentHash, overlappingSecondParentHash],
          refs: [],
        }),
        branchColor: "#f0a400",
        refColors: [],
      },
      {
        ...commit({
          fullHash: overlappingSecondParentHash,
          hash: "eeeeeee",
          parents: [overlappingRootHash],
          refs: ["feat/topic"],
        }),
        branchColor: "#48ad62",
        refColors: ["#48ad62"],
      },
      {
        ...commit({ fullHash: overlappingFirstParentHash, hash: "ddddddd", parents: [overlappingRootHash], refs: ["origin/main"] }),
        branchColor: "#f0a400",
        refColors: ["#f0a400"],
      },
      {
        ...commit({ fullHash: overlappingRootHash, hash: "fffffff", parents: [], refs: [] }),
        branchColor: "#f0a400",
        refColors: [],
      },
    ],
    {
      currentHead: overlappingCurrentHeadHash,
      currentBranch: "main",
      localBranches: ["main", "feat/topic"],
      externalHeads: [overlappingExternalHeadHash],
      externalBranches: ["feat/external-worktree"],
    },
  );
  const overlappingFirstParentGraphByHash = new Map(overlappingFirstParentGraph.map((item) => [item.fullHash, item.graph]));
  const overlappingMergeGraph = overlappingFirstParentGraphByHash.get(overlappingMergeHash);
  assert.deepEqual(
    overlappingMergeGraph.passThrough
      .filter((lane) => lane.column === 0)
      .map(({ color, variant, from, to }) => ({ color, variant, from, to })),
    [
      { color: "#2f86d8", variant: "dashed", from: undefined, to: undefined },
    ],
  );
  assert.deepEqual(overlappingMergeGraph.parentStems, [{ column: 1, color: "#f0a400", variant: "solid" }]);
  const overlappingFirstParent = overlappingFirstParentGraphByHash.get(overlappingFirstParentHash);
  assert.equal(overlappingFirstParent.column, 1);
  assert.equal(overlappingFirstParentGraphByHash.get(overlappingFirstParentHash).incomingVariant, "solid");
  assert.equal(overlappingFirstParentGraphByHash.get(overlappingFirstParentHash).incomingColor, "#f0a400");
  assert.ok(
    overlappingFirstParent.passThrough.some((lane) => lane.column === 0 && lane.variant === "dashed" && lane.to === "node"),
  );
  assert.ok(
    overlappingFirstParent.bridges.some((bridge) => bridge.fromColumn === 0 && bridge.toColumn === 1 && bridge.variant === "dashed"),
  );

  const mergeGraph = buildCommitGraph([
    {
      ...commit({ fullHash: firstHash, parents: [secondHash, "c".repeat(40)], refs: ["main"] }),
      branchColor: "#111111",
      refColors: ["#111111"],
    },
  ]);
  assert.equal(mergeGraph[0].graph.isMerge, true);
  assert.equal(mergeGraph[0].graph.isCurrentHead, false);
  assert.equal(mergeGraph[0].graph.bridges.length, 1);

  const stashHash = "5a".repeat(20);
  const stashBaseHash = "5b".repeat(20);
  const stashIndexHash = "5c".repeat(20);
  const stashRawLog = [
    "\x1e",
    [
      stashHash,
      "5a5a5a5",
      `${stashBaseHash} ${stashIndexHash}`,
      "Codex",
      "7 minutes ago",
      "2026-06-11T19:27:43+08:00",
      "On feat/tempo-info: wip graph state",
      "refs/stash",
      "On feat/tempo-info: wip graph state",
    ].join("\x1f"),
    "\x1d\n",
    "\x1e",
    [
      stashIndexHash,
      "5c5c5c5",
      stashBaseHash,
      "Codex",
      "7 minutes ago",
      "2026-06-11T19:27:43+08:00",
      "index on feat/tempo-info: e6cc86f fix graph state",
      "",
      "index on feat/tempo-info: e6cc86f fix graph state",
    ].join("\x1f"),
    "\x1d\n",
    "\x1e",
    [
      stashBaseHash,
      "5b5b5b5",
      "",
      "Codex",
      "2 hours ago",
      "2026-06-11T17:27:43+08:00",
      "fix: tune changed row visual spacing",
      "feat/tempo-info",
      "fix: tune changed row visual spacing",
    ].join("\x1f"),
    "\x1d\n",
  ].join("");
  const stashGraph = parseLog(stashRawLog);
  assert.deepEqual(
    stashGraph.map((item) => item.fullHash),
    [stashHash, stashBaseHash],
  );
  assert.deepEqual(stashGraph[0].parents, [stashBaseHash, stashIndexHash]);
  assert.equal(stashGraph[0].graph.isMerge, false);
  assert.deepEqual(stashGraph[0].graph.parentStems, []);
  assert.deepEqual(stashGraph[0].graph.bridges, []);
  assert.equal(stashGraph[1].graph.currentLabel, "feat/tempo-info");
}

async function testBranchNames(server) {
  const {
    branchDisplayName,
    branchNameMaxLength,
    branchNameValidationMessage,
    branchNameWithPrefix,
    branchPrefixes,
  } = await loadTsModule(server, "src/lib/branchNames.ts");

  assert.deepEqual(branchPrefixes, ["none", "feat", "fix", "chore", "docs", "refactor", "test"]);
  assert.equal(branchNameMaxLength, 30);

  assert.equal(branchNameWithPrefix("none", " /ready "), "ready");
  assert.equal(branchNameWithPrefix("feat", "ready"), "feat/ready");
  assert.equal(branchNameWithPrefix("feat", "feat/ready"), "feat/ready");
  assert.equal(branchNameWithPrefix("fix", "/bug"), "fix/bug");
  assert.equal(branchDisplayName("refactor/codebase-optimization"), "refactor/codebase-optimization");
  assert.equal(branchDisplayName("abcdefghijklmnopqrstuvwxyz1234567890"), "abcdefghijklmnopqrstuvwxyz1...");

  for (const branchName of ["feature/name", "release/2026.06", "refactor/codebase-optimization", "@", "head"]) {
    assert.equal(branchNameValidationMessage(branchName), "", `${branchName} should be valid`);
  }

  assert.equal(branchNameValidationMessage(""), "Enter a branch name.");
  assert.equal(branchNameValidationMessage("feature/super-long-branch-name-v2"), "Branch names cannot exceed 30 characters.");
  assert.equal(branchNameValidationMessage("-bad"), "Branch names cannot start with a dash.");
  assert.equal(branchNameValidationMessage("HEAD"), "Branch names cannot be HEAD.");
  assert.equal(branchNameValidationMessage("feat/"), "Branch names cannot contain empty path segments.");
  assert.equal(branchNameValidationMessage("feat//ready"), "Branch names cannot contain empty path segments.");
  assert.equal(branchNameValidationMessage("bad."), "Branch names cannot end with a dot.");
  assert.equal(branchNameValidationMessage("bad..name"), "Branch names cannot contain consecutive dots.");
  assert.equal(branchNameValidationMessage("bad@{name"), "Branch names cannot contain @{.");
  assert.equal(branchNameValidationMessage("bad name"), "Branch names cannot contain spaces or ~ ^ : ? * [ \\.");
  assert.equal(branchNameValidationMessage("feature/.hidden"), "Branch path segments cannot start with a dot.");
  assert.equal(branchNameValidationMessage("feature/name.lock"), "Branch path segments cannot end with .lock.");

  for (const branchName of [
    "feature/name",
    "release/2026.06",
    "@",
    "head",
    "",
    "-bad",
    "HEAD",
    "feat/",
    "feat//ready",
    "bad.",
    "bad..name",
    "bad@{name",
    "bad name",
    "feature/.hidden",
    "feature/name.lock",
  ]) {
    assert.equal(
      branchNameValidationMessage(branchName) === "",
      gitAcceptsBranchName(branchName),
      `${branchName} should match git check-ref-format`,
    );
  }
}

async function testAppShellView(server) {
  const {
    appChangedNowCount,
    appEditorBackdropView,
    appNativeDialogBlockerView,
    appPanelContentView,
    appPanelView,
    appScrollRegionView,
    appShouldCloseSettingsOnKey,
    appShouldShowRepositoryControls,
    appShouldCloseTemporaryInfoOnPointer,
    appTemporaryInfoDismissView,
    appViewportView,
  } = await loadTsModule(server, "src/lib/appShellView.ts");

  assert.deepEqual(appViewportView({ electron: false, collapsed: false }), {
    className: "app-viewport",
  });
  assert.deepEqual(appViewportView({ electron: true, collapsed: true }), {
    className: "app-viewport is-electron is-collapsed",
  });
  assert.deepEqual(appPanelView(), {
    className: "peek-panel",
    ariaLabel: "Gocus side panel",
  });
  const snapshot = gitSnapshot();
  assert.deepEqual(appPanelContentView({ snapshot, settingsOpen: true }), {
    mode: "settings",
  });
  assert.deepEqual(appPanelContentView({ snapshot, settingsOpen: false }), {
    mode: "repository",
    snapshot,
  });
  assert.deepEqual(appPanelContentView({ snapshot: null, settingsOpen: false }), {
    mode: "empty",
  });
  const editorBackdrop = appEditorBackdropView();
  assert.deepEqual(editorBackdrop.tabs, {
    className: "editor-tabs",
    labels: ["Menu.tsx", "shortcuts.ts"],
  });
  assert.equal(editorBackdrop.className, "editor-backdrop");
  assert.equal(editorBackdrop.ariaHidden, true);
  assert.match(editorBackdrop.previewCode, /className="menu-item"/);
  assert.deepEqual(appScrollRegionView(), {
    className: "scroll-region",
  });
  assert.deepEqual(appNativeDialogBlockerView(), {
    className: "native-dialog-blocker",
    ariaHidden: true,
  });
  assert.deepEqual(appTemporaryInfoDismissView(), {
    exemptSelector: ".footer-changed-now, .rail-count",
  });
  assert.equal(appChangedNowCount(null), 0);
  assert.equal(appChangedNowCount(gitSnapshot({ changedFiles: [] })), 0);
  assert.equal(appChangedNowCount(gitSnapshot({ changedFiles: [{ path: "src/App.tsx" }, { path: "README.md" }] })), 2);
  assert.equal(appShouldShowRepositoryControls({ snapshot: null }), false);
  assert.equal(appShouldShowRepositoryControls({ snapshot }), true);
  assert.equal(appShouldCloseSettingsOnKey({ key: "Escape", settingsOpen: true }), true);
  assert.equal(appShouldCloseSettingsOnKey({ key: "Enter", settingsOpen: true }), false);
  assert.equal(appShouldCloseSettingsOnKey({ key: "Escape", settingsOpen: false }), false);

  const exemptSelector = appTemporaryInfoDismissView().exemptSelector;
  const exemptTarget = { closest: (selector) => (selector === exemptSelector ? { nodeType: 1 } : null) };
  const outsideTarget = { closest: () => null };
  assert.equal(appShouldCloseTemporaryInfoOnPointer(exemptTarget, exemptSelector), false);
  assert.equal(appShouldCloseTemporaryInfoOnPointer(outsideTarget, exemptSelector), true);
  assert.equal(appShouldCloseTemporaryInfoOnPointer({ detail: "not an element" }, exemptSelector), true);
  assert.equal(appShouldCloseTemporaryInfoOnPointer(null, exemptSelector), true);
}

async function testActionDialogView(server) {
  const {
    actionDialogAfterBranchNameChange,
    actionDialogAfterBranchPrefixChange,
    actionBranchErrorId,
    actionBranchPreviewId,
    actionBranchPrefixMenuId,
    actionBranchPrefixOptionView,
    actionBranchPrefixTriggerId,
    actionDialogBodyId,
    actionDialogBranchNameKeyAction,
    actionDialogConfirmation,
    actionDialogCopyPromptButtonView,
    actionDialogGlobalKeyAction,
    actionDialogAfterMergeError,
    actionDialogAfterMergeTargetChange,
    actionDialogTitleId,
    actionDialogView,
    actionMergeTargetErrorId,
    actionMergeTargetMenuId,
    actionMergeTargetOptionView,
    actionMergeTargetTriggerId,
    branchPrefixOptions,
    checkoutCommitActionDialog,
    checkoutRefActionDialog,
    commitActionDialog,
    createBranchActionDialog,
    mergeFailureAgentPrompt,
    mergeCommitActionDialog,
    mergeTargetBranchOptions,
  } = await loadTsModule(server, "src/lib/actionDialogView.ts");

  assert.deepEqual(
    branchPrefixOptions.map((option) => option.label),
    ["None", "feat", "fix", "chore", "docs", "refactor", "test"],
  );
  assert.equal(actionDialogTitleId, "action-dialog-title");
  assert.equal(actionDialogBodyId, "action-dialog-body");
  assert.equal(actionBranchPreviewId, "action-branch-preview");
  assert.equal(actionBranchPrefixMenuId, "action-branch-prefix-menu");
  assert.equal(actionBranchPrefixTriggerId, "action-branch-prefix-trigger");
  assert.equal(actionMergeTargetErrorId, "action-merge-target-error");
  assert.equal(actionMergeTargetMenuId, "action-merge-target-menu");
  assert.equal(actionMergeTargetTriggerId, "action-merge-target-trigger");
  assert.deepEqual(actionBranchPrefixOptionView({ value: "feat", label: "feat" }, "feat"), {
    key: "feat",
    value: "feat",
    label: "feat",
    active: true,
    className: "ui-menu-item action-prefix-menu-item is-active",
    role: "menuitem",
    ariaCurrent: "true",
  });
  assert.deepEqual(actionBranchPrefixOptionView({ value: "fix", label: "fix" }, "feat"), {
    key: "fix",
    value: "fix",
    label: "fix",
    active: false,
    className: "ui-menu-item action-prefix-menu-item",
    role: "menuitem",
    ariaCurrent: undefined,
  });
  assert.deepEqual(actionMergeTargetOptionView({ name: "main", current: true }, "main"), {
    key: "main",
    branchName: "main",
    label: "main current",
    active: true,
    className: "ui-menu-item action-merge-target-menu-item is-active",
    role: "menuitem",
    ariaCurrent: "true",
    title: "main",
  });
  assert.deepEqual(actionMergeTargetOptionView({ name: "feature/footer-toggle", current: false }, "main"), {
    key: "feature/footer-toggle",
    branchName: "feature/footer-toggle",
    label: "feature/footer-toggle",
    active: false,
    className: "ui-menu-item action-merge-target-menu-item",
    role: "menuitem",
    ariaCurrent: undefined,
    title: "feature/footer-toggle",
  });
  const actionDialogChrome = {
    backdrop: {
      className: "ui-dialog-backdrop action-dialog-backdrop",
      role: "presentation",
    },
    dialog: {
      className: "ui-dialog ui-layer-panel action-dialog",
      role: "dialog",
      ariaModal: true,
      ariaLabelledBy: actionDialogTitleId,
      ariaDescribedBy: actionDialogBodyId,
    },
    heading: {
      className: "ui-dialog-heading action-dialog-heading",
      id: actionDialogTitleId,
    },
    closeButton: {
      className: "ui-icon-button",
      ariaLabel: "Close dialog",
    },
    body: {
      className: "ui-dialog-body",
      id: actionDialogBodyId,
    },
    branchFields: {
      containerClassName: "action-branch-fields",
      fieldClassName: "action-branch-field",
      prefixLabel: "Prefix",
      prefixControlClassName: "action-prefix-control",
      prefixTriggerId: actionBranchPrefixTriggerId,
      prefixTriggerClassName: "action-prefix-trigger ui-disclosure-button",
      prefixAriaLabel: "Branch prefix",
      prefixMenuId: actionBranchPrefixMenuId,
      prefixMenuClassName: "ui-menu action-prefix-menu",
      prefixMenuRole: "menu",
      nameLabel: "Name",
      nameInputClassName: "ui-input",
      nameMaxLength: 30,
      nameAriaLabel: "Branch name",
      previewClassName: "action-branch-preview",
      previewId: actionBranchPreviewId,
      errorClassName: "action-branch-error",
    },
    mergeFields: {
      containerClassName: "action-merge-fields",
      fieldClassName: "action-branch-field",
      targetLabel: "Target",
      targetControlClassName: "action-merge-target-control",
      targetTriggerId: actionMergeTargetTriggerId,
      targetTriggerClassName: "action-merge-target-trigger ui-disclosure-button",
      targetAriaLabel: "Merge target branch",
      targetMenuId: actionMergeTargetMenuId,
      targetMenuClassName: "ui-menu action-merge-target-menu",
      targetMenuRole: "menu",
      errorClassName: "action-branch-error",
    },
  };
  const actionDialogMergeDefaults = {
    isMerge: false,
    showMergeFields: false,
    mergeTargetBranch: "",
    mergeTargetBranches: [],
    mergeTargetValidationMessage: "",
    showMergeTargetValidationMessage: false,
    mergeTargetErrorId: undefined,
    actionError: {
      containerClassName: "action-dialog-error-block",
      className: "ui-layer-panel ui-code-block action-dialog-error",
      id: "action-dialog-error",
      role: "alert",
      message: "",
    },
    showActionError: false,
    mergeFailurePrompt: "",
    showMergeFailurePrompt: false,
  };
  const actionDialogChromeWithBranchMax = (nameMaxLength) => ({
    ...actionDialogChrome,
    branchFields: {
      ...actionDialogChrome.branchFields,
      nameMaxLength,
    },
  });
  const actionDialogButtons = ({ cancelAutoFocus = false, confirmDisabled = false } = {}) => ({
    actions: {
      className: "ui-dialog-actions action-dialog-actions",
    },
    cancelButton: {
      className: "ui-button",
      label: "Cancel",
      autoFocus: cancelAutoFocus,
    },
    confirmButton: {
      className: "ui-button primary",
      label: "Confirm",
      disabled: confirmDisabled,
    },
  });
  const sampleCommit = commit({
    hash: "abc1234",
    fullHash: "abc123400000000000000000000000000000000",
  });
  const mergeTargets = [
    { name: "main", current: true },
    { name: "feature/footer-toggle", current: false },
  ];

  assert.deepEqual(
    mergeTargetBranchOptions(
      [
        { name: "feature/footer-toggle", type: "local", current: false },
        { name: "origin/main", type: "remote", current: false },
        { name: "v1.0", type: "tag", current: false },
        { name: "main", type: "local", current: true },
      ],
      "main",
    ),
    mergeTargets,
  );
  assert.deepEqual(
    mergeTargetBranchOptions(
      [
        { name: "feat/branch-swift", type: "local", current: true },
        { name: "feat/commit-block", type: "local", current: false },
        { name: "develop", type: "local", current: false },
        { name: "main", type: "local", current: false },
        { name: "master", type: "local", current: false },
        { name: "origin/main", type: "remote", current: false },
      ],
      "feat/branch-swift",
    ),
    [
      { name: "feat/branch-swift", current: true },
      { name: "main", current: false },
      { name: "develop", current: false },
      { name: "master", current: false },
      { name: "feat/commit-block", current: false },
    ],
  );

  assert.deepEqual(createBranchActionDialog(sampleCommit), {
    type: "createBranch",
    title: "Create branch",
    body: "Start a new branch from abc1234.",
    branchPrefix: "none",
    branchName: "abc1234",
    commit: {
      fullHash: "abc123400000000000000000000000000000000",
      hash: "abc1234",
    },
  });
  assert.deepEqual(commitActionDialog("branch", sampleCommit), createBranchActionDialog(sampleCommit));
  assert.deepEqual(checkoutCommitActionDialog(sampleCommit), {
    type: "checkout",
    title: "Checkout commit",
    body: "Checkout abc1234. This can detach HEAD.",
    ref: "abc123400000000000000000000000000000000",
  });
  assert.deepEqual(commitActionDialog("checkout", sampleCommit), checkoutCommitActionDialog(sampleCommit));
  assert.deepEqual(mergeCommitActionDialog(sampleCommit), {
    type: "merge",
    title: "Merge commit",
    body: "Merge abc1234 into the selected target branch. The working folder will end on that branch.",
    ref: "abc123400000000000000000000000000000000",
    targetBranch: "",
    targetBranches: [],
  });
  assert.deepEqual(mergeCommitActionDialog(sampleCommit, { targetBranches: mergeTargets }), {
    type: "merge",
    title: "Merge commit",
    body: "Merge abc1234 into the selected target branch. The working folder will end on that branch.",
    ref: "abc123400000000000000000000000000000000",
    targetBranch: "main",
    targetBranches: mergeTargets,
  });
  assert.deepEqual(
    commitActionDialog("merge", sampleCommit, { targetBranches: mergeTargets }),
    mergeCommitActionDialog(sampleCommit, { targetBranches: mergeTargets }),
  );
  const switchBranchDialog = checkoutRefActionDialog("feature/worktree-safety");
  assert.deepEqual(switchBranchDialog, {
    type: "checkout",
    title: "Switch branch",
    body: "Switch the working folder to feature/worktree-safety.",
    ref: "feature/worktree-safety",
    fallbackNotice: "Switched to feature/worktree-safety.",
    failureNotice: "Unable to switch branch.",
  });
  assert.equal(actionDialogGlobalKeyAction("Escape"), "cancel");
  assert.equal(actionDialogGlobalKeyAction("Enter"), "ignore");
  assert.equal(actionDialogBranchNameKeyAction("Enter", false), "confirm");
  assert.equal(actionDialogBranchNameKeyAction("Enter", true), "block");
  assert.equal(actionDialogBranchNameKeyAction("Escape", false), "ignore");
  assert.deepEqual(actionDialogCopyPromptButtonView("idle"), {
    className: "ui-button action-dialog-copy-prompt",
    label: "Copy agent prompt",
    title: "Copy agent prompt",
    icon: "copy",
  });
  assert.deepEqual(actionDialogCopyPromptButtonView("copied"), {
    className: "ui-button action-dialog-copy-prompt",
    label: "Copied prompt",
    title: "Copied prompt",
    icon: "check",
  });
  assert.deepEqual(actionDialogCopyPromptButtonView("failed"), {
    className: "ui-button action-dialog-copy-prompt",
    label: "Copy failed",
    title: "Copy failed",
    icon: "x",
  });
  const createBranchDialog = createBranchActionDialog(sampleCommit);
  const checkoutDialog = checkoutCommitActionDialog(sampleCommit);
  const mergeDialog = mergeCommitActionDialog(sampleCommit, { targetBranches: mergeTargets });
  assert.deepEqual(actionDialogAfterBranchNameChange(createBranchDialog, "ready"), {
    ...createBranchDialog,
    branchName: "ready",
  });
  assert.deepEqual(actionDialogAfterBranchPrefixChange(createBranchDialog, "fix"), {
    ...createBranchDialog,
    branchPrefix: "fix",
  });
  assert.equal(actionDialogAfterBranchNameChange(checkoutDialog, "ignored"), checkoutDialog);
  assert.equal(actionDialogAfterBranchPrefixChange(checkoutDialog, "feat"), checkoutDialog);
  assert.deepEqual(actionDialogAfterMergeTargetChange(mergeDialog, "feature/footer-toggle"), {
    ...mergeDialog,
    targetBranch: "feature/footer-toggle",
    error: "",
  });
  assert.deepEqual(actionDialogAfterMergeError(mergeDialog, "Merge failed."), {
    ...mergeDialog,
    error: "Merge failed.",
  });
  assert.equal(actionDialogAfterMergeTargetChange(checkoutDialog, "main"), checkoutDialog);
  assert.equal(actionDialogAfterMergeError(checkoutDialog, "Merge failed."), checkoutDialog);
  assert.equal(actionDialogAfterBranchNameChange(null, "ignored"), null);
  assert.equal(actionDialogAfterBranchPrefixChange(null, "feat"), null);
  assert.equal(actionDialogAfterMergeTargetChange(null, "main"), null);
  assert.equal(actionDialogAfterMergeError(null, "Merge failed."), null);
  const readyBranchDialog = actionDialogAfterBranchPrefixChange(actionDialogAfterBranchNameChange(createBranchDialog, "ready"), "feat");
  assert.deepEqual(actionDialogConfirmation(readyBranchDialog), {
    type: "createBranch",
    branchName: "feat/ready",
    baseHash: "abc123400000000000000000000000000000000",
    fallbackNotice: "Created feat/ready.",
    failureNotice: "Unable to create branch.",
  });
  assert.equal(actionDialogConfirmation(actionDialogAfterBranchNameChange(createBranchDialog, "bad name")), null);
  assert.equal(
    actionDialogConfirmation({
      type: "createBranch",
      title: "Create branch",
      body: "Start a branch.",
      branchPrefix: "none",
      branchName: "ready",
    }),
    null,
  );
  assert.deepEqual(actionDialogConfirmation(checkoutDialog), {
    type: "checkout",
    ref: "abc123400000000000000000000000000000000",
    fallbackNotice: "Checkout complete.",
    failureNotice: "Unable to checkout ref.",
  });
  assert.deepEqual(actionDialogConfirmation(switchBranchDialog), {
    type: "checkout",
    ref: "feature/worktree-safety",
    fallbackNotice: "Switched to feature/worktree-safety.",
    failureNotice: "Unable to switch branch.",
  });
  assert.deepEqual(actionDialogConfirmation(mergeDialog), {
    type: "merge",
    ref: "abc123400000000000000000000000000000000",
    targetBranch: "main",
    fallbackNotice: "Merged into main.",
    failureNotice: "Unable to merge ref.",
  });
  assert.deepEqual(actionDialogConfirmation(actionDialogAfterMergeTargetChange(mergeDialog, "feature/footer-toggle")), {
    type: "merge",
    ref: "abc123400000000000000000000000000000000",
    targetBranch: "feature/footer-toggle",
    fallbackNotice: "Merged into feature/footer-toggle.",
    failureNotice: "Unable to merge ref.",
  });
  assert.equal(
    actionDialogConfirmation({
      type: "checkout",
      title: "Checkout branch",
      body: "Switch branch.",
    }),
    null,
  );
  assert.equal(
    actionDialogConfirmation({
      type: "merge",
      title: "Merge commit",
      body: "Merge commit.",
      targetBranch: "",
      targetBranches: [],
    }),
    null,
  );
  assert.equal(actionDialogConfirmation(null), null);

  assert.deepEqual(
    actionDialogView({
      type: "createBranch",
      title: "Create branch",
      body: "Start a branch.",
      branchPrefix: "feat",
      branchName: " settings-panel ",
    }),
    {
      isCreateBranch: true,
      ...actionDialogChromeWithBranchMax(25),
      ...actionDialogMergeDefaults,
      showBranchFields: true,
      resolvedBranchName: "feat/settings-panel",
      showResolvedBranchName: true,
      branchValidationMessage: "",
      showBranchValidationMessage: false,
      branchErrorId: undefined,
      branchInputInvalid: false,
      branchInputAriaInvalid: undefined,
      branchInputDescribedBy: actionBranchPreviewId,
      confirmDisabled: false,
      cancelAutoFocus: false,
      ...actionDialogButtons(),
    },
  );

  assert.deepEqual(
    actionDialogView({
      type: "createBranch",
      title: "Create branch",
      body: "Start a branch.",
      branchPrefix: "fix",
      branchName: "bad name",
    }),
    {
      isCreateBranch: true,
      ...actionDialogChromeWithBranchMax(26),
      ...actionDialogMergeDefaults,
      showBranchFields: true,
      resolvedBranchName: "fix/bad name",
      showResolvedBranchName: true,
      branchValidationMessage: "Branch names cannot contain spaces or ~ ^ : ? * [ \\.",
      showBranchValidationMessage: true,
      branchErrorId: actionBranchErrorId,
      branchInputInvalid: true,
      branchInputAriaInvalid: true,
      branchInputDescribedBy: `${actionBranchPreviewId} ${actionBranchErrorId}`,
      confirmDisabled: true,
      cancelAutoFocus: false,
      ...actionDialogButtons({ confirmDisabled: true }),
    },
  );

  const emptyBranchView = actionDialogView({
    type: "createBranch",
    title: "Create branch",
    body: "Start a branch.",
    branchPrefix: "none",
    branchName: "/",
  });
  assert.equal(emptyBranchView.showResolvedBranchName, false);
  assert.equal(emptyBranchView.branchErrorId, actionBranchErrorId);
  assert.equal(emptyBranchView.branchInputDescribedBy, actionBranchErrorId);

  assert.deepEqual(
    actionDialogView({
      type: "checkout",
      title: "Checkout branch",
      body: "Switch branch.",
    }),
    {
      isCreateBranch: false,
      backdrop: actionDialogChrome.backdrop,
      dialog: actionDialogChrome.dialog,
      heading: actionDialogChrome.heading,
      closeButton: actionDialogChrome.closeButton,
      body: actionDialogChrome.body,
      branchFields: actionDialogChrome.branchFields,
      mergeFields: actionDialogChrome.mergeFields,
      ...actionDialogMergeDefaults,
      showBranchFields: false,
      resolvedBranchName: "",
      showResolvedBranchName: false,
      branchValidationMessage: "",
      showBranchValidationMessage: false,
      branchErrorId: undefined,
      branchInputInvalid: false,
      branchInputAriaInvalid: undefined,
      branchInputDescribedBy: undefined,
      confirmDisabled: false,
      cancelAutoFocus: true,
      ...actionDialogButtons({ cancelAutoFocus: true }),
    },
  );
  assert.deepEqual(
    actionDialogView({
      type: "merge",
      title: "Merge commit",
      body: "Merge commit.",
      targetBranch: "",
      targetBranches: [],
    }),
    {
      isCreateBranch: false,
      isMerge: true,
      backdrop: actionDialogChrome.backdrop,
      dialog: actionDialogChrome.dialog,
      heading: actionDialogChrome.heading,
      closeButton: actionDialogChrome.closeButton,
      body: actionDialogChrome.body,
      branchFields: actionDialogChrome.branchFields,
      mergeFields: actionDialogChrome.mergeFields,
      showBranchFields: false,
      showMergeFields: true,
      mergeTargetBranch: "",
      mergeTargetBranches: [],
      mergeTargetValidationMessage: "No local branches available.",
      showMergeTargetValidationMessage: true,
      mergeTargetErrorId: actionMergeTargetErrorId,
      actionError: actionDialogMergeDefaults.actionError,
      showActionError: false,
      mergeFailurePrompt: "",
      showMergeFailurePrompt: false,
      resolvedBranchName: "",
      showResolvedBranchName: false,
      branchValidationMessage: "",
      showBranchValidationMessage: false,
      branchErrorId: undefined,
      branchInputInvalid: false,
      branchInputAriaInvalid: undefined,
      branchInputDescribedBy: undefined,
      confirmDisabled: true,
      cancelAutoFocus: true,
      ...actionDialogButtons({ cancelAutoFocus: true, confirmDisabled: true }),
    },
  );
  const failedMergeView = actionDialogView({
    ...mergeDialog,
    error: "Auto-merging src/App.tsx\nCONFLICT (content): Merge conflict in src/App.tsx",
  });
  assert.equal(failedMergeView.dialog.ariaDescribedBy, "action-dialog-body action-dialog-error");
  assert.equal(failedMergeView.showActionError, true);
  assert.deepEqual(failedMergeView.actionError, {
    containerClassName: "action-dialog-error-block",
    className: "ui-layer-panel ui-code-block action-dialog-error",
    id: "action-dialog-error",
    role: "alert",
    message: "Auto-merging src/App.tsx\nCONFLICT (content): Merge conflict in src/App.tsx",
  });
  assert.equal(failedMergeView.showMergeFailurePrompt, true);
  assert.equal(
    failedMergeView.mergeFailurePrompt,
    mergeFailureAgentPrompt({
      error: "Auto-merging src/App.tsx\nCONFLICT (content): Merge conflict in src/App.tsx",
      ref: "abc123400000000000000000000000000000000",
      targetBranch: "main",
    }),
  );
  assert.match(failedMergeView.mergeFailurePrompt, /A Git merge failed in this repository/);
  assert.match(failedMergeView.mergeFailurePrompt, /Source ref\/commit: abc123400000000000000000000000000000000/);
  assert.match(failedMergeView.mergeFailurePrompt, /Target branch: main/);
  assert.match(failedMergeView.mergeFailurePrompt, /CONFLICT \(content\): Merge conflict in src\/App\.tsx/);
  assert.match(failedMergeView.mergeFailurePrompt, /keep unrelated worktree changes intact/);
  assert.match(failedMergeView.mergeFailurePrompt, /if git status shows uncommitted changes/);
  assert.match(failedMergeView.mergeFailurePrompt, /already represented by the source ref\/commit or the current merge result/);
  assert.match(failedMergeView.mergeFailurePrompt, /Do not stash changes that are already done/);
  assert.match(failedMergeView.mergeFailurePrompt, /check for documented commit-message rules/);
  assert.match(failedMergeView.mergeFailurePrompt, /if none are present, use Conventional Commits/);
  assert.match(failedMergeView.mergeFailurePrompt, /valid fallback subject is `chore: merge abc1234 into main`/);
  assert.match(failedMergeView.mergeFailurePrompt, /do not use Git's default `Merge branch \.\.\.` or `Merge commit \.\.\.` subject/);
  assert.doesNotMatch(failedMergeView.mergeFailurePrompt, /No-fast-forward merges are enabled/);
  const failedNoFastForwardMergeView = actionDialogView(
    {
      ...mergeDialog,
      error: "Auto-merging src/App.tsx\nCONFLICT (content): Merge conflict in src/App.tsx",
    },
    { createMergeCommit: true },
  );
  assert.equal(
    failedNoFastForwardMergeView.mergeFailurePrompt,
    mergeFailureAgentPrompt({
      createMergeCommit: true,
      error: "Auto-merging src/App.tsx\nCONFLICT (content): Merge conflict in src/App.tsx",
      ref: "abc123400000000000000000000000000000000",
      targetBranch: "main",
    }),
  );
  assert.match(failedNoFastForwardMergeView.mergeFailurePrompt, /No-fast-forward merges are enabled in Settings/);
  assert.match(failedNoFastForwardMergeView.mergeFailurePrompt, /do not complete this as a fast-forward merge/);
}

async function testCommitSearch(server) {
  const { commitMatchesSearch, commitSearchTerms, filterCommitsBySearch } = await loadTsModule(server, "src/lib/commitSearch.ts");
  const externalWorktreeCommit = commit({
    title: "External worktree head",
    message: "Commit checked out in another worktree",
    author: "June",
    refs: ["feature/external-worktree"],
    parents: ["abc1234"],
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
  });

  assert.deepEqual(commitSearchTerms("  Footer   CODEX  "), ["footer", "codex"]);
  assert.deepEqual(commitSearchTerms("   "), []);
  assert.equal(commitMatchesSearch(commit(), []), true);
  assert.equal(commitMatchesSearch(commit(), commitSearchTerms("SEARCH keyboard")), true);
  assert.equal(commitMatchesSearch(commit(), commitSearchTerms("a1b2 codex main")), true);
  assert.equal(commitMatchesSearch(commit(), commitSearchTerms("missing")), false);
  assert.equal(commitMatchesSearch(externalWorktreeCommit, commitSearchTerms("external e7f8a9b")), true);
  assert.equal(commitMatchesSearch(externalWorktreeCommit, commitSearchTerms("git-tree-vis-external abc1234")), true);
  assert.deepEqual(
    filterCommitsBySearch([commit({ id: "one" }), externalWorktreeCommit], "June external").map((item) => item.id),
    ["a1b2c3d"],
  );
}

async function testCommitListView(server) {
  const { useCommitSearch } = await loadTsModule(server, "src/lib/useCommitSearch.ts");
  const {
    commitListView,
    commitSearchClearButtonView,
    commitSearchInputKeyAction,
    commitSearchInputView,
    commitSearchStateApplication,
    commitSearchStateAfterAvailability,
    commitSearchStateAfterClose,
    commitSearchStateAfterToggle,
    commitSearchToggleView,
    commitSelectionVisible,
    firstCommitId,
    recentCommitsTitleId,
    selectedCommitFromSnapshot,
    selectedCommitIdAfterToggle,
  } = await loadTsModule(server, "src/lib/commitListView.ts");
  const {
    commitScrollTopForMeasuredCenter,
    commitScrollTopForSelection,
    commitVirtualRowOffset,
    commitVirtualTotalHeight,
    commitVirtualWindow,
    commitVirtualizationThreshold,
  } = await loadTsModule(server, "src/lib/commitListGeometry.ts");
  const commits = [
    commit({ id: "search", title: "Add commit search polish", message: "Keyboard selection", author: "Codex" }),
    commit({ id: "footer", title: "Tighten footer menu", message: "Workspace app picker", author: "June", refs: ["feature/footer"] }),
  ];

  assert.equal(typeof useCommitSearch, "function");
  assert.deepEqual(
    commitListView(commits, "").filteredCommits.map((item) => item.id),
    ["search", "footer"],
  );
  assert.equal(commitListView(commits, "").countLabel, "Showing 2");
  assert.equal(recentCommitsTitleId, "recent-commits-title");
  assert.deepEqual(commitListView(commits, "").section, {
    className: "commits-section",
    ariaLabelledBy: "recent-commits-title",
  });
  assert.deepEqual(commitListView(commits, "").heading, {
    className: "section-heading",
  });
  assert.equal(commitListView(commits, "").titleId, "recent-commits-title");
  assert.equal(commitListView(commits, "").title, "Commits");
  assert.equal(commitListView(commits, "").filteredCount, 2);
  assert.equal(commitListView(commits, "").showCommits, true);
  assert.equal(commitListView(commits, "").showEmptyState, false);
  assert.equal(commitListView(commits, "", true).searchActive, true);
  assert.equal(commitListView(commits, "", true).headingToolsClassName, "heading-tools has-search");
  assert.deepEqual(commitListView(commits, "", true).count, {
    className: "commit-count",
    role: "status",
    ariaLive: "polite",
    label: "Showing 2",
  });
  assert.equal(commitListView(commits, "", true).showSearchForm, true);
  assert.deepEqual(commitListView(commits, "", true).searchForm, {
    className: "commit-search",
    id: "commit-search-form",
    role: "search",
  });
  assert.equal(commitListView(commits, "", true).showSearchClearButton, false);
  assert.deepEqual(commitListView(commits, "", true).searchInput, {
    ariaLabel: "Search commits",
    placeholder: "Search",
  });
  assert.deepEqual(commitListView(commits, "", true).searchClearButton, {
    show: false,
    className: "commit-search-clear",
    ariaLabel: "Clear commit search",
  });
  assert.equal(commitListView(commits, "footer").countLabel, "Showing 1/2");
  assert.equal(commitListView(commits, "footer").headingToolsClassName, "heading-tools has-search");
  assert.equal(commitListView(commits, "footer").showSearchClearButton, true);
  assert.deepEqual(commitListView(commits, "footer").searchClearButton, {
    show: true,
    className: "commit-search-clear",
    ariaLabel: "Clear commit search",
  });
  assert.deepEqual(
    commitListView(commits, "footer").filteredCommits.map((item) => item.id),
    ["footer"],
  );
  assert.equal(commitListView(commits, "footer").filteredCount, 1);
  assert.equal(commitListView(commits, "missing").emptyMessage, 'No commits match "missing".');
  assert.equal(commitListView(commits, "missing").filteredCount, 0);
  assert.equal(commitListView(commits, "missing").showCommits, false);
  assert.equal(commitListView(commits, "missing").showEmptyState, true);
  assert.deepEqual(commitListView(commits, "missing").list, {
    className: "commit-list",
  });
  assert.deepEqual(commitListView(commits, "missing").emptyState, {
    className: "commit-empty-state",
    role: "status",
    ariaLive: "polite",
    message: 'No commits match "missing".',
  });
  assert.equal(commitListView([], "anything").canSearch, false);
  assert.equal(commitListView([], "anything", true).searchActive, false);
  assert.equal(commitListView([], "anything", true).headingToolsClassName, "heading-tools");
  assert.equal(commitListView([], "anything", true).showSearchForm, true);
  assert.equal(commitListView([], "anything", true).showSearchClearButton, true);
  assert.equal(commitListView([], "").filteredCount, 0);
  assert.equal(commitListView([], "").showCommits, false);
  assert.equal(commitListView([], "").showEmptyState, true);
  assert.equal(commitListView([], "").emptyMessage, "No commits yet.");
  assert.deepEqual(commitListView([], "").emptyState, {
    className: "commit-empty-state",
    role: "status",
    ariaLive: "polite",
    message: "No commits yet.",
  });
  assert.equal(commitSelectionVisible(commits, "footer"), true);
  assert.equal(commitSelectionVisible(commits, "missing"), false);
  assert.equal(commitSelectionVisible(commits, ""), false);
  assert.equal(selectedCommitIdAfterToggle("", "search"), "search");
  assert.equal(selectedCommitIdAfterToggle("footer", "search"), "search");
  assert.equal(selectedCommitIdAfterToggle("search", "search"), "");
  assert.deepEqual(selectedCommitFromSnapshot(gitSnapshot({ commits }), "footer"), commits[1]);
  assert.equal(selectedCommitFromSnapshot(gitSnapshot({ commits }), "missing"), null);
  assert.equal(selectedCommitFromSnapshot(gitSnapshot({ commits }), ""), null);
  assert.equal(selectedCommitFromSnapshot(null, "footer"), null);
  assert.equal(firstCommitId(commits), "search");
  assert.equal(firstCommitId([]), "");
  assert.deepEqual(commitSearchInputView(), {
    ariaLabel: "Search commits",
    placeholder: "Search",
  });
  assert.equal(commitSearchInputKeyAction("Enter"), "selectFirst");
  assert.equal(commitSearchInputKeyAction("Escape"), "close");
  assert.equal(commitSearchInputKeyAction("ArrowDown"), "ignore");
  assert.equal(commitSearchInputKeyAction("Esc"), "ignore");
  assert.deepEqual(commitSearchClearButtonView(""), {
    show: false,
    className: "commit-search-clear",
    ariaLabel: "Clear commit search",
  });
  assert.deepEqual(commitSearchClearButtonView("needle"), {
    show: true,
    className: "commit-search-clear",
    ariaLabel: "Clear commit search",
  });
  assert.deepEqual(commitSearchStateAfterClose({ searchOpen: true, searchQuery: "footer" }), {
    searchOpen: false,
    searchQuery: "",
    changed: true,
    restoreToggleFocus: false,
  });
  assert.deepEqual(commitSearchStateAfterClose({ searchOpen: false, searchQuery: "" }, { restoreFocus: true }), {
    searchOpen: false,
    searchQuery: "",
    changed: false,
    restoreToggleFocus: true,
  });
  assert.deepEqual(commitSearchStateApplication(commitSearchStateAfterClose({ searchOpen: true, searchQuery: "footer" })), {
    searchOpen: false,
    searchQuery: "",
    updateState: true,
    restoreToggleFocus: false,
  });
  assert.deepEqual(
    commitSearchStateApplication(
      commitSearchStateAfterClose({ searchOpen: false, searchQuery: "" }, { restoreFocus: true }),
    ),
    {
      searchOpen: false,
      searchQuery: "",
      updateState: false,
      restoreToggleFocus: true,
    },
  );
  assert.deepEqual(
    commitSearchStateAfterToggle(
      { searchOpen: false, searchQuery: "footer" },
      { action: "open", disabled: false },
    ),
    {
      searchOpen: true,
      searchQuery: "footer",
      changed: true,
      restoreToggleFocus: false,
    },
  );
  assert.deepEqual(
    commitSearchStateAfterToggle(
      { searchOpen: true, searchQuery: "footer" },
      { action: "close", disabled: false },
    ),
    {
      searchOpen: false,
      searchQuery: "",
      changed: true,
      restoreToggleFocus: false,
    },
  );
  assert.deepEqual(
    commitSearchStateAfterToggle(
      { searchOpen: true, searchQuery: "footer" },
      { action: "close", disabled: true },
    ),
    {
      searchOpen: true,
      searchQuery: "footer",
      changed: false,
      restoreToggleFocus: false,
    },
  );
  assert.deepEqual(commitSearchStateAfterAvailability({ searchOpen: true, searchQuery: "footer" }, false), {
    searchOpen: false,
    searchQuery: "",
    changed: true,
    restoreToggleFocus: false,
  });
  assert.deepEqual(commitSearchStateAfterAvailability({ searchOpen: false, searchQuery: "" }, false), {
    searchOpen: false,
    searchQuery: "",
    changed: false,
    restoreToggleFocus: false,
  });
  assert.deepEqual(commitSearchStateAfterAvailability({ searchOpen: true, searchQuery: "footer" }, true), {
    searchOpen: true,
    searchQuery: "footer",
    changed: false,
    restoreToggleFocus: false,
  });
  assert.deepEqual(commitSearchToggleView({ canSearch: true, searchActive: false, searchOpen: false }), {
    action: "open",
    ariaControls: "commit-search-form",
    ariaExpanded: false,
    ariaLabel: "Search commits",
    ariaPressed: false,
    className: "commit-search-toggle",
    disabled: false,
    title: undefined,
    tooltip: "Search commits",
  });
  assert.deepEqual(commitSearchToggleView({ canSearch: true, searchActive: true, searchOpen: true }), {
    action: "close",
    ariaControls: "commit-search-form",
    ariaExpanded: true,
    ariaLabel: "Close commit search",
    ariaPressed: true,
    className: "commit-search-toggle is-active",
    disabled: false,
    title: undefined,
    tooltip: undefined,
  });
  assert.deepEqual(commitListView([], "anything", true).searchToggle, {
    action: "close",
    ariaControls: "commit-search-form",
    ariaExpanded: true,
    ariaLabel: "Close commit search",
    ariaPressed: false,
    className: "commit-search-toggle",
    disabled: true,
    title: "No commits to search",
    tooltip: undefined,
  });
  assert.deepEqual(
    commitVirtualWindow({
      itemCount: 2,
      selectedIndex: -1,
      scrollTop: 1000,
      viewportHeight: 256,
    }),
    {
      startIndex: 0,
      endIndex: 2,
      topPadding: 0,
      bottomPadding: 0,
      totalHeight: 136,
      virtualized: false,
    },
  );
  assert.deepEqual(
    commitVirtualWindow({
      itemCount: commitVirtualizationThreshold + 80,
      selectedIndex: -1,
      scrollTop: 0,
      viewportHeight: 256,
    }),
    {
      startIndex: 0,
      endIndex: 12,
      topPadding: 0,
      bottomPadding: 12784,
      totalHeight: 13600,
      virtualized: true,
    },
  );
  assert.equal(commitVirtualTotalHeight(200, 10), 13648);
  assert.equal(commitVirtualRowOffset(11, 200, 10), 796);
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 10,
      scrollTop: 0,
      viewportHeight: 256,
    }),
    540,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 2,
      scrollTop: 300,
      viewportHeight: 256,
    }),
    136,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 2,
      scrollTop: 100,
      viewportHeight: 256,
    }),
    null,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 10,
      scrollTop: 0,
      viewportHeight: 256,
      alignment: "center",
    }),
    610,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 2,
      scrollTop: 100,
      viewportHeight: 256,
      alignment: "center",
    }),
    66,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 10,
      scrollTop: 300,
      viewportHeight: 256,
      listViewportTop: 200,
    }),
    640,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 10,
      scrollTop: 300,
      viewportHeight: 256,
      alignment: "center",
      listViewportTop: 200,
    }),
    710,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 19,
      scrollTop: 0,
      viewportHeight: 256,
      alignment: "center",
    }),
    1152,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: 19,
      scrollTop: 0,
      viewportHeight: 256,
    }),
    1152,
  );
  assert.equal(
    commitScrollTopForSelection({
      itemCount: 20,
      selectedIndex: -1,
      scrollTop: 0,
      viewportHeight: 256,
    }),
    null,
  );
  assert.equal(
    commitScrollTopForMeasuredCenter({
      selectedTop: 250,
      selectedHeight: 100,
      viewportTop: 100,
      viewportHeight: 300,
      scrollTop: 400,
      maxScrollTop: 1000,
    }),
    450,
  );
  assert.equal(
    commitScrollTopForMeasuredCenter({
      selectedTop: 199.5,
      selectedHeight: 100,
      viewportTop: 100,
      viewportHeight: 300,
      scrollTop: 400,
      maxScrollTop: 1000,
    }),
    null,
  );
  assert.equal(
    commitScrollTopForMeasuredCenter({
      selectedTop: 0,
      selectedHeight: 40,
      viewportTop: 200,
      viewportHeight: 300,
      scrollTop: 20,
      maxScrollTop: 1000,
    }),
    0,
  );
  assert.equal(
    commitScrollTopForMeasuredCenter({
      selectedTop: 700,
      selectedHeight: 80,
      viewportTop: 100,
      viewportHeight: 300,
      scrollTop: 980,
      maxScrollTop: 1000,
    }),
    1000,
  );
  assert.deepEqual(
    commitVirtualWindow({
      itemCount: 200,
      selectedIndex: 10,
      scrollTop: 680,
      viewportHeight: 68,
      overscanRows: 0,
    }),
    {
      startIndex: 10,
      endIndex: 11,
      topPadding: 680,
      bottomPadding: 12852,
      totalHeight: 13648,
      virtualized: true,
    },
  );
}

async function testCommitRowView(server) {
  const { commitHoverPanelView, commitRowView } = await loadTsModule(server, "src/lib/commitRowView.ts");
  const selectedMerge = commit({
    message: "Merge branch 'feature/details'\n\nKeep the full body available.",
    refs: ["main", "tag:v1"],
    containedBranches: ["main", "feature/details"],
    refColors: ["#123456"],
    parents: ["1111111", "2222222"],
    graph: {
      ...commit().graph,
      isMerge: true,
    },
  });

  assert.deepEqual(commitRowView(selectedMerge, true, true), {
    className: "commit-row is-selected",
    contentClassName: "commit-content",
    selectButton: {
      className: "commit-select",
      ariaPressed: true,
    },
    selectAriaPressed: true,
    titleLineClassName: "commit-title-line",
    titleTextClassName: "commit-title-text",
    ref: "main",
    showRef: true,
    refPillClassName: "ref-pill",
    refColor: "#123456",
    message: "Merge branch 'feature/details'\n\nKeep the full body available.",
    displayMessage: "Merge branch 'feature/details'\n\nKeep the full body available.",
    metaClassName: "commit-meta",
    showAuthor: true,
    showActions: true,
    isMerge: true,
    mergeIndicator: {
      className: "merge-indicator",
      title: "2 parent commits",
    },
    mergeTitle: "2 parent commits",
    stats: {
      className: "commit-stats",
      additionsClassName: "additions",
      deletionsClassName: "deletions",
      filesClassName: "files",
    },
    messagePopover: {
      className: "commit-message-popover",
      role: "tooltip",
      message: "Merge branch 'feature/details'\n\nKeep the full body available.",
    },
    actionsClassName: "commit-actions",
    branchAction: {
      action: "branch",
      label: "Branch",
      icon: "branch",
      disabled: false,
      title: undefined,
    },
    mergeAction: {
      action: "merge",
      label: "Merge",
      icon: "merge",
      disabled: false,
      title: undefined,
    },
    checkoutAction: {
      action: "checkout",
      label: "Checkout",
      icon: "checkout",
      disabled: false,
      title: undefined,
    },
  });

  const unselected = commitRowView(
    commit({
      title: "Tighten compact row",
      message: "   ",
      refs: [],
      refColors: [],
      branchColor: "#abcdef",
    }),
    false,
    true,
  );

  assert.equal(unselected.className, "commit-row");
  assert.equal(unselected.selectAriaPressed, false);
  assert.equal(unselected.ref, "");
  assert.equal(unselected.showRef, false);
  assert.equal(unselected.refColor, "#abcdef");
  assert.equal(unselected.message, "Tighten compact row");
  assert.equal(unselected.displayMessage, "Tighten compact row");
  assert.equal(unselected.showAuthor, false);
  assert.equal(unselected.showActions, false);

  const externalWorktree = commit({
    graph: {
      ...commit().graph,
      currentVariant: "dashed",
    },
  });
  const externalView = commitRowView(externalWorktree, true);

  assert.deepEqual(externalView.mergeAction, {
    action: "merge",
    label: "Merge",
    icon: "merge",
    disabled: false,
    title: undefined,
  });
  assert.deepEqual(externalView.checkoutAction, {
    action: "checkout",
    label: "Checkout",
    icon: "checkout",
    disabled: true,
    title: "Open that worktree first to checkout there.",
  });

  const hoverPanel = commitHoverPanelView(selectedMerge);
  assert.equal(hoverPanel.panel.className, "commit-hover-panel changed-side-panel");
  assert.equal(hoverPanel.panel.role, "tooltip");
  assert.equal(hoverPanel.panel.ariaLabel, "Commit a1b2c3d details");
  assert.equal(hoverPanel.bodyClassName, "commit-hover-body");
  assert.equal(hoverPanel.primarySectionClassName, "commit-hover-section commit-hover-primary");
  assert.equal(hoverPanel.statsSectionClassName, "commit-hover-section commit-hover-stats-section");
  assert.equal(hoverPanel.refsSectionClassName, "commit-hover-section commit-hover-refs-section");
  assert.equal(hoverPanel.hashSectionClassName, "commit-hover-section commit-hover-hash-section");
  assert.equal(hoverPanel.headerClassName, "commit-hover-header");
  assert.equal(hoverPanel.statsClassName, "commit-hover-stats");
  assert.equal(hoverPanel.author, "Codex");
  assert.equal(hoverPanel.relativeTime, "2 minutes ago");
  assert.equal(hoverPanel.absoluteTime, "June 10, 2026 at 2:26 AM");
  assert.equal(hoverPanel.timeLabel, "2 minutes ago (June 10, 2026 at 2:26 AM)");
  assert.equal(hoverPanel.showTime, true);
  assert.equal(hoverPanel.message, "Merge branch 'feature/details'\n\nKeep the full body available.");
  assert.equal(hoverPanel.filesLabel, "2");
  assert.equal(hoverPanel.filesChangedLabel, "2 files changed");
  assert.equal(hoverPanel.insertionsLabel, "8 insertions(+)");
  assert.equal(hoverPanel.deletionsLabel, "1 deletion(-)");
  assert.deepEqual(hoverPanel.refs, [
    { key: "main-0", label: "main", color: "#123456", title: "main", icon: "branch", modifierClassName: "" },
    { key: "tag:v1-1", label: "tag:v1", color: "#2f80ed", title: "tag:v1", icon: "branch", modifierClassName: "" },
  ]);
  assert.equal(hoverPanel.hash, "a1b2c3d");
  assert.equal(hoverPanel.fullHash, "a1b2c3d000000000000000000000000000000000");

  const mergedRefHoverPanel = commitHoverPanelView(
    commit({
      refs: [],
      mergedRefs: ["feat/function-menu"],
      refColors: [],
      branchColor: "#abcdef",
      graph: {
        ...commit().graph,
        currentColor: "#abcdef",
        currentLabel: "",
      },
    }),
  );
  assert.deepEqual(mergedRefHoverPanel.refs, [
    {
      key: "feat/function-menu-merged-0",
      label: "feat/function-menu",
      color: "#abcdef",
      title: "feat/function-menu is a merged local branch pointer already reachable from the current branch.",
      icon: "branch",
      modifierClassName: "is-merged-ref",
    },
  ]);
  assert.equal(mergedRefHoverPanel.showRefs, true);

  const inheritedLaneHoverPanel = commitHoverPanelView(
    commit({
      refs: [],
      refColors: [],
      graph: {
        ...commit().graph,
        currentColor: "#654321",
        currentLabel: "feature/details",
      },
    }),
  );
  assert.deepEqual(inheritedLaneHoverPanel.refs, [
    {
      key: "feature/details-lane",
      label: "feature/details",
      color: "#654321",
      title: "feature/details",
      icon: "branch",
      modifierClassName: "",
    },
  ]);
  assert.equal(inheritedLaneHoverPanel.showRefs, true);

  const detachedHeadTitle =
    "Checked out as detached HEAD in 0371/git-tree-vis @ 5656bd8: /Users/junrong/.codex/worktrees/0371/git-tree-vis";
  const detachedHeadCommit = commit({
    refs: [],
    refColors: [],
    branchColor: "#f0a400",
    graph: {
      ...commit().graph,
      currentColor: "#f0a400",
      currentLabel: "",
    },
    checkedOutWorktrees: [
      {
        path: "/Users/junrong/.codex/worktrees/0371/git-tree-vis",
        branch: "",
        head: "5656bd8acd42892a3467465553d0ac318d8380ae",
        headShortHash: "5656bd8",
        headTitle: "fix: render branch graph fan-outs from commit nodes",
        headRelativeTime: "19 minutes ago",
        detached: true,
        bare: false,
        current: false,
        counts: { modified: 0, staged: 0, untracked: 0 },
      },
    ],
  });
  const detachedHoverPanel = commitHoverPanelView(detachedHeadCommit);
  assert.deepEqual(detachedHoverPanel.refs, [
    {
      key: "detached-worktree-head",
      label: "Detached 0371/git-tree-vis",
      color: "#f0a400",
      title: detachedHeadTitle,
      icon: "worktree",
      modifierClassName: "is-detached-worktree",
    },
  ]);
  assert.equal(detachedHoverPanel.showRefs, true);
}

async function testCommitView(server) {
  const { commitViewChangeDecision, commitViewLabel, defaultCommitView, sameCommitView } = await loadTsModule(
    server,
    "src/lib/commitView.ts",
  );

  assert.deepEqual(defaultCommitView, { mode: "all" });
  assert.equal(sameCommitView({ mode: "all" }, { mode: "all", ref: "" }), true);
  assert.equal(sameCommitView({ mode: "branch", ref: "main" }, { mode: "branch", ref: "main" }), true);
  assert.equal(sameCommitView({ mode: "branch" }, { mode: "branch", ref: "" }), true);
  assert.equal(sameCommitView({ mode: "branch", ref: "main" }, { mode: "branch", ref: "develop" }), false);
  assert.equal(sameCommitView({ mode: "current" }, { mode: "all" }), false);
  assert.equal(commitViewLabel({ mode: "all" }), "all branches");
  assert.equal(commitViewLabel({ mode: "current" }), "current branch");
  assert.equal(commitViewLabel({ mode: "branch" }), "specific branch");
  assert.equal(commitViewLabel({ mode: "branch", ref: "feature/worktree-safety" }), "branch feature/worktree-safety");
  assert.deepEqual(
    commitViewChangeDecision({
      currentView: { mode: "all" },
      nextView: { mode: "all", ref: "" },
      bridgeAvailable: true,
      hasSnapshot: true,
    }),
    { kind: "unchanged" },
  );
  assert.deepEqual(
    commitViewChangeDecision({
      currentView: { mode: "all" },
      nextView: { mode: "current" },
      bridgeAvailable: false,
      hasSnapshot: true,
    }),
    { kind: "local", notice: "Commit view set to current branch." },
  );
  assert.deepEqual(
    commitViewChangeDecision({
      currentView: { mode: "all" },
      nextView: { mode: "branch", ref: "develop" },
      bridgeAvailable: true,
      hasSnapshot: false,
    }),
    { kind: "local", notice: "Commit view set to branch develop." },
  );
  assert.deepEqual(
    commitViewChangeDecision({
      currentView: { mode: "current" },
      nextView: { mode: "all" },
      bridgeAvailable: true,
      hasSnapshot: true,
    }),
    { kind: "refresh", successNotice: "Showing all branches." },
  );
}

async function testCommitInfoSelection(server) {
  const { commitInfoWindowView } = await loadTsModule(server, "src/lib/commitInfoSelection.ts");
  const hoverCommit = commit({ id: "hover" });

  assert.deepEqual(commitInfoWindowView(null), {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel is-commit",
      ariaLabel: "Commit details window",
    },
    emptyState: {
      className: "temporary-info-empty",
      ariaLabel: "Commit details",
      role: "status",
      ariaLive: "polite",
      message: "No commit selected.",
    },
    commitPayload: null,
    showCommit: false,
  });
  assert.deepEqual(commitInfoWindowView({ kind: "commit", commit: hoverCommit }), {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel is-commit",
      ariaLabel: "Commit details window",
    },
    emptyState: {
      className: "temporary-info-empty",
      ariaLabel: "Commit details",
      role: "status",
      ariaLive: "polite",
      message: "No commit selected.",
    },
    commitPayload: { kind: "commit", commit: hoverCommit },
    showCommit: true,
  });
}

async function testChangedFileInfoSelection(server) {
  const { changedFileInfoWindowView } = await loadTsModule(server, "src/lib/changedFileInfoSelection.ts");
  const file = changedFile({ path: "src/file.ts" });
  const changedFileInfoChrome = {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel is-changed-file",
      ariaLabel: "Changed file details window",
    },
    emptyState: {
      className: "temporary-info-empty",
      ariaLabel: "Changed file details",
      role: "status",
      ariaLive: "polite",
      message: "No file selected.",
    },
  };

  assert.deepEqual(changedFileInfoWindowView(null), {
    ...changedFileInfoChrome,
    changedFilePayload: null,
    showChangedFile: false,
  });
  assert.deepEqual(changedFileInfoWindowView({ kind: "changed-file", file, workspaceOpenTarget: "cursor" }), {
    ...changedFileInfoChrome,
    changedFilePayload: { kind: "changed-file", file, workspaceOpenTarget: "cursor" },
    showChangedFile: true,
  });
}

async function testSnapshotResponseView(server) {
  const {
    defaultSnapshotFailureNotice,
    folderWithoutGitAfterSnapshotResponse,
    selectedCommitIdAfterSnapshotResponse,
    snapshotResponseNotice,
  } = await loadTsModule(server, "src/lib/snapshotResponseView.ts");
  const folder = { path: "/Users/junrong/no-git", name: "no-git" };
  const okResponse = {
    ok: true,
    snapshot: gitSnapshot(),
  };
  const mergeResponse = {
    ok: true,
    snapshot: gitSnapshot({
      repositoryState: {
        operation: "merge",
        operationLabel: "Merge",
        hasConflicts: true,
        conflictedFiles: ["src/App.tsx", "src/styles.css"],
      },
    }),
  };
  const canceledResponse = { ok: false, reason: "read_failed", error: "Stopped.", canceled: true };
  const notGitResponse = { ok: false, reason: "not_git_repository", folder };
  const notGitErrorResponse = {
    ok: false,
    reason: "not_git_repository",
    folder,
    error: "Git is unavailable here.",
  };
  const readFailedResponse = { ok: false, reason: "read_failed" };
  const invalidRepositoryResponse = {
    ok: false,
    reason: "invalid_repository",
    error: "Repository path is invalid.",
  };

  assert.equal(snapshotResponseNotice(okResponse, "Loaded."), "Loaded.");
  assert.equal(snapshotResponseNotice(okResponse, null), null);
  assert.equal(snapshotResponseNotice(mergeResponse, "Loaded."), "Merge in progress: 2 conflicted files.");
  assert.equal(snapshotResponseNotice(mergeResponse, null), null);
  assert.equal(snapshotResponseNotice(canceledResponse), null);
  assert.equal(snapshotResponseNotice(notGitResponse), "no-git does not have Git initialized yet.");
  assert.equal(snapshotResponseNotice(notGitErrorResponse), "Git is unavailable here.");
  assert.equal(snapshotResponseNotice(readFailedResponse), defaultSnapshotFailureNotice);
  assert.equal(snapshotResponseNotice(invalidRepositoryResponse), "Repository path is invalid.");

  assert.equal(selectedCommitIdAfterSnapshotResponse(okResponse, "keep"), "keep");
  assert.equal(selectedCommitIdAfterSnapshotResponse(okResponse, "missing"), "");
  assert.equal(selectedCommitIdAfterSnapshotResponse(okResponse, ""), "");
  assert.equal(selectedCommitIdAfterSnapshotResponse(canceledResponse, "keep"), "keep");
  assert.equal(selectedCommitIdAfterSnapshotResponse(readFailedResponse, "keep"), "");

  assert.equal(folderWithoutGitAfterSnapshotResponse(okResponse), null);
  assert.equal(folderWithoutGitAfterSnapshotResponse(canceledResponse), undefined);
  assert.deepEqual(folderWithoutGitAfterSnapshotResponse(notGitResponse), folder);
  assert.equal(folderWithoutGitAfterSnapshotResponse(readFailedResponse), null);
}

async function testRepositoryStateView(server) {
  const {
    repositoryStateActive,
    repositoryStateBannerView,
    repositoryStateNotice,
  } = await loadTsModule(server, "src/lib/repositoryStateView.ts");
  const ready = { operation: "none", operationLabel: "Ready", hasConflicts: false, conflictedFiles: [] };
  const merge = {
    operation: "merge",
    operationLabel: "Merge",
    hasConflicts: true,
    conflictedFiles: ["src/App.tsx"],
  };
  const rebase = { operation: "rebase", operationLabel: "Rebase", hasConflicts: false, conflictedFiles: [] };

  assert.equal(repositoryStateActive(ready), false);
  assert.equal(repositoryStateActive(merge), true);
  assert.equal(repositoryStateNotice(ready), "");
  assert.equal(repositoryStateNotice(merge), "Merge in progress: 1 conflicted file.");
  assert.equal(repositoryStateNotice(rebase), "Rebase in progress.");
  assert.deepEqual(repositoryStateBannerView(merge), {
    className: "repository-state-banner",
    role: "status",
    ariaLive: "polite",
    title: "Merge in progress",
    detail: "1 conflicted file",
  });
}

async function testActionResponseView(server) {
  const {
    actionResponseNotice,
    actionResponseSnapshot,
    defaultActionFailureNotice,
  } = await loadTsModule(server, "src/lib/actionResponseView.ts");
  const snapshot = gitSnapshot({ repoName: "action-repo" });
  const okResponse = { ok: true };
  const okMessageResponse = { ok: true, message: "Created branch." };
  const okEmptyMessageResponse = { ok: true, message: "" };
  const okSnapshotResponse = { ok: true, snapshot };
  const canceledResponse = { ok: false, canceled: true, error: "User canceled." };
  const failedResponse = { ok: false, reason: "action_failed" };
  const failedMessageResponse = {
    ok: false,
    reason: "invalid_repository",
    error: "Repository is not available.",
  };
  const failedSnapshotResponse = {
    ok: false,
    reason: "action_failed",
    error: "Merge conflict.",
    snapshot,
  };

  assert.equal(actionResponseNotice(okResponse, "Done."), "Done.");
  assert.equal(actionResponseNotice(okMessageResponse, "Done."), "Created branch.");
  assert.equal(actionResponseNotice(okEmptyMessageResponse, "Done."), "");
  assert.equal(actionResponseNotice(okSnapshotResponse, "Refreshed."), "Refreshed.");
  assert.equal(actionResponseNotice(canceledResponse, "Done."), null);
  assert.equal(actionResponseNotice(failedResponse, "Done."), defaultActionFailureNotice);
  assert.equal(actionResponseNotice(failedResponse, "Done.", "Unable to checkout ref."), "Unable to checkout ref.");
  assert.equal(actionResponseNotice(failedMessageResponse, "Done."), "Repository is not available.");

  assert.equal(actionResponseSnapshot(okResponse), null);
  assert.equal(actionResponseSnapshot(failedMessageResponse), null);
  assert.equal(actionResponseSnapshot(canceledResponse), null);
  assert.deepEqual(actionResponseSnapshot(okSnapshotResponse), snapshot);
  assert.deepEqual(actionResponseSnapshot(failedSnapshotResponse), snapshot);
}

async function testMergeGuard(server) {
  const { dirtyWorkspaceMergeNotice, snapshotHasUncommittedChanges } = await loadTsModule(server, "src/lib/mergeGuard.ts");

  assert.equal(dirtyWorkspaceMergeNotice, "Workspace has uncommitted changes. Commit them before merging.");
  assert.equal(snapshotHasUncommittedChanges(null), false);
  assert.equal(snapshotHasUncommittedChanges(gitSnapshot()), false);
  assert.equal(snapshotHasUncommittedChanges(gitSnapshot({ changedFiles: [{ path: "src/App.tsx" }] })), true);
  assert.equal(snapshotHasUncommittedChanges(gitSnapshot({ counts: { modified: 0, staged: 1, untracked: 0 } })), true);
  assert.equal(snapshotHasUncommittedChanges(gitSnapshot({ counts: { modified: 0, staged: 0, untracked: 1 } })), true);
}

async function testAutoRefresh(server) {
  const {
    autoRefreshEnabled,
    autoRefreshIntervalMs,
    autoRefreshSchedule,
    autoRefreshTickMs,
    shouldRunAutoRefreshTick,
  } = await loadTsModule(server, "src/lib/autoRefresh.ts");

  assert.equal(autoRefreshIntervalMs("off"), 0);
  assert.equal(autoRefreshIntervalMs("1m"), 60_000);
  assert.equal(autoRefreshIntervalMs("5m"), 300_000);
  assert.equal(autoRefreshIntervalMs("15m"), 900_000);
  assert.equal(autoRefreshTickMs(0), 0);
  assert.equal(autoRefreshTickMs(10_000), 10_000);
  assert.equal(autoRefreshTickMs(60_000), 30_000);
  assert.equal(
    autoRefreshEnabled({
      intervalMs: 60_000,
      electron: true,
      hasSnapshot: true,
      actionDialogOpen: false,
      repositoryDialogOpen: false,
    }),
    true,
  );
  assert.equal(
    autoRefreshEnabled({
      intervalMs: 0,
      electron: true,
      hasSnapshot: true,
      actionDialogOpen: false,
      repositoryDialogOpen: false,
    }),
    false,
  );
  assert.equal(
    autoRefreshEnabled({
      intervalMs: 60_000,
      electron: true,
      hasSnapshot: true,
      actionDialogOpen: true,
      repositoryDialogOpen: false,
    }),
    false,
  );
  assert.deepEqual(
    autoRefreshSchedule({
      interval: "1m",
      electron: true,
      hasSnapshot: true,
      actionDialogOpen: false,
      repositoryDialogOpen: false,
    }),
    {
      enabled: true,
      intervalMs: 60_000,
      tickMs: 30_000,
    },
  );
  assert.deepEqual(
    autoRefreshSchedule({
      interval: "off",
      electron: true,
      hasSnapshot: true,
      actionDialogOpen: false,
      repositoryDialogOpen: false,
    }),
    {
      enabled: false,
      intervalMs: 0,
      tickMs: 0,
    },
  );
  assert.equal(
    shouldRunAutoRefreshTick({
      bridgeAvailable: true,
      inFlight: false,
      refreshing: false,
      lastGitRequestAt: 1_000,
      now: 61_000,
      intervalMs: 60_000,
    }),
    true,
  );
  assert.equal(
    shouldRunAutoRefreshTick({
      bridgeAvailable: true,
      inFlight: false,
      refreshing: false,
      lastGitRequestAt: 1_000,
      now: 60_999,
      intervalMs: 60_000,
    }),
    false,
  );
  assert.equal(
    shouldRunAutoRefreshTick({
      bridgeAvailable: false,
      inFlight: false,
      refreshing: false,
      lastGitRequestAt: 1_000,
      now: 61_000,
      intervalMs: 60_000,
    }),
    false,
  );
  assert.equal(
    shouldRunAutoRefreshTick({
      bridgeAvailable: true,
      inFlight: true,
      refreshing: false,
      lastGitRequestAt: 1_000,
      now: 61_000,
      intervalMs: 60_000,
    }),
    false,
  );
}

async function testPreferences(server) {
  const workspaceTargets = await loadTsModule(server, "src/lib/workspaceOpenTargets.ts");
  const preferences = await loadTsModule(server, "src/lib/preferences.ts");
  const {
    defaultWorkspaceOpenTarget,
    defaultWorkspaceOpenTargets,
    isWorkspaceOpenTarget,
    sanitizeWorkspaceOpenTarget,
    sanitizeWorkspaceOpenTargets,
    workspaceOpenTargetValues,
  } = workspaceTargets;
  const {
    defaultPreferences,
    mergePreferences,
    preferencesDocumentThemeView,
    resolveTheme,
    resolveThemePreset,
    systemThemeFallback,
    systemThemeFromMediaMatches,
  } = preferences;

  assert.equal(defaultWorkspaceOpenTarget, "vscode");
  assert.equal(isWorkspaceOpenTarget("cursor"), true);
  assert.equal(isWorkspaceOpenTarget("unknown"), false);
  assert.deepEqual(workspaceOpenTargetValues, [
    "vscode",
    "cursor",
    "codex",
    "antigravity",
    "antigravityApp",
    "finder",
    "terminal",
    "xcode",
  ]);
  assert.equal(sanitizeWorkspaceOpenTarget("finder"), "finder");
  assert.equal(sanitizeWorkspaceOpenTarget("unknown"), defaultWorkspaceOpenTarget);
  assert.equal(sanitizeWorkspaceOpenTarget("unknown", "terminal"), "terminal");
  assert.deepEqual(sanitizeWorkspaceOpenTargets(["cursor", "finder", "cursor", "unknown"]), ["cursor", "finder"]);
  assert.deepEqual(sanitizeWorkspaceOpenTargets(null, ["terminal"]), ["terminal"]);

  assert.deepEqual(
    mergePreferences({
      themeMode: "solarized",
      lightThemePreset: "paper",
      darkThemePreset: "matte",
      density: "wide",
      fontFamily: "mono",
      graphStyle: "wire",
      workspaceOpenTargets: ["codex", "codex", "bad", "terminal"],
      showMenuBarIcon: false,
      showDockIcon: false,
      launchAtLogin: "yes",
      autoUpdateChannel: "develop",
      autoUpdateChecks: "yes",
      autoUpdateInstall: true,
      createMergeCommit: false,
      autoRefreshInterval: "2m",
      promptLanguage: "zh",
    }),
    {
      ...defaultPreferences,
      lightThemePreset: "paper",
      darkThemePreset: "matte",
      fontFamily: "mono",
      workspaceOpenTargets: ["codex", "terminal"],
      showMenuBarIcon: false,
      showDockIcon: false,
      autoUpdateChannel: "develop",
      autoUpdateInstall: true,
      createMergeCommit: false,
      promptLanguage: "zh",
    },
  );
  assert.equal(mergePreferences({ autoUpdateChannel: "nightly" }).autoUpdateChannel, "stable");
  assert.deepEqual(mergePreferences({ workspaceOpenTargets: [] }).workspaceOpenTargets, []);
  assert.deepEqual(mergePreferences({ workspaceOpenTargets: "cursor" }).workspaceOpenTargets, defaultWorkspaceOpenTargets);
  assert.equal(resolveThemePreset({ ...defaultPreferences, lightThemePreset: "mist", darkThemePreset: "cursor" }, "light"), "mist");
  assert.equal(resolveThemePreset({ ...defaultPreferences, lightThemePreset: "mist", darkThemePreset: "cursor" }, "dark"), "cursor");
  assert.equal(resolveTheme({ ...defaultPreferences, themeMode: "light" }, "dark"), "light");
  assert.equal(resolveTheme({ ...defaultPreferences, themeMode: "dark" }, "light"), "dark");
  assert.equal(resolveTheme({ ...defaultPreferences, themeMode: "system" }, "dark"), "dark");
  assert.equal(systemThemeFromMediaMatches(false), "light");
  assert.equal(systemThemeFromMediaMatches(true), "dark");
  assert.deepEqual(preferencesDocumentThemeView({ ...defaultPreferences, themeMode: "system", darkThemePreset: "cursor" }, "dark"), {
    theme: "dark",
    themePreset: "cursor",
  });
  assert.deepEqual(
    preferencesDocumentThemeView(
      { ...defaultPreferences, themeMode: "light", lightThemePreset: "mist", darkThemePreset: "matte" },
      "dark",
    ),
    {
      theme: "light",
      themePreset: "mist",
    },
  );
  assert.equal(systemThemeFallback(), "light");
}

async function testWorkspaceOpenOptions(server) {
  const { workspaceOpenOptions } = await loadTsModule(server, "src/lib/workspaceOpenOptions.ts");
  const { workspaceOpenTargetValues } = await loadTsModule(server, "src/lib/workspaceOpenTargets.ts");

  assert.deepEqual(
    workspaceOpenOptions.map((option) => option.target),
    workspaceOpenTargetValues,
  );
  assert.deepEqual(
    workspaceOpenOptions.map((option) => option.label),
    ["VS Code", "Cursor", "Codex", "Antigravity IDE", "Antigravity", "Finder", "Terminal", "Xcode"],
  );

  for (const option of workspaceOpenOptions) {
    assert.equal(typeof option.iconSrc, "string");
    assert.match(option.iconSrc, /\.png(?:$|\?)/);
  }

  assert.notEqual(
    workspaceOpenOptions.find((option) => option.target === "antigravity")?.iconSrc,
    workspaceOpenOptions.find((option) => option.target === "antigravityApp")?.iconSrc,
  );
}

async function testCollapsedRailView(server) {
  const {
    collapsedRailBranchLabel,
    collapsedRailBranchLabelMaxLength,
    collapsedRailBranchColor,
    collapsedRailBranchSlotHeight,
    collapsedRailHeightForBranchName,
    collapsedRailHeightForLabel,
    collapsedRailView,
    workingTreeChangeCount,
  } = await loadTsModule(server, "src/lib/collapsedRailView.ts");

  assert.equal(workingTreeChangeCount({ modified: 2, staged: 3, untracked: 5 }), 10);
  assert.equal(collapsedRailBranchLabelMaxLength, 20);
  assert.equal(collapsedRailBranchLabel("feature/collapsed-rail"), "feature/collapsed...");
  assert.equal(collapsedRailBranchSlotHeight("main"), 58);
  assert.equal(collapsedRailHeightForLabel("main"), 136);
  assert.equal(collapsedRailHeightForBranchName("main"), 136);
  assert.equal(collapsedRailHeightForBranchName("fix/worktree-render"), 230);
  assert.equal(collapsedRailBranchSlotHeight("refactor/codebase-optimization"), 229);
  assert.equal(collapsedRailBranchSlotHeight(collapsedRailBranchLabel("refactor/codebase-optimization")), 159);
  assert.equal(collapsedRailHeightForBranchName("refactor/codebase-optimization"), 237);
  assert.equal(collapsedRailHeightForBranchName("feature/super-long-branch-name-v2"), 237);
  assert.deepEqual(collapsedRailView(null), {
    className: "collapsed-rail",
    ariaLabel: "Collapsed Gocus",
    title: "Drag to move. Double-click to dock to the screen edge.",
    expandButton: {
      className: "ui-icon-button rail-expand",
      ariaLabel: "Expand Gocus",
    },
    branch: {
      className: "rail-branch",
      label: "Open",
      title: "",
      ariaLabel: "Open working folder",
      color: undefined,
      icon: "folder",
    },
    dirtyCount: 0,
    showChangedNowButton: false,
    changedNowButton: {
      className: "rail-count",
      ariaLabel: "Open Changed now, 0 working tree changes",
      ariaPressed: false,
      title: "Changed now",
    },
  });
  assert.deepEqual(
    collapsedRailView({
      branch: { name: "feature/collapsed-rail" },
      counts: { modified: 2, staged: 1, untracked: 4 },
    }),
    {
      className: "collapsed-rail",
      ariaLabel: "Collapsed Gocus",
      title: "Drag to move. Double-click to dock to the screen edge.",
      expandButton: {
        className: "ui-icon-button rail-expand",
        ariaLabel: "Expand Gocus",
      },
      branch: {
        className: "rail-branch",
        label: "feature/collapsed...",
        title: "",
        ariaLabel: "Current branch feature/collapsed-rail",
        color: undefined,
        icon: "branch",
      },
      dirtyCount: 7,
      showChangedNowButton: true,
      changedNowButton: {
        className: "rail-count",
        ariaLabel: "Open Changed now, 7 working tree changes",
        ariaPressed: false,
        title: "Changed now",
      },
    },
  );
  assert.deepEqual(
    collapsedRailView(
      {
        branch: { name: "feature/collapsed-rail" },
        counts: { modified: 2, staged: 1, untracked: 4 },
      },
      true,
    ).changedNowButton,
    {
      className: "rail-count",
      ariaLabel: "Close Changed now, 7 working tree changes",
      ariaPressed: true,
      title: "Close Changed now",
    },
  );
  assert.equal(
    collapsedRailView({
      branch: { name: "main" },
      counts: { modified: 0, staged: 0, untracked: 0 },
    }).showChangedNowButton,
    true,
  );
  assert.deepEqual(
    collapsedRailView({
      branch: { name: "refactor/codebase-optimization" },
      counts: { modified: 0, staged: 0, untracked: 0 },
    }).branch,
    {
      className: "rail-branch",
      label: "refactor/codebase...",
      title: "",
      ariaLabel: "Current branch refactor/codebase-optimization",
      color: undefined,
      icon: "branch",
    },
  );
  assert.deepEqual(
    collapsedRailView({
      branch: { name: "feature/super-long-branch-name-v2" },
      counts: { modified: 0, staged: 0, untracked: 0 },
    }).branch,
    {
      className: "rail-branch",
      label: "feature/super-lon...",
      title: "",
      ariaLabel: "Current branch feature/super-long-branch-name-v2",
      color: undefined,
      icon: "branch",
    },
  );
  const coloredSnapshot = {
    branch: { name: "feature/collapsed-rail" },
    counts: { modified: 0, staged: 0, untracked: 0 },
    commits: [
      commit({
        refs: ["origin/feature/collapsed-rail"],
        refColors: ["#8b5cf6"],
        branchColor: "#8b5cf6",
      }),
    ],
  };
  assert.equal(collapsedRailBranchColor(coloredSnapshot), "#8b5cf6");
  assert.equal(collapsedRailView(coloredSnapshot).branch.color, "#8b5cf6");
}

async function testWorkspaceOpenChoices(server) {
  const {
    activeWorkspaceOpenOption,
    activeWorkspaceOpenTarget,
    availableWorkspaceOpenOptions,
    enabledWorkspaceOpenOptionCount,
    visibleWorkspaceOpenOptions,
    workspaceOpenTargetsAfterToggle,
    workspaceOpenTargetsSummary,
  } = await loadTsModule(server, "src/lib/workspaceOpenChoices.ts");
  const options = [
    { target: "vscode", label: "VS Code", iconSrc: "vscode.png" },
    { target: "cursor", label: "Cursor", iconSrc: "cursor.png" },
    { target: "codex", label: "Codex", iconSrc: "codex.png" },
    { target: "terminal", label: "Terminal", iconSrc: "terminal.png" },
  ];
  const availableOptions = availableWorkspaceOpenOptions(options, ["terminal", "cursor"]);

  assert.deepEqual(
    availableOptions.map((option) => option.target),
    ["cursor", "terminal"],
  );
  assert.deepEqual(
    visibleWorkspaceOpenOptions(options, ["terminal", "cursor", "codex"], ["vscode", "cursor", "terminal"]).map((option) => option.target),
    ["cursor", "terminal"],
  );
  assert.equal(activeWorkspaceOpenOption(availableOptions, "terminal")?.label, "Terminal");
  assert.equal(activeWorkspaceOpenOption(availableOptions, "codex")?.label, "Cursor");
  assert.equal(activeWorkspaceOpenOption([], "codex"), null);
  assert.equal(activeWorkspaceOpenTarget(availableOptions, "terminal"), "terminal");
  assert.equal(activeWorkspaceOpenTarget(availableOptions, "codex"), "cursor");
  assert.equal(activeWorkspaceOpenTarget([], "codex"), "");
  assert.equal(enabledWorkspaceOpenOptionCount(availableOptions, ["cursor", "codex"]), 1);
  assert.equal(workspaceOpenTargetsSummary(availableOptions, ["cursor", "terminal"]), "2 enabled");
  assert.equal(workspaceOpenTargetsSummary([], ["cursor"]), "Unavailable");
  assert.deepEqual(workspaceOpenTargetsAfterToggle(options, ["codex", "terminal"], "cursor", true), ["cursor", "codex", "terminal"]);
  assert.deepEqual(workspaceOpenTargetsAfterToggle(options, ["vscode", "cursor", "terminal"], "cursor", false), ["vscode", "terminal"]);
}

async function testFooterWorkspaceView(server) {
  const {
    footerActionsView,
    footerChangedNowButtonView,
    footerNoticeView,
    footerOpenRepositoryButtonView,
    footerSettingsButtonView,
    footerWorkspaceMenuOpenAfterSelection,
    footerWorkspaceMenuOpenAfterToggle,
    footerWorkspaceMenuItemView,
    footerWorkspaceMenuToggleView,
    footerWorkspaceMenuView,
    footerWorkspaceOpenButtonView,
    footerWorkspaceSelection,
    footerWorkspaceView,
  } = await loadTsModule(server, "src/lib/footerWorkspaceView.ts");
  const options = [
    { target: "vscode", label: "VS Code", iconSrc: "vscode.png" },
    { target: "cursor", label: "Cursor", iconSrc: "cursor.png" },
    { target: "terminal", label: "Terminal", iconSrc: "terminal.png" },
  ];

  const ready = footerWorkspaceView({
    options,
    availableTargets: ["terminal", "cursor"],
    enabledTargets: ["terminal", "cursor"],
    activeTarget: "terminal",
    hasRepository: true,
  });

  assert.deepEqual(
    ready.visibleOptions.map((option) => option.target),
    ["cursor", "terminal"],
  );
  assert.equal(ready.activeOption?.label, "Terminal");
  assert.equal(ready.activeMenuTarget, "terminal");
  assert.deepEqual(ready.control, {
    className: "workspace-open-control",
    iconClassName: "external-app-icon",
  });
  assert.equal(ready.controlsDisabled, false);
  assert.equal(ready.canToggleMenu, true);
  assert.equal(ready.shouldCloseMenu, false);
  assert.deepEqual(footerWorkspaceOpenButtonView(ready.activeOption), {
    className: "workspace-open-trigger",
    ariaLabel: "Open in Terminal",
    title: "Open in Terminal",
  });
  assert.deepEqual(footerWorkspaceMenuToggleView(false), {
    id: "workspace-open-menu-toggle",
    className: "workspace-open-menu-toggle",
    ariaLabel: "Choose external app",
    ariaHasPopup: "menu",
    ariaExpanded: false,
    ariaControls: "workspace-open-menu",
    title: "Choose external app",
  });
  assert.deepEqual(footerWorkspaceMenuToggleView(true), {
    id: "workspace-open-menu-toggle",
    className: "workspace-open-menu-toggle is-open",
    ariaLabel: "Choose external app",
    ariaHasPopup: "menu",
    ariaExpanded: true,
    ariaControls: "workspace-open-menu",
    title: "Choose external app",
  });
  assert.deepEqual(footerWorkspaceMenuView(), {
    className: "ui-menu ui-layer-panel workspace-open-menu",
    id: "workspace-open-menu",
    role: "menu",
    ariaLabelledBy: "workspace-open-menu-toggle",
  });
  assert.deepEqual(footerWorkspaceMenuItemView(ready.visibleOptions[0], ready.activeMenuTarget), {
    active: false,
    className: "ui-menu-item workspace-open-menu-item",
    iconClassName: "external-app-icon",
    role: "menuitem",
    ariaCurrent: undefined,
  });
  assert.deepEqual(footerWorkspaceMenuItemView(ready.visibleOptions[1], ready.activeMenuTarget), {
    active: true,
    className: "ui-menu-item workspace-open-menu-item is-active",
    iconClassName: "external-app-icon",
    role: "menuitem",
    ariaCurrent: "true",
  });
  assert.equal(footerWorkspaceMenuOpenAfterToggle(false, true), true);
  assert.equal(footerWorkspaceMenuOpenAfterToggle(true, true), false);
  assert.equal(footerWorkspaceMenuOpenAfterToggle(false, false), false);
  assert.equal(footerWorkspaceMenuOpenAfterToggle(true, false), true);
  assert.equal(footerWorkspaceMenuOpenAfterSelection(), false);
  assert.deepEqual(footerWorkspaceSelection("cursor"), {
    activeTarget: "cursor",
    menuOpen: false,
    openTarget: "cursor",
  });

  const fallback = footerWorkspaceView({
    options,
    availableTargets: ["terminal", "cursor"],
    enabledTargets: ["terminal", "cursor"],
    activeTarget: "vscode",
    hasRepository: true,
  });

  assert.equal(fallback.activeOption?.label, "Cursor");
  assert.equal(fallback.activeMenuTarget, "cursor");

  const noRepository = footerWorkspaceView({
    options,
    availableTargets: ["cursor"],
    enabledTargets: ["cursor"],
    activeTarget: "cursor",
    hasRepository: false,
  });

  assert.equal(noRepository.activeOption?.label, "Cursor");
  assert.equal(noRepository.controlsDisabled, true);
  assert.equal(noRepository.canToggleMenu, false);
  assert.equal(noRepository.shouldCloseMenu, true);

  const unavailable = footerWorkspaceView({
    options,
    availableTargets: ["terminal"],
    enabledTargets: ["cursor"],
    activeTarget: "cursor",
    hasRepository: true,
  });

  assert.equal(unavailable.activeOption, null);
  assert.equal(unavailable.activeMenuTarget, "");
  assert.equal(unavailable.controlsDisabled, false);
  assert.equal(unavailable.canToggleMenu, false);
  assert.equal(unavailable.shouldCloseMenu, true);

  assert.deepEqual(footerChangedNowButtonView(false), {
    className: "footer-changed-now",
    ariaLabel: "Open Changed now",
    ariaPressed: false,
    title: "Changed now",
  });
  assert.deepEqual(footerChangedNowButtonView(true), {
    className: "footer-changed-now is-open",
    ariaLabel: "Close Changed now",
    ariaPressed: true,
    title: "Close Changed now",
  });
  assert.deepEqual(footerSettingsButtonView(), {
    className: "ui-icon-button footer-icon footer-settings",
    ariaLabel: "Settings",
    title: "Settings",
  });
  assert.deepEqual(footerOpenRepositoryButtonView(), {
    className: "footer-primary",
    label: "Open folder",
  });
  assert.deepEqual(footerNoticeView({ hasRepository: true, notice: " Git status refreshed. " }), {
    className: "notice-line",
    role: "status",
    ariaLive: "polite",
    message: "Git status refreshed.",
  });
  assert.equal(footerNoticeView({ hasRepository: true, notice: "   " }), null);
  assert.equal(footerNoticeView({ hasRepository: false, notice: "Choose a working folder first." }), null);
  assert.deepEqual(footerActionsView({ changedNowOpen: false, hasRepository: false }), {
    className: "peek-footer",
    showOpenRepositoryButton: true,
    showChangedNowButton: false,
    settingsButton: {
      className: "ui-icon-button footer-icon footer-settings",
      ariaLabel: "Settings",
      title: "Settings",
    },
    openRepositoryButton: {
      className: "footer-primary",
      label: "Open folder",
    },
    changedNowButton: {
      className: "footer-changed-now",
      ariaLabel: "Open Changed now",
      ariaPressed: false,
      title: "Changed now",
    },
  });
  assert.deepEqual(footerActionsView({ changedNowOpen: true, hasRepository: true }), {
    className: "peek-footer",
    showOpenRepositoryButton: false,
    showChangedNowButton: true,
    settingsButton: {
      className: "ui-icon-button footer-icon footer-settings",
      ariaLabel: "Settings",
      title: "Settings",
    },
    openRepositoryButton: {
      className: "footer-primary",
      label: "Open folder",
    },
    changedNowButton: {
      className: "footer-changed-now is-open",
      ariaLabel: "Close Changed now",
      ariaPressed: true,
      title: "Close Changed now",
    },
  });
}

async function testSettingsPanelView(server) {
  const {
    settingsPageAfterBack,
    settingsPageAfterEscape,
    settingsPanelTitleId,
    settingsPanelView,
    settingsPreferencesView,
    settingsRefreshMenuId,
    settingsRefreshTriggerId,
    settingsWorkspaceTargetItems,
  } = await loadTsModule(server, "src/lib/settingsPanelView.ts");
  const { defaultPreferences } = await loadTsModule(server, "src/lib/preferences.ts");
  const options = [
    { target: "vscode", label: "VS Code", iconSrc: "vscode.png" },
    { target: "cursor", label: "Cursor", iconSrc: "cursor.png" },
    { target: "terminal", label: "Terminal", iconSrc: "terminal.png" },
  ];
  const expectedSections = {
    app: {
      titleId: "settings-app-title",
      title: "App",
      rowLabel: "Updates",
      disclosureAriaLabel: "Open app settings",
      disclosureLabel: "Settings",
      disclosureValue: "",
      updatesTitleId: "settings-app-updates-title",
      updatesTitle: "Updates",
      rows: {
        channel: "Channel",
        updates: "Auto update",
        install: "Auto install",
        check: "Manual",
        releases: "Release page",
      },
      autoUpdateChannelAriaLabel: "Update channel",
      autoUpdateChecksAriaLabel: "Automatically check for updates",
      autoUpdateInstallAriaLabel: "Automatically install updates",
      checkForUpdatesAriaLabel: "Check for updates",
      checkForUpdatesLabel: "Check now",
      releaseLinkLabel: "GitHub Releases",
      releaseLinkAriaLabel: "Open GitHub Releases",
    },
    appearance: {
      titleId: "settings-appearance-title",
      title: "Appearance",
      rows: {
        mode: "Mode",
        light: "Light",
        dark: "Dark",
        density: "Density",
        font: "Font",
      },
      lightThemeAriaLabel: "Light theme preset",
      darkThemeAriaLabel: "Dark theme preset",
      fontFamilyAriaLabel: "Font family",
    },
    graph: {
      titleId: "settings-graph-title",
      title: "Graph",
      rows: {
        lines: "Lines",
      },
    },
    behavior: {
      titleId: "settings-behavior-title",
      title: "Behavior",
      dockIconAvailable: true,
      rows: {
        refresh: "Refresh",
        startup: "Startup",
        menuBar: "Menu bar",
        dock: "Dock",
        merge: "No-FF",
        prompt: "Prompt",
      },
      autoRefreshAriaLabel: "Auto refresh interval",
      launchAtLoginAriaLabel: "Launch at login",
      showMenuBarIconAriaLabel: "Show menu bar icon",
      showDockIconAriaLabel: "Show Dock icon",
      createMergeCommitAriaLabel: "Disable fast-forward merges",
    },
    workspace: {
      titleId: "settings-workspace-title",
      title: "Workspace",
      rowLabel: "Open in",
      disclosureAriaLabel: "Open external app settings",
      disclosureLabel: "Apps",
      disclosureValue: "2 enabled",
    },
    reset: {
      ariaLabel: "Reset preferences",
      label: "Reset",
    },
  };
  const expectedSettingsChrome = {
    page: {
      className: "ui-page settings-page",
      ariaLabelledBy: "settings-panel-title",
    },
    header: {
      className: "ui-page-header settings-page-header",
      backButton: {
        className: "ui-icon-button",
        ariaLabel: "Back to Git view",
      },
    },
    openInPanel: {
      className: "ui-form settings-panel settings-workspace-targets-panel",
      listClassName: "workspace-target-list",
      toggleClassName: "workspace-target-toggle",
      iconClassName: "external-app-icon",
      emptyState: {
        className: "empty-state",
        role: "status",
        ariaLive: "polite",
        message: "No external apps available.",
      },
    },
    mainPanel: {
      className: "ui-form settings-panel",
      sectionClassName: "ui-form-section",
      sectionTitleClassName: "ui-form-section-title",
      rowClassName: "ui-form-row settings-row",
      labelClassName: "ui-label",
      segmentedClassName: "ui-segmented segmented-control",
      compactSegmentedClassName: "ui-segmented segmented-control compact",
      selectFrameClassName: "ui-select-frame",
      selectClassName: "ui-select",
      refreshControlClassName: "settings-refresh-control",
      refreshFrameClassName: "ui-select-frame ui-disclosure-frame settings-refresh-frame",
      refreshTriggerClassName: "settings-refresh-trigger ui-disclosure-button",
      refreshTriggerId: "settings-refresh-trigger",
      refreshMenuClassName: "ui-menu settings-refresh-menu",
      refreshMenuId: "settings-refresh-menu",
      refreshMenuItemClassName: "ui-menu-item settings-refresh-menu-item",
      refreshMenuRole: "menu",
      launchAtLoginToggleClassName: "ui-toggle settings-launch-at-login-toggle",
      autoUpdateChecksToggleClassName: "ui-toggle settings-auto-update-checks-toggle",
      autoUpdateInstallToggleClassName: "ui-toggle settings-auto-update-install-toggle",
      autoUpdateChannelControlClassName: "settings-update-channel-control",
      autoUpdateChannelDetailClassName: "ui-label settings-update-channel-detail",
      manualUpdateButtonClassName: "ui-button settings-check-updates",
      releaseLinkButtonClassName: "ui-button settings-release-link",
      menuBarIconToggleClassName: "ui-toggle settings-menu-bar-icon-toggle",
      dockIconToggleClassName: "ui-toggle settings-dock-icon-toggle",
      mergeCommitToggleClassName: "ui-toggle settings-merge-commit-toggle",
      disclosureFrameClassName: "ui-select-frame ui-disclosure-frame",
      disclosureButtonClassName: "ui-disclosure-button",
      disclosureLabelClassName: "ui-disclosure-label",
      disclosureValueClassName: "ui-disclosure-value",
      resetSectionClassName: "ui-form-section ui-form-section-actions",
      resetButtonClassName: "ui-button settings-reset",
    },
  };

  assert.equal(settingsPanelTitleId, "settings-panel-title");
  assert.equal(settingsRefreshMenuId, "settings-refresh-menu");
  assert.equal(settingsRefreshTriggerId, "settings-refresh-trigger");
  assert.deepEqual(settingsPanelView("main", options, ["cursor", "terminal"]), {
    appPageActive: false,
    openInPageActive: false,
    ...expectedSettingsChrome,
    titleId: "settings-panel-title",
    title: "Settings",
    subtitle: "Interface preferences",
    workspaceTargetsSummary: "2 enabled",
    sections: expectedSections,
  });
  assert.deepEqual(settingsPanelView("app", options, ["cursor"]), {
    appPageActive: true,
    openInPageActive: false,
    ...expectedSettingsChrome,
    header: {
      ...expectedSettingsChrome.header,
      backButton: {
        ...expectedSettingsChrome.header.backButton,
        ariaLabel: "Back to settings",
      },
    },
    titleId: "settings-panel-title",
    title: "App",
    subtitle: "Application settings",
    workspaceTargetsSummary: "1 enabled",
    sections: {
      ...expectedSections,
      workspace: {
        ...expectedSections.workspace,
        disclosureValue: "1 enabled",
      },
    },
  });
  assert.deepEqual(settingsPanelView("openIn", options, ["cursor"]), {
    appPageActive: false,
    openInPageActive: true,
    ...expectedSettingsChrome,
    header: {
      ...expectedSettingsChrome.header,
      backButton: {
        ...expectedSettingsChrome.header.backButton,
        ariaLabel: "Back to settings",
      },
    },
    titleId: "settings-panel-title",
    title: "Open in",
    subtitle: "External apps",
    workspaceTargetsSummary: "1 enabled",
    sections: {
      ...expectedSections,
      workspace: {
        ...expectedSections.workspace,
        disclosureValue: "1 enabled",
      },
    },
  });
  assert.deepEqual(settingsPanelView("main", options, ["cursor"], "win32").sections.behavior, {
    ...expectedSections.behavior,
    dockIconAvailable: false,
    rows: {
      ...expectedSections.behavior.rows,
      menuBar: "Tray",
    },
    showMenuBarIconAriaLabel: "Show tray icon",
  });
  assert.equal(settingsPanelView("main", [], ["cursor"]).workspaceTargetsSummary, "Unavailable");
  assert.equal(settingsPageAfterBack("app"), "main");
  assert.equal(settingsPageAfterBack("openIn"), "main");
  assert.equal(settingsPageAfterBack("main"), null);
  assert.equal(settingsPageAfterEscape("app"), "main");
  assert.equal(settingsPageAfterEscape("openIn"), "main");
  assert.equal(settingsPageAfterEscape("main"), null);
  assert.deepEqual(
    settingsPreferencesView({
      ...defaultPreferences,
      themeMode: "system",
      density: "comfortable",
      graphStyle: "soft",
      autoUpdateChannel: "develop",
      promptLanguage: "zh",
    }),
    {
      themeModeOptions: [
        { value: "system", label: "System", className: "is-active", ariaPressed: true, icon: "monitor" },
        { value: "light", label: "Light", className: "", ariaPressed: false, icon: "sun" },
        { value: "dark", label: "Dark", className: "", ariaPressed: false, icon: "moon" },
      ],
      densityOptions: [
        { value: "compact", label: "Compact", className: "", ariaPressed: false },
        { value: "comfortable", label: "Comfort", className: "is-active", ariaPressed: true },
      ],
      graphStyleOptions: [
        { value: "solid", label: "Solid", className: "", ariaPressed: false },
        { value: "soft", label: "Soft", className: "is-active", ariaPressed: true },
      ],
      promptLanguageOptions: [
        { value: "en", label: "English", className: "", ariaPressed: false },
        { value: "zh", label: "中文", className: "is-active", ariaPressed: true },
      ],
      autoUpdateChannelOptions: [
        { value: "stable", label: "Stable", className: "", ariaPressed: false },
        { value: "develop", label: "Develop", className: "is-active", ariaPressed: true },
      ],
      autoUpdateChannelDetail: "Latest develop candidate",
      fontFamilyOptions: [
        { value: "system", label: "System" },
        { value: "inter", label: "Inter" },
        { value: "mono", label: "Mono" },
      ],
    },
  );
  assert.deepEqual(settingsWorkspaceTargetItems(options, ["cursor", "terminal"]), [
    {
      option: options[0],
      checked: false,
      ariaLabel: "Show VS Code in open menu",
    },
    {
      option: options[1],
      checked: true,
      ariaLabel: "Show Cursor in open menu",
    },
    {
      option: options[2],
      checked: true,
      ariaLabel: "Show Terminal in open menu",
    },
  ]);
}

async function testErrorMessages(server) {
  const { errorMessage, logBridgeWarning, runBridgeSideEffect } = await loadTsModule(server, "src/lib/errorMessages.ts");

  assert.equal(errorMessage(new Error("Bridge unavailable"), "Fallback message."), "Bridge unavailable");
  assert.equal(errorMessage(new Error("   "), "Fallback message."), "Fallback message.");
  assert.equal(errorMessage("Native dialog failed", "Fallback message."), "Native dialog failed");
  assert.equal(errorMessage("   ", "Fallback message."), "Fallback message.");
  assert.equal(errorMessage({ message: "not an Error instance" }, "Fallback message."), "Fallback message.");
  assert.equal(errorMessage(null, "Fallback message."), "Fallback message.");

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    logBridgeWarning("Unable to load preferences.", new Error("Bridge unavailable"));
    runBridgeSideEffect("Unable to update pinned state.", () => {
      throw new Error("Pinned bridge failed");
    });
    runBridgeSideEffect("Unable to dock window.", () => Promise.reject(new Error("Dock bridge failed")));
    runBridgeSideEffect("No bridge available.", () => undefined);
    await Promise.resolve();
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [
    ["[Gocus] Unable to load preferences.", "Bridge unavailable"],
    ["[Gocus] Unable to update pinned state.", "Pinned bridge failed"],
    ["[Gocus] Unable to dock window.", "Dock bridge failed"],
  ]);
}

async function testBridgeAvailability(server) {
  const {
    chooseLocalWorkingFolderInElectronNotice,
    gitActionBridgeNotice,
    gitActionBridgeRequiredNotice,
    initializeRepositoryAvailabilityNotice,
    initializeRepositoryBridgeRequiredNotice,
    localFolderBridgeNotice,
    missingFolderWithoutGitNotice,
    missingWorkingFolderNotice,
    previewRefreshCompletion,
    previewRefreshDelayMs,
    previewRefreshNotice,
    refreshSnapshotAvailability,
    workspaceActionAvailabilityNotice,
  } = await loadTsModule(server, "src/lib/bridgeAvailability.ts");

  assert.equal(gitActionBridgeNotice(true), null);
  assert.equal(gitActionBridgeNotice(false), gitActionBridgeRequiredNotice);
  assert.equal(localFolderBridgeNotice("open", true), null);
  assert.equal(localFolderBridgeNotice("open", false), "Electron mode is required to open a local folder.");
  assert.equal(localFolderBridgeNotice("switch", true), null);
  assert.equal(localFolderBridgeNotice("switch", false), "Electron mode is required to switch local folders.");
  assert.equal(
    initializeRepositoryAvailabilityNotice({ bridgeAvailable: true, hasFolderWithoutGit: false }),
    missingFolderWithoutGitNotice,
  );
  assert.equal(
    initializeRepositoryAvailabilityNotice({ bridgeAvailable: false, hasFolderWithoutGit: true }),
    initializeRepositoryBridgeRequiredNotice,
  );
  assert.equal(initializeRepositoryAvailabilityNotice({ bridgeAvailable: true, hasFolderWithoutGit: true }), null);
  assert.deepEqual(refreshSnapshotAvailability({ bridgeAvailable: true, hasSnapshot: false }), { kind: "bridge" });
  assert.deepEqual(refreshSnapshotAvailability({ bridgeAvailable: false, hasSnapshot: true }), { kind: "preview" });
  assert.deepEqual(refreshSnapshotAvailability({ bridgeAvailable: false, hasSnapshot: false }), {
    kind: "blocked",
    notice: chooseLocalWorkingFolderInElectronNotice,
  });
  assert.equal(previewRefreshDelayMs, 400);
  assert.equal(previewRefreshNotice, "Preview refreshed.");
  assert.deepEqual(previewRefreshCompletion(), {
    delayMs: previewRefreshDelayMs,
    notice: previewRefreshNotice,
  });
  assert.equal(workspaceActionAvailabilityNotice({ bridgeAvailable: true, hasSnapshot: true }), null);
  assert.equal(
    workspaceActionAvailabilityNotice({ bridgeAvailable: false, hasSnapshot: true }),
    missingWorkingFolderNotice,
  );
  assert.equal(
    workspaceActionAvailabilityNotice({ bridgeAvailable: true, hasSnapshot: false }),
    missingWorkingFolderNotice,
  );
}

async function testDevWebBridge(server) {
  const { devWebBridgeUrl, isLocalDevBridgeHost } = await loadTsModule(server, "src/lib/devWebBridge.ts");
  const { gitHubReleasesUrl } = await loadTsModule(server, "src/lib/releaseLinks.ts");

  assert.equal(isLocalDevBridgeHost("localhost"), true);
  assert.equal(isLocalDevBridgeHost("127.0.0.1"), true);
  assert.equal(isLocalDevBridgeHost("example.com"), false);
  assert.equal(devWebBridgeUrl("getSnapshot"), "/__git_peek_dev_bridge/getSnapshot");
  assert.equal(gitHubReleasesUrl, "https://github.com/jarvisluk/gocus/releases");
}

async function testPathAndFileStatus(server) {
  const { parentPathName, pathName, recentRepositoryLabel } = await loadTsModule(server, "src/lib/pathLabels.ts");
  const { fileKind, formatPath, statusLetter } = await loadTsModule(server, "src/lib/fileStatus.ts");

  assert.equal(pathName("/Users/junrong/codespace/git-tree-vis/"), "git-tree-vis");
  assert.equal(pathName("C:\\Users\\junrong\\repo"), "repo");
  assert.equal(parentPathName("/Users/junrong/codespace/git-tree-vis"), "codespace");
  assert.equal(parentPathName("repo"), "");
  assert.equal(
    recentRepositoryLabel({
      path: "/Users/junrong/codespace/git-tree-vis",
      name: "git-tree-vis",
      repositoryKey: "git-tree-vis:/Users/junrong/codespace/git-tree-vis",
    }),
    "git-tree-vis - codespace",
  );

  assert.equal(
    fileKind({
      path: "src/App.tsx",
      status: " M",
      indexStatus: " ",
      workingTreeStatus: "M",
      additions: 3,
      deletions: 1,
    }),
    "modified",
  );
  assert.equal(
    fileKind({
      path: "src/new.ts",
      status: "A ",
      indexStatus: "A",
      workingTreeStatus: " ",
      additions: 1,
      deletions: 0,
    }),
    "staged",
  );
  assert.equal(
    fileKind({
      path: "src/untracked.ts",
      status: "??",
      indexStatus: "?",
      workingTreeStatus: "?",
      additions: 0,
      deletions: 0,
    }),
    "untracked",
  );
  assert.equal(
    fileKind({
      path: "src/conflict.ts",
      status: "UU",
      indexStatus: "U",
      workingTreeStatus: "U",
      additions: 0,
      deletions: 0,
    }),
    "modified",
  );
  assert.equal(
    statusLetter({ path: "README.md", status: "R ", indexStatus: "R", workingTreeStatus: " ", additions: 1, deletions: 1 }),
    "R",
  );
  assert.equal(
    statusLetter({ path: "src/conflict.ts", status: "UU", indexStatus: "U", workingTreeStatus: "U", additions: 0, deletions: 0 }),
    "!",
  );
  assert.equal(
    statusLetter({
      path: "src/App.tsx",
      status: " M",
      indexStatus: " ",
      workingTreeStatus: "M",
      additions: 3,
      deletions: 1,
    }),
    "M",
  );
  assert.equal(
    statusLetter({ path: "src/old.ts", status: " D", indexStatus: " ", workingTreeStatus: "D", additions: 0, deletions: 4 }),
    "D",
  );
  assert.equal(formatPath("src/components/RecentCommits.tsx"), "src/components/RecentCommits.tsx");
}

function changedFile(overrides = {}) {
  return {
    path: "src/components/ChangedNow.tsx",
    status: " M",
    indexStatus: " ",
    workingTreeStatus: "M",
    statusLabel: "Modified",
    additions: 12,
    deletions: 2,
    ...overrides,
  };
}

async function testCommitPrompt(server) {
  const { changedFileKey } = await loadTsModule(server, "src/lib/changedFileIdentity.ts");
  const { changedFilesCommitPrompt } = await loadTsModule(server, "src/lib/commitPrompt.ts");
  const modified = changedFile();
  const renamed = changedFile({
    path: "src/components/ChangedFiles.tsx",
    originalPath: "src/components/ChangedNow.tsx",
    status: "R ",
    indexStatus: "R",
    workingTreeStatus: " ",
    statusLabel: "Renamed",
    additions: 1,
    deletions: 1,
  });

  assert.equal(changedFileKey(modified), " M-src/components/ChangedNow.tsx-");
  assert.equal(changedFileKey(renamed), "R -src/components/ChangedFiles.tsx-src/components/ChangedNow.tsx");

  const englishPrompt = changedFilesCommitPrompt("en");
  assert.ok(englishPrompt.includes("Run or review the necessary git status / git diff"));
  assert.ok(englishPrompt.includes("use the current working tree as the source of truth"));
  assert.ok(englishPrompt.includes("Do not run git commit before Yes"));
  assert.doesNotMatch(englishPrompt, /Current Changed Now list/);
  assert.doesNotMatch(englishPrompt, /src\/components\/ChangedFiles\.tsx/);

  const chinesePrompt = changedFilesCommitPrompt("zh");
  assert.ok(chinesePrompt.includes("先运行或阅读必要的 git status / git diff"));
  assert.ok(chinesePrompt.includes("以当前 working tree 为准"));
  assert.ok(chinesePrompt.includes("在 Yes 前不要执行 git commit"));
  assert.doesNotMatch(chinesePrompt, /Changed Now 当前列表/);
  assert.doesNotMatch(chinesePrompt, /No files in the current Changed Now filter/);
}

async function testCopyText(server) {
  const { copyTextTarget, copyTextWithFallback, readTextWithFallback } = await loadTsModule(server, "src/lib/copyText.ts");
  const calls = [];
  const bridge = {
    copyText: async (text) => calls.push(`bridge:${text}`),
  };
  const clipboard = {
    writeText: async (text) => calls.push(`clipboard:${text}`),
  };

  assert.equal(copyTextTarget({ bridge, clipboard }), "bridge");
  assert.equal(copyTextTarget({ bridge: null, clipboard }), "clipboard");
  assert.equal(copyTextTarget({ bridge: null, clipboard: null }), "unavailable");
  assert.equal(await copyTextWithFallback("hello", { bridge, clipboard }), "bridge");
  assert.deepEqual(calls, ["bridge:hello"]);

  calls.length = 0;
  assert.equal(await copyTextWithFallback("fallback", { clipboard }), "clipboard");
  assert.deepEqual(calls, ["clipboard:fallback"]);

  calls.length = 0;
  await assert.rejects(
    () =>
      copyTextWithFallback("fail", {
        bridge: {
          copyText: async (text) => {
            calls.push(`bridge:${text}`);
            throw new Error("bridge failed");
          },
        },
      }),
    /bridge failed/,
  );
  assert.deepEqual(calls, ["bridge:fail"]);

  calls.length = 0;
  assert.equal(
    await copyTextWithFallback("bridge-error", {
      bridge: {
        copyText: async (text) => {
          calls.push(`bridge:${text}`);
          throw new Error("bridge failed");
        },
      },
      clipboard,
    }),
    "clipboard",
  );
  assert.deepEqual(calls, ["bridge:bridge-error", "clipboard:bridge-error"]);

  calls.length = 0;
  await assert.rejects(
    () =>
      copyTextWithFallback("fail", {
        bridge: {
          copyText: async (text) => {
            calls.push(`bridge:${text}`);
            throw new Error("bridge failed");
          },
        },
        clipboard: {
          writeText: async (text) => {
            calls.push(`clipboard:${text}`);
            throw new Error("clipboard failed");
          },
        },
      }),
    /clipboard failed/,
  );
  assert.deepEqual(calls, ["bridge:fail", "clipboard:fail"]);
  await assert.rejects(() => copyTextWithFallback("missing", {}), /Clipboard is unavailable/);

  assert.equal(
    await readTextWithFallback({
      bridge: {
        readText: async () => "bridge text",
      },
      clipboard: {
        readText: async () => "clipboard text",
      },
    }),
    "bridge text",
  );
  assert.equal(
    await readTextWithFallback({
      bridge: {
        readText: async () => {
          throw new Error("bridge failed");
        },
      },
      clipboard: {
        readText: async () => "clipboard fallback",
      },
    }),
    "clipboard fallback",
  );
  await assert.rejects(
    () =>
      readTextWithFallback({
        bridge: {
          readText: async () => {
            throw new Error("read failed");
          },
        },
      }),
    /read failed/,
  );
  await assert.rejects(() => readTextWithFallback({}), /Clipboard is unavailable/);
}

async function testDismissableLayer(server) {
  const {
    dismissableLayerContainsTarget,
    dismissableLayerConsumesOutsideInteraction,
    dismissableLayerEventForTiming,
    dismissableLayerShouldDismissKey,
    dismissableLayerShouldDismissPointer,
    dismissableLayerTargetsOverlap,
  } = await loadTsModule(server, "src/lib/useDismissableLayer.ts");
  const inside = { nodeType: 1 };
  const outside = { nodeType: 1 };
  const child = { nodeType: 1 };
  const host = {
    contains: (target) => target === inside,
  };
  const parent = {
    nodeType: 1,
    contains: (target) => target === child,
  };
  const refs = [{ current: host }];

  assert.equal(dismissableLayerContainsTarget(refs, inside), true);
  assert.equal(dismissableLayerContainsTarget(refs, outside), false);
  assert.equal(dismissableLayerContainsTarget([{ current: null }], inside), false);
  assert.equal(dismissableLayerContainsTarget(refs, null), false);
  assert.equal(dismissableLayerContainsTarget(refs, { detail: "not a node" }), false);

  assert.equal(dismissableLayerShouldDismissPointer(refs, inside), false);
  assert.equal(dismissableLayerShouldDismissPointer(refs, outside), true);
  assert.equal(dismissableLayerShouldDismissPointer(refs, null), true);

  assert.equal(dismissableLayerShouldDismissKey("Escape"), true);
  assert.equal(dismissableLayerShouldDismissKey("Enter"), false);
  assert.equal(dismissableLayerShouldDismissKey("Esc"), false);

  assert.equal(dismissableLayerEventForTiming("beforeTargetAction"), "pointerdown");
  assert.equal(dismissableLayerEventForTiming("afterTargetAction"), "click");
  assert.equal(dismissableLayerConsumesOutsideInteraction("beforeTargetAction"), true);
  assert.equal(dismissableLayerConsumesOutsideInteraction("afterTargetAction"), false);
  assert.equal(dismissableLayerTargetsOverlap(inside, inside), true);
  assert.equal(dismissableLayerTargetsOverlap(parent, child), true);
  assert.equal(dismissableLayerTargetsOverlap(child, parent), true);
  assert.equal(dismissableLayerTargetsOverlap(inside, outside), false);
  assert.equal(dismissableLayerTargetsOverlap(null, outside), false);
}

async function testChangedNowView(server) {
  const {
    changedNowCopyButtonView,
    changedNowPanelView,
    changedNowTitleId,
    copyPromptStateResetDelayMs,
    temporaryCopyPromptFeedback,
  } = await loadTsModule(server, "src/lib/changedNowView.ts");

  assert.equal(copyPromptStateResetDelayMs, 1400);
  assert.equal(changedNowTitleId, "changed-now-title");
  assert.deepEqual(temporaryCopyPromptFeedback({ timerActive: false, nextState: "copied" }), {
    clearExistingTimer: false,
    nextState: "copied",
    resetDelayMs: 1400,
  });
  assert.deepEqual(temporaryCopyPromptFeedback({ timerActive: true, nextState: "failed" }), {
    clearExistingTimer: true,
    nextState: "failed",
    resetDelayMs: 1400,
  });
  assert.deepEqual(changedNowPanelView(), {
    section: {
      className: "changed-section",
      ariaLabelledBy: "changed-now-title",
    },
    heading: {
      className: "section-heading compact",
    },
    titleId: "changed-now-title",
    title: "Changed now",
    tools: {
      className: "heading-tools",
    },
    fileList: {
      className: "file-list",
      id: "changed-now-file-list",
    },
    closeButton: {
      ariaLabel: "Close changed files window",
      tooltip: "Close window",
    },
  });
  assert.deepEqual(changedNowCopyButtonView("idle"), {
    label: "Copy prompt to commit changes",
    title: "Copy prompt to commit changes",
    icon: "copy",
  });
  assert.deepEqual(changedNowCopyButtonView("copied"), {
    label: "Copied prompt",
    title: "Copied",
    icon: "check",
  });
  assert.deepEqual(changedNowCopyButtonView("failed"), {
    label: "Copy failed",
    title: "Copy failed",
    icon: "x",
  });
}

async function testChangedFilesView(server) {
  const {
    changedFilesHiddenCountLabel,
    changedFilesView,
    filteredChangedFiles,
    visibleChangedFiles,
  } = await loadTsModule(server, "src/lib/changedFilesView.ts");
  const modified = changedFile({ path: "src/modified.ts", status: " M", indexStatus: " ", workingTreeStatus: "M" });
  const staged = changedFile({ path: "src/staged.ts", status: "A ", indexStatus: "A", workingTreeStatus: " " });
  const untracked = changedFile({ path: "src/untracked.ts", status: "??", indexStatus: "?", workingTreeStatus: "?" });
  const files = [modified, staged, untracked];

  assert.deepEqual(filteredChangedFiles(files, "all"), files);
  assert.deepEqual(filteredChangedFiles(files, "modified"), [modified]);
  assert.deepEqual(filteredChangedFiles(files, "staged"), [staged]);
  assert.deepEqual(filteredChangedFiles(files, "untracked"), [untracked]);
  assert.deepEqual(visibleChangedFiles(files), files);

  const manyFiles = Array.from({ length: 10 }, (_, index) => changedFile({ path: `src/file-${index}.ts` }));
  const view = changedFilesView(manyFiles, "all");
  assert.equal(view.filteredFiles.length, 10);
  assert.equal(view.filteredCount, 10);
  assert.equal(view.visibleFiles.length, 10);
  assert.equal(view.hiddenCount, 0);
  assert.equal(view.hiddenCountLabel, "");
  assert.equal(view.showFiles, true);
  assert.equal(view.showHiddenCount, false);
  assert.deepEqual(view.hiddenCountView, {
    className: "file-list-more",
    role: "status",
    ariaLive: "polite",
  });
  assert.equal(view.emptyMessage, "No files in this view.");
  assert.deepEqual(view.emptyState, {
    className: "empty-state",
    role: "status",
    ariaLive: "polite",
    message: "No files in this view.",
  });
  assert.deepEqual(changedFilesView([], "all"), {
    filteredFiles: [],
    filteredCount: 0,
    visibleFiles: [],
    hiddenCount: 0,
    hiddenCountLabel: "",
    showFiles: false,
    showHiddenCount: false,
    hiddenCountView: {
      className: "file-list-more",
      role: "status",
      ariaLive: "polite",
    },
    emptyMessage: "No files in this view.",
    emptyState: {
      className: "empty-state",
      role: "status",
      ariaLive: "polite",
      message: "No files in this view.",
    },
  });
  assert.equal(changedFilesHiddenCountLabel(0), "");
  assert.equal(changedFilesHiddenCountLabel(1), "");
  assert.equal(changedFilesHiddenCountLabel(2), "");
}

async function testChangedFileView(server) {
  const {
    changedFileDeltaItems,
    changedFileDeltaView,
    changedFileInfoOpenButtonView,
    changedFileInfoPanelView,
    changedFileInfoTitleId,
    changedFileRowView,
    changedFileView,
  } = await loadTsModule(server, "src/lib/changedFileView.ts");
  const modified = changedFile();
  const renamed = changedFile({
    path: "src/components/ChangedFiles.tsx",
    originalPath: "src/components/ChangedNow.tsx",
    status: "R ",
    indexStatus: "R",
    workingTreeStatus: " ",
    statusLabel: "Renamed",
    additions: 1,
    deletions: 1,
  });
  const zeroDelta = changedFile({
    path: "README.md",
    status: "  ",
    indexStatus: " ",
    workingTreeStatus: " ",
    statusLabel: "Touched",
    additions: 0,
    deletions: 0,
  });
  const conflicted = changedFile({
    path: "src/conflict.ts",
    status: "UU",
    indexStatus: "U",
    workingTreeStatus: "U",
    statusLabel: "Conflicted",
    additions: 0,
    deletions: 0,
  });

  assert.deepEqual(changedFileDeltaView(modified), {
    additionsLabel: "+12",
    deletionsLabel: "-2",
    emptyLabel: "",
  });
  assert.deepEqual(changedFileDeltaView(zeroDelta), {
    additionsLabel: "",
    deletionsLabel: "",
    emptyLabel: "0",
  });
  assert.deepEqual(changedFileDeltaItems(changedFileDeltaView(modified)), [
    { key: "additions", label: "+12", className: "additions" },
    { key: "deletions", label: "-2", className: "deletions" },
  ]);
  assert.deepEqual(changedFileDeltaItems(changedFileDeltaView(zeroDelta)), [{ key: "empty", label: "0" }]);

  assert.deepEqual(changedFileView(renamed), {
    key: "R -src/components/ChangedFiles.tsx-src/components/ChangedNow.tsx",
    kind: "staged",
    statusLetter: "R",
    gitStatus: "R",
    pathLabel: "src/components/ChangedFiles.tsx",
    originalPathLabel: "src/components/ChangedNow.tsx",
    statusDetail: "Renamed from src/components/ChangedNow.tsx",
    delta: {
      additionsLabel: "+1",
      deletionsLabel: "-1",
      emptyLabel: "",
    },
  });
  assert.equal(changedFileView(zeroDelta).gitStatus, "?");
  assert.equal(changedFileView(zeroDelta).statusDetail, "Touched");
  assert.equal(changedFileView(conflicted).statusLetter, "!");
  assert.equal(changedFileView(conflicted).statusDetail, "Conflicted");

  const modifiedView = changedFileView(modified);
  const selectedRow = changedFileRowView(modified, modifiedView.key);
  const idleRow = changedFileRowView(modified, "");

  assert.equal(selectedRow.selected, true);
  assert.equal(selectedRow.className, "file-row is-selected");
  assert.equal(selectedRow.ariaPressed, true);
  assert.equal(selectedRow.title, modified.path);
  assert.equal(selectedRow.badgeClassName, "file-badge modified");
  assert.equal(selectedRow.copyClassName, "file-copy");
  assert.equal(selectedRow.pathClassName, "file-path");
  assert.equal(selectedRow.detailClassName, "file-detail");
  assert.equal(selectedRow.deltaClassName, "file-delta");
  assert.equal(selectedRow.file.key, modifiedView.key);
  assert.equal(idleRow.selected, false);
  assert.equal(idleRow.className, "file-row");
  assert.equal(idleRow.ariaPressed, false);
  assert.equal(changedFileInfoTitleId, "changed-file-details-title");
  assert.deepEqual(changedFileInfoOpenButtonView({ target: "cursor", label: "Cursor", iconSrc: "cursor.png" }), {
    className: "ui-icon-button changed-side-open-button",
    iconClassName: "external-app-icon",
    ariaLabel: "Open file in Cursor",
    title: "Open file in Cursor",
  });
  assert.equal(changedFileInfoOpenButtonView(null), null);

  assert.deepEqual(changedFileInfoPanelView(renamed), {
    panel: {
      className: "changed-side-panel",
      ariaLabelledBy: "changed-file-details-title",
    },
    titleId: "changed-file-details-title",
    header: {
      className: "changed-side-header",
    },
    file: changedFileView(renamed),
    badgeClassName: "file-badge staged",
    statusLabel: "Renamed",
    closeButton: {
      className: "ui-icon-button",
      ariaLabel: "Close changed file details",
    },
    facts: {
      kindLabel: "Kind",
      gitLabel: "Git",
      changesLabel: "Changes",
      pathLabel: "Path",
      originalPathLabel: "From",
    },
    factsListClassName: "changed-side-facts",
    deltaClassName: "changed-side-delta",
    wideFactClassName: "is-wide",
    pathText: renamed.path,
    pathTitle: renamed.path,
    showOriginalPath: true,
    originalPathTitle: renamed.originalPath,
  });
  assert.deepEqual(changedFileInfoPanelView(modified), {
    panel: {
      className: "changed-side-panel",
      ariaLabelledBy: "changed-file-details-title",
    },
    titleId: "changed-file-details-title",
    header: {
      className: "changed-side-header",
    },
    file: modifiedView,
    badgeClassName: "file-badge modified",
    statusLabel: "Modified",
    closeButton: {
      className: "ui-icon-button",
      ariaLabel: "Close changed file details",
    },
    facts: {
      kindLabel: "Kind",
      gitLabel: "Git",
      changesLabel: "Changes",
      pathLabel: "Path",
      originalPathLabel: "From",
    },
    factsListClassName: "changed-side-facts",
    deltaClassName: "changed-side-delta",
    wideFactClassName: "is-wide",
    pathText: modified.path,
    pathTitle: modified.path,
    showOriginalPath: false,
    originalPathTitle: undefined,
  });
}

async function testChangedFilesTemporaryInfo(server) {
  const { changedFilesTemporaryInfoPayload } = await loadTsModule(server, "src/lib/changedFilesTemporaryInfo.ts");
  const modified = changedFile();
  const snapshot = { changedFiles: [modified] };
  const baseOptions = {
    snapshot,
    changedNowWindowOpen: true,
    collapsed: false,
    collapsedRailChangedNowOpen: false,
    settingsOpen: false,
    workspaceOpenTarget: "cursor",
  };

  assert.deepEqual(changedFilesTemporaryInfoPayload(baseOptions), {
    kind: "changed-files",
    files: [modified],
    filter: "all",
    selectedFileKey: "",
    workspaceOpenTarget: "cursor",
  });
  assert.equal(changedFilesTemporaryInfoPayload({ ...baseOptions, snapshot: null }), null);
  assert.equal(changedFilesTemporaryInfoPayload({ ...baseOptions, changedNowWindowOpen: false }), null);
  assert.equal(changedFilesTemporaryInfoPayload({ ...baseOptions, collapsed: true, collapsedRailChangedNowOpen: false }), null);
  assert.deepEqual(
    changedFilesTemporaryInfoPayload({
      ...baseOptions,
      collapsed: true,
      collapsedRailChangedNowOpen: true,
    })?.files,
    [modified],
  );
  assert.equal(changedFilesTemporaryInfoPayload({ ...baseOptions, settingsOpen: true }), null);
}

async function testTemporaryInfoPanelBridge(server) {
  const { runTemporaryInfoPanelBridgeSideEffect, temporaryInfoPanelBridgeRequest } = await loadTsModule(
    server,
    "src/lib/temporaryInfoPanelBridge.ts",
  );
  const payload = {
    kind: "changed-files",
    files: [changedFile()],
    filter: "all",
    selectedFileKey: "",
  };

  assert.equal(temporaryInfoPanelBridgeRequest("open", null), null);
  assert.deepEqual(temporaryInfoPanelBridgeRequest("open", payload), {
    failureNotice: "Unable to open temporary info panel.",
    payload,
  });
  assert.deepEqual(temporaryInfoPanelBridgeRequest("update", payload), {
    failureNotice: "Unable to update temporary info panel.",
    payload,
  });
  assert.deepEqual(temporaryInfoPanelBridgeRequest("update", null), {
    failureNotice: "Unable to update temporary info panel.",
    payload: null,
  });
  assert.deepEqual(temporaryInfoPanelBridgeRequest("close", payload), {
    failureNotice: "Unable to close temporary info panel.",
    payload: null,
  });
  assert.deepEqual(temporaryInfoPanelBridgeRequest("clear"), {
    failureNotice: "Unable to clear temporary info panel.",
    payload: null,
  });

  const sideEffectPayloads = [];
  const recordPayload = (nextPayload) => {
    sideEffectPayloads.push(nextPayload);
  };
  assert.equal(runTemporaryInfoPanelBridgeSideEffect("open", recordPayload), false);
  assert.deepEqual(sideEffectPayloads, []);
  assert.equal(runTemporaryInfoPanelBridgeSideEffect("open", recordPayload, payload), true);
  assert.deepEqual(sideEffectPayloads, [payload]);
  assert.equal(runTemporaryInfoPanelBridgeSideEffect("close", recordPayload), true);
  assert.deepEqual(sideEffectPayloads, [payload, null]);
  assert.equal(runTemporaryInfoPanelBridgeSideEffect("clear", undefined), true);
}

async function testCommitInfoPanelBridge(server) {
  const { commitInfoPanelBridgeRequest, runCommitInfoPanelBridgeSideEffect } = await loadTsModule(
    server,
    "src/lib/commitInfoPanelBridge.ts",
  );
  const payload = {
    kind: "commit",
    commit: commit({ id: "hover" }),
    anchorBounds: { top: 148, height: 96 },
  };

  assert.equal(commitInfoPanelBridgeRequest("open", null), null);
  assert.deepEqual(commitInfoPanelBridgeRequest("open", payload), {
    failureNotice: "Unable to open commit info panel.",
    payload,
  });
  assert.deepEqual(commitInfoPanelBridgeRequest("update", payload), {
    failureNotice: "Unable to update commit info panel.",
    payload,
  });
  assert.deepEqual(commitInfoPanelBridgeRequest("update", null), {
    failureNotice: "Unable to update commit info panel.",
    payload: null,
  });
  assert.deepEqual(commitInfoPanelBridgeRequest("close", payload), {
    failureNotice: "Unable to close commit info panel.",
    payload: null,
  });
  assert.deepEqual(commitInfoPanelBridgeRequest("clear"), {
    failureNotice: "Unable to clear commit info panel.",
    payload: null,
  });

  const sideEffectPayloads = [];
  const recordPayload = (nextPayload) => {
    sideEffectPayloads.push(nextPayload);
  };
  assert.equal(runCommitInfoPanelBridgeSideEffect("open", recordPayload), false);
  assert.deepEqual(sideEffectPayloads, []);
  assert.equal(runCommitInfoPanelBridgeSideEffect("open", recordPayload, payload), true);
  assert.deepEqual(sideEffectPayloads, [payload]);
  assert.equal(runCommitInfoPanelBridgeSideEffect("close", recordPayload), true);
  assert.deepEqual(sideEffectPayloads, [payload, null]);
  assert.equal(runCommitInfoPanelBridgeSideEffect("clear", undefined), true);
}

async function testCommitInfoPreviewPanel(server) {
  const { useCommitInfoPreviewPanel } = await loadTsModule(server, "src/lib/useCommitInfoPreviewPanel.ts");
  const {
    commitInfoPreviewCloseDelayMs,
    commitInfoPreviewShouldCloseAfterBlur,
    commitInfoPreviewShouldCloseForSelection,
  } = await loadTsModule(server, "src/lib/commitInfoPreviewPanel.ts");

  assert.equal(typeof useCommitInfoPreviewPanel, "function");
  assert.equal(commitInfoPreviewCloseDelayMs, 80);
  assert.equal(commitInfoPreviewShouldCloseForSelection("", "hover"), true);
  assert.equal(commitInfoPreviewShouldCloseForSelection("selected", ""), false);
  assert.equal(commitInfoPreviewShouldCloseForSelection("selected", "selected"), false);
  assert.equal(commitInfoPreviewShouldCloseForSelection("selected", "other"), true);
  assert.equal(commitInfoPreviewShouldCloseAfterBlur({ closeToken: 2, currentToken: 2, commitInfoPanelActive: false }), true);
  assert.equal(commitInfoPreviewShouldCloseAfterBlur({ closeToken: 2, currentToken: 2, commitInfoPanelActive: true }), false);
  assert.equal(commitInfoPreviewShouldCloseAfterBlur({ closeToken: 1, currentToken: 2, commitInfoPanelActive: false }), false);
}

async function testChangedNowWindowState(server) {
  const {
    changedNowToggleResult,
    changedNowWindowState,
    closedChangedNowWindowState,
  } = await loadTsModule(server, "src/lib/changedNowWindowState.ts");

  assert.deepEqual(changedNowWindowState(closedChangedNowWindowState, "toggleFromPanel"), {
    windowOpen: true,
    collapsedRailOpen: false,
  });
  assert.deepEqual(changedNowWindowState({ windowOpen: true, collapsedRailOpen: false }, "toggleFromPanel"), closedChangedNowWindowState);
  assert.deepEqual(changedNowWindowState(closedChangedNowWindowState, "toggleFromCollapsedRail"), {
    windowOpen: true,
    collapsedRailOpen: true,
  });
  assert.deepEqual(
    changedNowWindowState({ windowOpen: true, collapsedRailOpen: true }, "toggleFromCollapsedRail"),
    closedChangedNowWindowState,
  );
  assert.deepEqual(changedNowWindowState({ windowOpen: true, collapsedRailOpen: true }, "expandPanel"), {
    windowOpen: true,
    collapsedRailOpen: false,
  });
  assert.deepEqual(changedNowWindowState({ windowOpen: true, collapsedRailOpen: false }, "expandPanel"), {
    windowOpen: true,
    collapsedRailOpen: false,
  });
  assert.deepEqual(changedNowWindowState({ windowOpen: true, collapsedRailOpen: true }, "close"), closedChangedNowWindowState);
  assert.deepEqual(changedNowToggleResult({ source: "panel", windowOpen: false, hasTemporaryInfoPayload: true }), {
    windowAction: "toggleFromPanel",
    temporaryInfoPanelAction: "open",
  });
  assert.deepEqual(changedNowToggleResult({ source: "panel", windowOpen: false, hasTemporaryInfoPayload: false }), {
    windowAction: "toggleFromPanel",
    temporaryInfoPanelAction: null,
  });
  assert.deepEqual(changedNowToggleResult({ source: "collapsedRail", windowOpen: false, hasTemporaryInfoPayload: true }), {
    windowAction: "toggleFromCollapsedRail",
    temporaryInfoPanelAction: null,
  });
  assert.deepEqual(changedNowToggleResult({ source: "collapsedRail", windowOpen: true, hasTemporaryInfoPayload: true }), {
    windowAction: "close",
    temporaryInfoPanelAction: "close",
  });
}

async function testTemporaryInfoSelection(server) {
  const {
    changedFilesSelectedFileKey,
    selectedChangedFile,
    temporaryInfoWindowView,
  } = await loadTsModule(server, "src/lib/temporaryInfoSelection.ts");
  const { changedFileKey } = await loadTsModule(server, "src/lib/changedFileIdentity.ts");
  const first = changedFile({ path: "src/first.ts" });
  const second = changedFile({ path: "src/second.ts", statusLabel: "Second" });
  const staged = changedFile({ path: "src/staged.ts", status: "A ", indexStatus: "A", workingTreeStatus: " ", statusLabel: "Added" });
  const firstKey = changedFileKey(first);
  const secondKey = changedFileKey(second);
  const stagedKey = changedFileKey(staged);
  const temporaryInfoChrome = {
    viewport: {
      className: "temporary-info-viewport is-electron",
    },
    panel: {
      className: "peek-panel temporary-info-panel",
      ariaLabel: "Changed files window",
    },
    emptyState: {
      className: "temporary-info-empty",
      ariaLabel: "Temporary information",
      role: "status",
      ariaLive: "polite",
      message: "No file selected.",
    },
  };
  assert.equal(selectedChangedFile([first, second], secondKey), second);
  assert.equal(selectedChangedFile([first, staged], firstKey, "modified"), first);
  assert.equal(selectedChangedFile([first, staged], firstKey, "staged"), null);
  assert.equal(selectedChangedFile([first, staged], stagedKey, "staged"), staged);
  assert.equal(selectedChangedFile([first], secondKey), null);
  assert.equal(selectedChangedFile([first], ""), null);
  assert.equal(changedFilesSelectedFileKey(null, secondKey), "");
  assert.equal(
    changedFilesSelectedFileKey(
      { kind: "changed-files", files: [first, second], filter: "all", selectedFileKey: secondKey },
      firstKey,
    ),
    secondKey,
  );
  assert.equal(
    changedFilesSelectedFileKey(
      { kind: "changed-files", files: [first, second], filter: "all", selectedFileKey: "" },
      firstKey,
    ),
    firstKey,
  );
  assert.equal(changedFilesSelectedFileKey({ kind: "changed-files", files: [first], filter: "all", selectedFileKey: "" }, secondKey), "");
  assert.equal(
    changedFilesSelectedFileKey(
      { kind: "changed-files", files: [first, staged], filter: "staged", selectedFileKey: firstKey },
      "",
    ),
    "",
  );
  assert.equal(
    changedFilesSelectedFileKey(
      { kind: "changed-files", files: [first, staged], filter: "staged", selectedFileKey: "" },
      stagedKey,
    ),
    stagedKey,
  );
  assert.deepEqual(temporaryInfoWindowView(null, secondKey), {
    ...temporaryInfoChrome,
    changedFilesPayload: null,
    selectedFile: null,
    showChangedFiles: false,
    showSelectedFile: false,
  });
  assert.deepEqual(
    temporaryInfoWindowView(
      { kind: "changed-files", files: [first, second], filter: "all", selectedFileKey: "" },
      secondKey,
    ),
    {
      ...temporaryInfoChrome,
      changedFilesPayload: { kind: "changed-files", files: [first, second], filter: "all", selectedFileKey: "" },
      selectedFile: second,
      showChangedFiles: true,
      showSelectedFile: true,
    },
  );
  assert.deepEqual(
    temporaryInfoWindowView(
      { kind: "changed-files", files: [first, staged], filter: "staged", selectedFileKey: "" },
      firstKey,
    ),
    {
      ...temporaryInfoChrome,
      changedFilesPayload: { kind: "changed-files", files: [first, staged], filter: "staged", selectedFileKey: "" },
      selectedFile: null,
      showChangedFiles: true,
      showSelectedFile: false,
    },
  );
}

async function testRecentRepositories(server) {
  const {
    dedupeRecentRepositories,
    isSameRecentRepository,
    maxEmptyStateRecentRepositories,
    maxRecentRepositories,
    recentRepositoriesWithCurrent,
    recentRepositoryHiddenCountLabel,
    recentRepositoryPreview,
    recentRepositoryFromSnapshot,
    upsertRecentRepository,
  } = await loadTsModule(server, "src/lib/recentRepositories.ts");
  const current = {
    path: "/Users/junrong/codespace/git-tree-vis",
    name: "git-tree-vis",
    repositoryKey: "git:/Users/junrong/codespace/git-tree-vis/.git",
  };
  const sameRepositoryDifferentPath = {
    path: "/Users/junrong/codespace/git-tree-vis-linked",
    name: "git-tree-vis-linked",
    repositoryKey: current.repositoryKey,
  };
  const samePathLegacyKey = {
    path: current.path,
    name: "legacy-git-tree-vis",
    repositoryKey: `path:${current.path}`,
  };
  const other = {
    path: "/Users/junrong/codespace/other",
    name: "other",
    repositoryKey: "git:/Users/junrong/codespace/other/.git",
  };
  const snapshot = {
    repoPath: current.path,
    repoName: "",
    repositoryKey: current.repositoryKey,
  };

  assert.equal(maxRecentRepositories, 8);
  assert.equal(maxEmptyStateRecentRepositories, 4);
  assert.equal(recentRepositoryFromSnapshot(snapshot).name, "git-tree-vis");
  assert.equal(isSameRecentRepository(current, sameRepositoryDifferentPath), true);
  assert.equal(isSameRecentRepository(current, samePathLegacyKey), true);
  assert.equal(isSameRecentRepository(current, other), false);
  assert.deepEqual(
    dedupeRecentRepositories([current, sameRepositoryDifferentPath, samePathLegacyKey, other]).map((repository) => repository.name),
    ["git-tree-vis", "other"],
  );
  assert.deepEqual(upsertRecentRepository([sameRepositoryDifferentPath, samePathLegacyKey, other], current, 2), [current, other]);
  assert.deepEqual(
    recentRepositoriesWithCurrent(snapshot, [sameRepositoryDifferentPath, samePathLegacyKey, other]).map((repository) => repository.name),
    ["git-tree-vis", "other"],
  );
  assert.equal(recentRepositoryHiddenCountLabel(0), "");
  assert.equal(recentRepositoryHiddenCountLabel(1), "+1 more repository");
  assert.equal(recentRepositoryHiddenCountLabel(2), "+2 more repositories");
  assert.deepEqual(recentRepositoryPreview([current, sameRepositoryDifferentPath, samePathLegacyKey, other], 2), {
    visibleRepositories: [current, sameRepositoryDifferentPath],
    hiddenCount: 2,
    hiddenCountLabel: "+2 more repositories",
  });
}

async function testEmptyRepositoryView(server) {
  const { emptyRepositoryFolderPathView, emptyRepositoryNoticeView, emptyRepositoryTitleId, emptyRepositoryView } = await loadTsModule(
    server,
    "src/lib/emptyRepositoryView.ts",
  );
  const recentRepositories = [
    {
      path: "/Users/junrong/codespace/git-tree-vis",
      name: "git-tree-vis",
      repositoryKey: "git:/Users/junrong/codespace/git-tree-vis/.git",
    },
    {
      path: "/Users/junrong/Desktop/demo",
      name: "demo",
      repositoryKey: "git:/Users/junrong/Desktop/demo/.git",
    },
    {
      path: "/Users/junrong/Documents/another",
      name: "another",
      repositoryKey: "git:/Users/junrong/Documents/another/.git",
    },
    {
      path: "/Users/junrong/Documents/fourth",
      name: "fourth",
      repositoryKey: "git:/Users/junrong/Documents/fourth/.git",
    },
    {
      path: "/Users/junrong/Documents/fifth",
      name: "fifth",
      repositoryKey: "git:/Users/junrong/Documents/fifth/.git",
    },
  ];

  assert.equal(emptyRepositoryFolderPathView(null), null);
  assert.deepEqual(
    emptyRepositoryFolderPathView({
      path: "/Users/junrong/Desktop/new-project",
      name: "new-project",
      hasGitIgnore: false,
    }),
    {
      className: "empty-folder-path",
      text: "/Users/junrong/Desktop/new-project",
      title: "/Users/junrong/Desktop/new-project",
    },
  );
  assert.deepEqual(emptyRepositoryNoticeView(" Run the Electron app to choose a local working folder. "), {
    role: "status",
    ariaLive: "polite",
    message: "Run the Electron app to choose a local working folder.",
  });
  assert.equal(emptyRepositoryNoticeView("   "), null);
  assert.equal(emptyRepositoryTitleId, "empty-repository-title");

  assert.deepEqual(emptyRepositoryView({ loading: true, folderWithoutGit: null, initializingRepository: false, recentRepositories: [] }), {
    section: {
      className: "empty-repository",
      ariaLabelledBy: "empty-repository-title",
    },
    hasFolderWithoutGit: false,
    icon: "folder",
    iconFrameClassName: "empty-icon",
    titleId: "empty-repository-title",
    primaryAction: "open",
    primaryActionIcon: "folder",
    actionDisabled: true,
    title: "Checking working folder",
    body: "Looking for the last saved repository.",
    primaryActionLabel: "Choose folder",
    actionsClassName: "empty-actions",
    primaryButton: {
      className: "primary-action",
      icon: "folder",
      label: "Choose folder",
      disabled: true,
    },
    showSecondaryAction: false,
    secondaryButton: {
      className: "secondary-action",
      icon: "folder",
      label: "Choose another",
      disabled: true,
    },
    showFolderPath: false,
    folderPath: null,
    showGitIgnoreNote: false,
    gitIgnoreNote: {
      className: "empty-gitignore-note",
      text: "",
    },
    showRecentRepositories: false,
    recentRepositories: {
      className: "empty-recent-repos",
      ariaLabel: "Recent repositories",
      heading: "Recent",
      hiddenCountView: {
        className: "empty-recent-repos-more",
        role: "status",
        ariaLive: "polite",
      },
    },
    recentRepositoriesAriaLabel: "Recent repositories",
    recentRepositoriesHeading: "Recent",
    visibleRepositories: [],
    hiddenCountLabel: "",
  });

  const plainView = emptyRepositoryView({ loading: false, folderWithoutGit: null, initializingRepository: false, recentRepositories });
  assert.equal(plainView.titleId, emptyRepositoryTitleId);
  assert.equal(plainView.title, "Open a working folder");
  assert.equal(plainView.body, "Gocus only shows real data from a folder you choose. It remembers that folder for next time.");
  assert.equal(plainView.primaryActionLabel, "Choose folder");
  assert.equal(plainView.primaryAction, "open");
  assert.equal(plainView.primaryActionIcon, "folder");
  assert.deepEqual(plainView.primaryButton, {
    className: "primary-action",
    icon: "folder",
    label: "Choose folder",
    disabled: false,
  });
  assert.equal(plainView.actionDisabled, false);
  assert.equal(plainView.showSecondaryAction, false);
  assert.equal(plainView.showFolderPath, false);
  assert.equal(plainView.folderPath, null);
  assert.equal(plainView.showGitIgnoreNote, false);
  assert.equal(plainView.showRecentRepositories, true);
  assert.equal(plainView.recentRepositoriesAriaLabel, "Recent repositories");
  assert.equal(plainView.recentRepositoriesHeading, "Recent");
  assert.deepEqual(plainView.recentRepositories, {
    className: "empty-recent-repos",
    ariaLabel: "Recent repositories",
    heading: "Recent",
    hiddenCountView: {
      className: "empty-recent-repos-more",
      role: "status",
      ariaLive: "polite",
    },
  });
  assert.deepEqual(
    plainView.visibleRepositories.map((repository) => repository.label),
    ["git-tree-vis - codespace", "demo - Desktop", "another - Documents", "fourth - Documents"],
  );
  assert.deepEqual(
    plainView.visibleRepositories.map((repository) => repository.title),
    [
      "/Users/junrong/codespace/git-tree-vis",
      "/Users/junrong/Desktop/demo",
      "/Users/junrong/Documents/another",
      "/Users/junrong/Documents/fourth",
    ],
  );
  assert.equal(plainView.hiddenCountLabel, "+1 more repository");

  const folderView = emptyRepositoryView({
    loading: false,
    folderWithoutGit: { path: "/Users/junrong/Desktop/new-project", name: "new-project", hasGitIgnore: false },
    initializingRepository: false,
    recentRepositories: [],
  });
  assert.equal(folderView.hasFolderWithoutGit, true);
  assert.equal(folderView.titleId, emptyRepositoryTitleId);
  assert.equal(folderView.icon, "folder-git");
  assert.equal(folderView.title, "Folder without Git");
  assert.equal(folderView.body, "new-project can be initialized here and then tracked by Gocus.");
  assert.equal(folderView.primaryActionLabel, "Initialize Git");
  assert.equal(folderView.primaryAction, "initialize");
  assert.equal(folderView.primaryActionIcon, "branch-plus");
  assert.deepEqual(folderView.primaryButton, {
    className: "primary-action",
    icon: "branch-plus",
    label: "Initialize Git",
    disabled: false,
  });
  assert.equal(folderView.showSecondaryAction, true);
  assert.deepEqual(folderView.secondaryButton, {
    className: "secondary-action",
    icon: "folder",
    label: "Choose another",
    disabled: false,
  });
  assert.equal(folderView.showFolderPath, true);
  assert.deepEqual(folderView.folderPath, {
    className: "empty-folder-path",
    text: "/Users/junrong/Desktop/new-project",
    title: "/Users/junrong/Desktop/new-project",
  });
  assert.equal(folderView.showGitIgnoreNote, true);
  assert.deepEqual(folderView.gitIgnoreNote, {
    className: "empty-gitignore-note",
    text: "Adds a starter .gitignore.",
  });
  assert.equal(folderView.showRecentRepositories, false);

  const initializingView = emptyRepositoryView({
    loading: false,
    folderWithoutGit: { path: "/Users/junrong/Desktop/new-project", name: "new-project", hasGitIgnore: true },
    initializingRepository: true,
    recentRepositories: [],
  });
  assert.equal(initializingView.actionDisabled, true);
  assert.equal(initializingView.primaryActionLabel, "Initializing");
  assert.deepEqual(initializingView.primaryButton, {
    className: "primary-action",
    icon: "branch-plus",
    label: "Initializing",
    disabled: true,
  });
  assert.deepEqual(initializingView.gitIgnoreNote, {
    className: "empty-gitignore-note",
    text: "Keeps the existing .gitignore.",
  });
}

async function testPanelHeaderView(server) {
  const {
    branchPillTitle,
    panelHeaderActionsView,
    panelHeaderBranchPillView,
    panelHeaderOpenRepositoryButtonView,
    panelHeaderView,
    panelPinnedNotice,
    panelPinnedStateAfterToggle,
    panelRepositoryMenuOpenAfterSelection,
    panelRepositoryMenuOpenAfterToggle,
    panelRepositoryMenuItemView,
    panelRepositoryMenuView,
    panelRepositorySelection,
    panelRepositoryTriggerView,
    repositoryOptionActive,
    shouldSwitchRepository,
  } = await loadTsModule(server, "src/lib/panelHeaderView.ts");
  const current = {
    path: "/Users/junrong/codespace/git-tree-vis",
    name: "git-tree-vis",
    repositoryKey: "git:/Users/junrong/codespace/git-tree-vis/.git",
  };
  const sameRepositoryDifferentPath = {
    path: "/Users/junrong/codespace/git-tree-vis-linked",
    name: "git-tree-vis-linked",
    repositoryKey: current.repositoryKey,
  };
  const other = {
    path: "/Users/junrong/codespace/other",
    name: "other",
    repositoryKey: "git:/Users/junrong/codespace/other/.git",
  };
  const snapshot = {
    repoPath: current.path,
    repoName: "",
    repositoryKey: current.repositoryKey,
    branch: { name: "main", upstream: "origin/main" },
  };

  assert.deepEqual(panelHeaderView(null, [current, other]), {
    header: {
      className: "peek-header",
    },
    repoSwitcher: {
      className: "header-repo-switcher",
    },
    repositoryTitleCopy: {
      className: "repo-title-copy",
    },
    staticRepositoryTitle: {
      className: "repo-title",
    },
    branchPill: null,
    currentRepository: null,
    recentRepositoryOptions: [current, other],
    canSwitchRepository: false,
    repositoryTitle: "Gocus",
    repositoryPathLabel: "No working folder",
  });

  assert.deepEqual(panelHeaderView(snapshot, [sameRepositoryDifferentPath, other]), {
    header: {
      className: "peek-header",
    },
    repoSwitcher: {
      className: "header-repo-switcher",
    },
    repositoryTitleCopy: {
      className: "repo-title-copy",
    },
    staticRepositoryTitle: {
      className: "repo-title",
    },
    branchPill: {
      className: "branch-pill",
      icon: "branch",
      label: "main",
      title: "origin/main",
    },
    currentRepository: current,
    recentRepositoryOptions: [current, other],
    canSwitchRepository: true,
    repositoryTitle: "git-tree-vis",
    repositoryPathLabel: current.path,
  });
  assert.equal(repositoryOptionActive(sameRepositoryDifferentPath, current), true);
  assert.equal(repositoryOptionActive(other, current), false);
  assert.equal(repositoryOptionActive(current, null), false);
  assert.deepEqual(panelHeaderOpenRepositoryButtonView(), {
    label: "Open repository",
  });
  assert.deepEqual(panelRepositoryMenuView(), {
    className: "ui-menu repo-switch-menu",
    id: "repo-switch-menu",
    role: "menu",
    ariaLabelledBy: "repo-switch-trigger",
  });
  assert.deepEqual(panelRepositoryMenuItemView(sameRepositoryDifferentPath, current), {
    active: true,
    className: "ui-menu-item repo-menu-item is-active",
    role: "menuitem",
    ariaCurrent: "true",
    showCheck: true,
    checkClassName: "repo-menu-check",
    textClassName: "repo-menu-text",
    key: "/Users/junrong/codespace/git-tree-vis-linked",
    path: "/Users/junrong/codespace/git-tree-vis-linked",
    title: "/Users/junrong/codespace/git-tree-vis-linked",
    label: "git-tree-vis-linked - codespace",
  });
  assert.deepEqual(panelRepositoryMenuItemView(other, current), {
    active: false,
    className: "ui-menu-item repo-menu-item",
    role: "menuitem",
    ariaCurrent: undefined,
    showCheck: false,
    checkClassName: "repo-menu-check",
    textClassName: "repo-menu-text",
    key: "/Users/junrong/codespace/other",
    path: "/Users/junrong/codespace/other",
    title: "/Users/junrong/codespace/other",
    label: "other - codespace",
  });
  assert.equal(shouldSwitchRepository(null, other.path), false);
  assert.equal(shouldSwitchRepository(snapshot, current.path), false);
  assert.equal(shouldSwitchRepository(snapshot, other.path), true);
  assert.equal(panelRepositoryMenuOpenAfterToggle(false, true), true);
  assert.equal(panelRepositoryMenuOpenAfterToggle(true, true), false);
  assert.equal(panelRepositoryMenuOpenAfterToggle(false, false), false);
  assert.equal(panelRepositoryMenuOpenAfterToggle(true, false), true);
  assert.equal(panelRepositoryMenuOpenAfterSelection(), false);
  assert.deepEqual(panelRepositorySelection(null, other.path), {
    menuOpen: false,
    switchRepositoryPath: "",
  });
  assert.deepEqual(panelRepositorySelection(snapshot, current.path), {
    menuOpen: false,
    switchRepositoryPath: "",
  });
  assert.deepEqual(panelRepositorySelection(snapshot, other.path), {
    menuOpen: false,
    switchRepositoryPath: other.path,
  });
  assert.equal(panelPinnedStateAfterToggle(false), true);
  assert.equal(panelPinnedStateAfterToggle(true), false);
  assert.equal(panelPinnedNotice(true), "Panel pinned above other windows.");
  assert.equal(panelPinnedNotice(false), "Panel unpinned.");
  assert.deepEqual(panelRepositoryTriggerView({ canSwitchRepository: true, repoMenuOpen: true }), {
    id: "repo-switch-trigger",
    className: "repo-title repo-title-button is-open",
    disabled: false,
    ariaLabel: "Switch recent repository",
    ariaHasPopup: "menu",
    ariaExpanded: true,
    ariaControls: "repo-switch-menu",
  });
  assert.deepEqual(panelRepositoryTriggerView({ canSwitchRepository: false, repoMenuOpen: false }), {
    id: "repo-switch-trigger",
    className: "repo-title",
    disabled: true,
    ariaLabel: "Switch recent repository",
    ariaHasPopup: "menu",
    ariaExpanded: false,
    ariaControls: "repo-switch-menu",
  });
  assert.deepEqual(panelHeaderActionsView({ pinned: false, refreshing: false, hasRepository: false }), {
    className: "header-actions",
    pinButton: {
      label: "Pin floating panel",
      active: false,
      icon: "pin",
    },
    refreshButton: {
      label: "Refresh Git status",
      busy: false,
      disabled: true,
      icon: "refresh",
      iconClassName: "",
    },
    collapseButton: {
      label: "Collapse side peek",
      icon: "collapse",
    },
  });
  assert.deepEqual(panelHeaderActionsView({ pinned: true, refreshing: true, hasRepository: true }), {
    className: "header-actions",
    pinButton: {
      label: "Unpin floating panel",
      active: true,
      icon: "pin-off",
    },
    refreshButton: {
      label: "Refreshing Git status",
      busy: true,
      disabled: true,
      icon: "refresh",
      iconClassName: "is-spinning",
    },
    collapseButton: {
      label: "Collapse side peek",
      icon: "collapse",
    },
  });
  assert.equal(branchPillTitle({ branch: { name: "main", upstream: "origin/main" } }), "origin/main");
  assert.equal(branchPillTitle({ branch: { name: "feature/no-upstream", upstream: "" } }), "feature/no-upstream");
  assert.equal(panelHeaderBranchPillView(null), null);
  assert.deepEqual(panelHeaderBranchPillView({ branch: { name: "feature/no-upstream", upstream: "" } }), {
    className: "branch-pill",
    icon: "branch",
    label: "feature/no-upstream",
    title: "feature/no-upstream",
  });
}

function worktree(overrides = {}) {
  return {
    path: "/Users/junrong/codespace/git-tree-vis",
    branch: "main",
    head: "a1b2c3d000000000000000000000000000000000",
    headShortHash: "a1b2c3d",
    headTitle: "Add commit search polish",
    headRelativeTime: "2 minutes ago",
    detached: false,
    bare: false,
    current: true,
    counts: { modified: 0, staged: 0, untracked: 0 },
    ...overrides,
  };
}

async function testRepositoryControlLabels(server) {
  const {
    branchOptionLabel,
    shortHash,
    worktreeChipLabel,
    worktreeMenuLabel,
  } = await loadTsModule(server, "src/lib/repositoryControlLabels.ts");

  assert.equal(
    branchOptionLabel({ name: "main", fullName: "refs/heads/main", type: "local", current: true, upstream: "origin/main" }),
    "main",
  );
  assert.equal(
    branchOptionLabel({
      name: "origin/main",
      fullName: "refs/remotes/origin/main",
      type: "remote",
      current: false,
      upstream: "",
    }),
    "origin/main remote",
  );
  assert.equal(
    branchOptionLabel({ name: "v1.0.0", fullName: "refs/tags/v1.0.0", type: "tag", current: false, upstream: "" }),
    "v1.0.0 tag",
  );

  assert.equal(shortHash(""), "unknown");
  assert.equal(shortHash("a1b2c3d000000000000000000000000000000000"), "a1b2c3d");
  assert.equal(worktreeChipLabel(undefined), "Worktrees");
  assert.equal(worktreeChipLabel(worktree()), "main");
  assert.equal(
    worktreeChipLabel(worktree({ branch: "", path: "/Users/junrong/codespace/git-tree-vis-linked", current: false })),
    "git-tree-vis-linked",
  );
  assert.equal(worktreeChipLabel(worktree({ detached: true, branch: "", headShortHash: "d4e5f6a" })), "Detached d4e5f6a");
  assert.equal(worktreeMenuLabel(worktree()), "Current main - git-tree-vis");
  assert.equal(
    worktreeMenuLabel(worktree({ current: false, branch: "feature/worktree-menu", path: "/Users/junrong/codespace/git-tree-vis-linked" })),
    "feature/worktree-menu - git-tree-vis-linked",
  );
  assert.equal(worktreeMenuLabel(worktree({ current: false, branch: "", path: "/Users/junrong/codespace/linked" })), "Worktree - linked");
  assert.equal(
    worktreeMenuLabel(worktree({ detached: true, branch: "", current: true, headShortHash: "" })),
    "Current detached @ a1b2c3d - git-tree-vis",
  );
  assert.equal(
    worktreeMenuLabel(worktree({ detached: true, branch: "", current: false, headShortHash: "d4e5f6a" })),
    "Detached @ d4e5f6a - git-tree-vis",
  );
}

async function testRepositoryControlsView(server) {
  const {
    automaticWorktreeCleanupCandidates,
    automaticWorktreeCleanupPaths,
    closedRepositoryControlsMenus,
    currentSwitchableWorktree,
    isAutomaticWorktreeCleanupCandidate,
    repositoryBranchMenuItemView,
    repositoryBranchMenuView,
    repositoryBranchMenuChromeView,
    repositoryBranchSwitchActionView,
    repositoryBranchTriggerView,
    repositoryControlsChromeView,
    repositoryControlsMenuState,
    repositoryControlsView,
    repositoryRetainedBranchMenuItemView,
    repositorySelectedBranchSummaryView,
    repositoryViewChipView,
    repositoryWorktreeMenuChromeView,
    repositoryWorktreeContextMenuChromeView,
    repositoryWorktreeContextTriggerView,
    repositoryWorktreeContextView,
    repositoryWorktreeMenuItemView,
    repositoryWorktreeMenuView,
    repositoryWorktreeSelection,
    repositoryWorktreeTriggerView,
    repositoryWorktreeCleanupActionView,
    selectedBranchAvailable,
    selectedBranchName,
    switchableWorktreeList,
    worktreeCleanupStatusLabel,
  } = await loadTsModule(server, "src/lib/repositoryControlsView.ts");
  const branches = [
    { name: "main", fullName: "refs/heads/main", type: "local", current: true, upstream: "origin/main" },
    { name: "feature/worktree-menu", fullName: "refs/heads/feature/worktree-menu", type: "local", current: false, upstream: "" },
  ];
  const current = worktree();
  const linked = worktree({ path: "/Users/junrong/codespace/git-tree-vis-linked", branch: "feature/worktree-menu", current: false });
  const removableDetached = worktree({
    path: "/Users/junrong/.codex/worktrees/2902/git-tree-vis",
    branch: "",
    current: false,
    detached: true,
    headShortHash: "02141bb",
    cleanup: {
      status: "merged",
      safeToRemove: true,
      action: "remove",
      reason: "Contained by main.",
      detail: "This clean detached worktree points to history already reachable from the base branch.",
      baseBranch: "main",
      uniquePatchCount: 0,
      containedBranches: ["main"],
      prunableReason: "",
    },
  });
  const removableBranch = worktree({
    path: "/Users/junrong/.codex/worktrees/63d6/git-tree-vis",
    branch: "feature/branch-shell",
    current: false,
    cleanup: {
      status: "branch-preserved",
      safeToRemove: true,
      action: "remove",
      reason: "Branch preserved.",
      detail: "This clean worktree can be removed because feature/branch-shell preserves its HEAD.",
      baseBranch: "",
      uniquePatchCount: null,
      containedBranches: ["feature/branch-shell"],
      prunableReason: "",
    },
  });
  const mergedBranch = worktree({
    path: "/Users/junrong/.codex/worktrees/4d5e/git-tree-vis",
    branch: "feature/merged-shell",
    current: false,
    cleanup: {
      status: "merged",
      safeToRemove: true,
      action: "remove",
      reason: "Merged into main.",
      detail: "This clean branch worktree has already been merged into main.",
      baseBranch: "main",
      uniquePatchCount: 0,
      containedBranches: ["feature/merged-shell"],
      prunableReason: "",
    },
  });
  const patchEquivalentDetached = worktree({
    path: "/Users/junrong/.codex/worktrees/73f3/git-tree-vis",
    branch: "",
    current: false,
    detached: true,
    headShortHash: "73f34d4",
    cleanup: {
      status: "patch-equivalent",
      safeToRemove: true,
      action: "remove",
      reason: "No unique patch vs main.",
      detail: "Git's cherry-pick comparison found no patch content that only exists in this detached worktree.",
      baseBranch: "main",
      uniquePatchCount: 0,
      containedBranches: [],
      prunableReason: "",
    },
  });
  const staleMetadata = worktree({
    path: "/Users/junrong/.codex/worktrees/stale/git-tree-vis",
    branch: "",
    current: false,
    detached: true,
    headShortHash: "0000000",
    cleanup: {
      status: "prunable",
      safeToRemove: true,
      action: "prune",
      reason: "Stale metadata.",
      detail: "Git reports this worktree metadata can be pruned.",
      baseBranch: "",
      uniquePatchCount: null,
      containedBranches: [],
      prunableReason: "gone",
    },
  });
  const otherStaleMetadata = worktree({
    ...staleMetadata,
    path: "/Users/junrong/.codex/worktrees/other-stale/git-tree-vis",
  });
  const dirtyBranch = worktree({
    path: "/Users/junrong/.codex/worktrees/b848/git-tree-vis",
    branch: "feature/dirty-shell",
    current: false,
    cleanup: {
      status: "dirty",
      safeToRemove: false,
      action: "none",
      reason: "Uncommitted changes.",
      detail: "Commit, stash, or discard local changes before removing this worktree.",
      baseBranch: "",
      uniquePatchCount: null,
      containedBranches: [],
      prunableReason: "",
    },
  });
  const bare = worktree({ path: "/Users/junrong/codespace/git-tree-vis.git", branch: "", current: false, bare: true });
  const linkedBranchDisabledReason =
    "This branch is already checked out in another worktree: " +
    "/Users/junrong/codespace/git-tree-vis-linked. Open that worktree to work on it.";
  const linkedBranchDisabledAriaLabel = `Cannot switch to feature/worktree-menu: ${linkedBranchDisabledReason}`;

  assert.equal(selectedBranchName({ mode: "all" }), "");
  assert.equal(selectedBranchName({ mode: "branch", ref: "feature/worktree-menu" }), "feature/worktree-menu");
  assert.equal(selectedBranchAvailable("feature/worktree-menu", branches), true);
  assert.equal(selectedBranchAvailable("missing", branches), false);
  assert.equal(selectedBranchAvailable("", branches), true);
  assert.deepEqual(repositoryViewChipView({ mode: "all" }, "all"), {
    active: true,
    ariaPressed: true,
    className: "view-chip is-active",
    label: "All",
  });
  assert.deepEqual(repositoryViewChipView({ mode: "branch", ref: "main" }, "current"), {
    active: false,
    ariaPressed: false,
    className: "view-chip",
    label: "Current",
  });
  assert.deepEqual(repositoryControlsChromeView(), {
    section: {
      className: "repo-controls",
      ariaLabel: "Repository view controls",
    },
    commitViewStrip: {
      className: "commit-view-strip",
      role: "group",
      ariaLabel: "Commit view",
    },
    branchControl: {
      className: "branch-menu-control",
    },
  });
  assert.deepEqual(repositoryBranchTriggerView({ mode: "branch", ref: "main" }, true), {
    id: "branch-ref-trigger",
    className: "view-chip branch-view-trigger is-active is-open",
    icon: "branch",
    label: "Branch",
    ariaPressed: true,
    ariaLabel: "Choose branch view",
    ariaHasPopup: "menu",
    ariaExpanded: true,
    ariaControls: "branch-ref-menu",
  });
  assert.deepEqual(repositoryBranchTriggerView({ mode: "all" }, false), {
    id: "branch-ref-trigger",
    className: "view-chip branch-view-trigger",
    icon: "branch",
    label: "Branch",
    ariaPressed: false,
    ariaLabel: "Choose branch view",
    ariaHasPopup: "menu",
    ariaExpanded: false,
    ariaControls: "branch-ref-menu",
  });
  assert.deepEqual(repositoryBranchMenuChromeView(), {
    className: "ui-menu branch-ref-menu",
    id: "branch-ref-menu",
    role: "menu",
    ariaLabelledBy: "branch-ref-trigger",
  });
  assert.deepEqual(repositoryRetainedBranchMenuItemView("missing"), {
    rowClassName: "branch-ref-menu-row",
    className: "ui-menu-item branch-ref-menu-item is-active",
    role: "menuitem",
    ariaCurrent: "true",
    icon: "check",
    label: "missing",
  });
  assert.deepEqual(repositoryBranchSwitchActionView(branches[0], "main", [current]), {
    show: false,
    disabled: false,
    branchName: "main",
    tooltipClassName: "branch-switch-tooltip",
    className: "branch-switch-button",
    icon: "switch",
    ariaLabel: "Switch to main",
    title: "Switch to main",
  });
  assert.deepEqual(repositoryBranchSwitchActionView(branches[1], "main", [current]), {
    show: true,
    disabled: false,
    branchName: "feature/worktree-menu",
    tooltipClassName: "branch-switch-tooltip",
    className: "branch-switch-button",
    icon: "switch",
    ariaLabel: "Switch to feature/worktree-menu",
    title: "Switch to feature/worktree-menu",
  });
  assert.deepEqual(repositoryBranchSwitchActionView(branches[1], "main", [linked]), {
    show: true,
    disabled: true,
    branchName: "feature/worktree-menu",
    tooltipClassName: "branch-switch-tooltip",
    className: "branch-switch-button",
    icon: "switch",
    ariaLabel: linkedBranchDisabledAriaLabel,
    title: "Checked out in another worktree",
  });
  assert.deepEqual(repositoryBranchMenuItemView(true, branches[0]), {
    rowClassName: "branch-ref-menu-row",
    className: "ui-menu-item branch-ref-menu-item branch-ref-view-button is-active",
    role: "menuitem",
    ariaCurrent: "true",
    icon: "check",
    label: "main",
    title: "refs/heads/main",
    key: "local-main",
    switchAction: {
      show: false,
      disabled: false,
      branchName: "main",
      tooltipClassName: "branch-switch-tooltip",
      className: "branch-switch-button",
      icon: "switch",
      ariaLabel: "Switch to main",
      title: "Switch to main",
    },
  });
  assert.deepEqual(
    repositoryBranchMenuItemView(false, {
      name: "origin/main",
      fullName: "refs/remotes/origin/main",
      type: "remote",
      current: false,
      upstream: "",
    }),
    {
      rowClassName: "branch-ref-menu-row has-switch",
      className: "ui-menu-item branch-ref-menu-item branch-ref-view-button",
      role: "menuitem",
      ariaCurrent: undefined,
      icon: "branch",
      label: "origin/main remote",
      title: "refs/remotes/origin/main",
      key: "remote-origin/main",
      switchAction: {
        show: true,
        disabled: false,
        branchName: "origin/main",
        tooltipClassName: "branch-switch-tooltip",
        className: "branch-switch-button",
        icon: "switch",
        ariaLabel: "Track and switch to main",
        title: "Track and switch to main",
      },
    },
  );
  assert.deepEqual(repositoryBranchMenuView({ branches, currentBranchName: "main", view: { mode: "all" } }), {
    selectedBranch: "",
    selectedBranchIsAvailable: true,
    triggerDisabled: false,
    triggerTitle: "main",
    retainedSelectedBranch: "",
    showSelectedBranchSummary: false,
    selectedBranchSummary: {
      show: false,
      className: "selected-branch-view",
      icon: "branch",
      label: "Viewing",
      branchName: "",
      title: "",
      ariaLabel: undefined,
    },
    branchItems: [
      {
        branch: branches[0],
        active: false,
        switchAction: {
          show: false,
          disabled: false,
          branchName: "main",
          tooltipClassName: "branch-switch-tooltip",
          className: "branch-switch-button",
          icon: "switch",
          ariaLabel: "Switch to main",
          title: "Switch to main",
        },
      },
      {
        branch: branches[1],
        active: false,
        switchAction: {
          show: true,
          disabled: false,
          branchName: "feature/worktree-menu",
          tooltipClassName: "branch-switch-tooltip",
          className: "branch-switch-button",
          icon: "switch",
          ariaLabel: "Switch to feature/worktree-menu",
          title: "Switch to feature/worktree-menu",
        },
      },
    ],
  });
  assert.deepEqual(
    repositoryBranchMenuView({
      branches,
      currentBranchName: "main",
      view: { mode: "branch", ref: "feature/worktree-menu" },
    }),
    {
      selectedBranch: "feature/worktree-menu",
      selectedBranchIsAvailable: true,
      triggerDisabled: false,
      triggerTitle: "feature/worktree-menu",
      retainedSelectedBranch: "",
      showSelectedBranchSummary: true,
      selectedBranchSummary: {
        show: true,
        className: "selected-branch-view",
        icon: "branch",
        label: "Viewing",
        branchName: "feature/worktree-menu",
        title: "Viewing branch feature/worktree-menu",
        ariaLabel: "Viewing branch feature/worktree-menu",
      },
      branchItems: [
        {
          branch: branches[0],
          active: false,
          switchAction: {
            show: false,
            disabled: false,
            branchName: "main",
            tooltipClassName: "branch-switch-tooltip",
            className: "branch-switch-button",
            icon: "switch",
            ariaLabel: "Switch to main",
            title: "Switch to main",
          },
        },
        {
          branch: branches[1],
          active: true,
          switchAction: {
            show: true,
            disabled: false,
            branchName: "feature/worktree-menu",
            tooltipClassName: "branch-switch-tooltip",
            className: "branch-switch-button",
            icon: "switch",
            ariaLabel: "Switch to feature/worktree-menu",
            title: "Switch to feature/worktree-menu",
          },
        },
      ],
    },
  );
  assert.deepEqual(repositoryBranchMenuView({ branches: [], currentBranchName: "main", view: { mode: "branch", ref: "missing" } }), {
    selectedBranch: "missing",
    selectedBranchIsAvailable: false,
    triggerDisabled: false,
    triggerTitle: "missing",
    retainedSelectedBranch: "missing",
    showSelectedBranchSummary: true,
    selectedBranchSummary: {
      show: true,
      className: "selected-branch-view",
      icon: "branch",
      label: "Viewing",
      branchName: "missing",
      title: "Viewing branch missing",
      ariaLabel: "Viewing branch missing",
    },
    branchItems: [],
  });
  assert.deepEqual(repositorySelectedBranchSummaryView("release/1.0"), {
    show: true,
    className: "selected-branch-view",
    icon: "branch",
    label: "Viewing",
    branchName: "release/1.0",
    title: "Viewing branch release/1.0",
    ariaLabel: "Viewing branch release/1.0",
  });
  assert.deepEqual(repositorySelectedBranchSummaryView(""), {
    show: false,
    className: "selected-branch-view",
    icon: "branch",
    label: "Viewing",
    branchName: "",
    title: "",
    ariaLabel: undefined,
  });
  assert.equal(repositoryBranchMenuView({ branches: [], currentBranchName: "main", view: { mode: "all" } }).triggerDisabled, true);
  assert.deepEqual(switchableWorktreeList([bare, linked, current]), [linked, current]);
  assert.equal(currentSwitchableWorktree([linked, current]), current);
  assert.equal(currentSwitchableWorktree([linked]), linked);
  assert.deepEqual(repositoryWorktreeMenuView([bare, linked, current]), {
    controlClassName: "worktree-compact",
    switchableWorktrees: [linked, current],
    switchableWorktreeCount: 2,
    currentWorktree: current,
    showWorktreeControl: true,
    worktreeItems: [
      { worktree: linked, active: false },
      { worktree: current, active: true },
    ],
  });
  assert.deepEqual(repositoryWorktreeMenuView([linked]), {
    controlClassName: "worktree-compact",
    switchableWorktrees: [linked],
    switchableWorktreeCount: 1,
    currentWorktree: linked,
    showWorktreeControl: false,
    worktreeItems: [{ worktree: linked, active: true }],
  });
  assert.deepEqual(repositoryWorktreeMenuView([bare]), {
    controlClassName: "worktree-compact",
    switchableWorktrees: [],
    switchableWorktreeCount: 0,
    currentWorktree: undefined,
    showWorktreeControl: false,
    worktreeItems: [],
  });
  const worktreeContext = repositoryWorktreeContextView([bare, linked, current]);
  assert.equal(worktreeContext.show, true);
  assert.equal(worktreeContext.className, "worktree-context");
  assert.equal(worktreeContext.staticClassName, "worktree-context-static");
  assert.equal(worktreeContext.copyClassName, "worktree-context-copy");
  assert.equal(worktreeContext.badgeClassName, "worktree-context-count");
  assert.equal(worktreeContext.eyebrow, "Current worktree");
  assert.equal(worktreeContext.label, "main");
  assert.equal(worktreeContext.path, current.path);
  assert.equal(worktreeContext.countLabel, "2 worktrees");
  assert.equal(worktreeContext.title, current.path);
  assert.equal(worktreeContext.ariaLabel, `Current worktree main at ${current.path}`);
  assert.equal(worktreeContext.canSwitch, true);
  assert.equal(worktreeContext.currentWorktree, current);
  assert.deepEqual(worktreeContext.menu.worktreeItems, [
    { worktree: linked, active: false },
    { worktree: current, active: true },
  ]);
  assert.deepEqual(repositoryWorktreeContextView([current]), {
    show: true,
    className: "worktree-context",
    staticClassName: "worktree-context-static",
    copyClassName: "worktree-context-copy",
    badgeClassName: "worktree-context-count",
    eyebrow: "Current worktree",
    label: "main",
    path: current.path,
    countLabel: "1 worktree",
    title: current.path,
    ariaLabel: `Current worktree main at ${current.path}`,
    canSwitch: false,
    currentWorktree: current,
    menu: {
      controlClassName: "worktree-compact",
      switchableWorktrees: [current],
      switchableWorktreeCount: 1,
      currentWorktree: current,
      showWorktreeControl: false,
      worktreeItems: [{ worktree: current, active: true }],
    },
  });
  assert.equal(repositoryWorktreeContextView([bare]).show, false);
  assert.deepEqual(repositoryWorktreeTriggerView(true, current), {
    id: "worktree-trigger",
    className: "worktree-trigger is-open",
    icon: "worktree",
    ariaLabel: "Choose worktree",
    ariaHasPopup: "menu",
    ariaExpanded: true,
    ariaControls: "worktree-menu",
    label: "main",
    title: current.path,
  });
  assert.deepEqual(repositoryWorktreeTriggerView(false, undefined), {
    id: "worktree-trigger",
    className: "worktree-trigger",
    icon: "worktree",
    ariaLabel: "Choose worktree",
    ariaHasPopup: "menu",
    ariaExpanded: false,
    ariaControls: "worktree-menu",
    label: "Worktrees",
    title: undefined,
  });
  assert.deepEqual(repositoryWorktreeContextTriggerView(true, current), {
    id: "worktree-context-trigger",
    className: "worktree-context-trigger is-open",
    icon: "worktree",
    ariaLabel: "Choose worktree",
    ariaHasPopup: "menu",
    ariaExpanded: true,
    ariaControls: "worktree-context-menu",
    title: current.path,
  });
  assert.deepEqual(repositoryWorktreeContextTriggerView(false, undefined), {
    id: "worktree-context-trigger",
    className: "worktree-context-trigger",
    icon: "worktree",
    ariaLabel: "Choose worktree",
    ariaHasPopup: "menu",
    ariaExpanded: false,
    ariaControls: "worktree-context-menu",
    title: undefined,
  });
  assert.deepEqual(repositoryWorktreeMenuChromeView(), {
    className: "ui-menu worktree-menu",
    id: "worktree-menu",
    role: "menu",
    ariaLabelledBy: "worktree-trigger",
  });
  assert.deepEqual(repositoryWorktreeContextMenuChromeView(), {
    className: "ui-menu worktree-menu worktree-context-menu",
    id: "worktree-context-menu",
    role: "menu",
    ariaLabelledBy: "worktree-context-trigger",
  });
  assert.deepEqual(repositoryWorktreeMenuItemView(true, current), {
    rowClassName: "worktree-menu-row",
    className: "ui-menu-item worktree-menu-item worktree-menu-open is-active",
    role: "menuitem",
    ariaCurrent: "true",
    icon: "check",
    label: "Current main - git-tree-vis",
    statusLabel: "",
    title: current.path,
    key: current.path,
    cleanupAction: {
      show: false,
      disabled: true,
      className: "worktree-cleanup-button is-disabled",
      ariaLabel: "Cannot clean up Current main - git-tree-vis: This worktree is not safe to clean up.",
      title: "This worktree is not safe to clean up.",
      label: "Clean",
    },
  });
  assert.deepEqual(repositoryWorktreeMenuItemView(false, linked), {
    rowClassName: "worktree-menu-row",
    className: "ui-menu-item worktree-menu-item worktree-menu-open",
    role: "menuitem",
    ariaCurrent: undefined,
    icon: "worktree",
    label: "feature/worktree-menu - git-tree-vis-linked",
    statusLabel: "",
    title: linked.path,
    key: linked.path,
    cleanupAction: {
      show: false,
      disabled: true,
      className: "worktree-cleanup-button is-disabled",
      ariaLabel: "Cannot clean up feature/worktree-menu - git-tree-vis-linked: This worktree is not safe to clean up.",
      title: "This worktree is not safe to clean up.",
      label: "Clean",
    },
  });
  assert.equal(worktreeCleanupStatusLabel(removableDetached), "Contained by main.");
  assert.equal(worktreeCleanupStatusLabel(removableBranch), "Branch preserved.");
  assert.equal(worktreeCleanupStatusLabel(mergedBranch), "Merged into main.");
  assert.equal(worktreeCleanupStatusLabel(patchEquivalentDetached), "No unique patch vs main.");
  assert.equal(worktreeCleanupStatusLabel(staleMetadata), "Stale metadata.");
  assert.equal(worktreeCleanupStatusLabel(dirtyBranch), "Uncommitted changes.");
  assert.equal(isAutomaticWorktreeCleanupCandidate(removableDetached), true);
  assert.equal(isAutomaticWorktreeCleanupCandidate(removableBranch), false);
  assert.equal(isAutomaticWorktreeCleanupCandidate(mergedBranch), true);
  assert.equal(isAutomaticWorktreeCleanupCandidate(patchEquivalentDetached), true);
  assert.equal(isAutomaticWorktreeCleanupCandidate(staleMetadata), true);
  assert.deepEqual(
    automaticWorktreeCleanupCandidates([
      current,
      removableBranch,
      mergedBranch,
      removableDetached,
      dirtyBranch,
      patchEquivalentDetached,
      staleMetadata,
    ]),
    [mergedBranch, removableDetached, patchEquivalentDetached, staleMetadata],
  );
  assert.deepEqual(
    automaticWorktreeCleanupPaths([staleMetadata, removableDetached, mergedBranch, otherStaleMetadata, patchEquivalentDetached]),
    [removableDetached.path, mergedBranch.path, patchEquivalentDetached.path, staleMetadata.path],
  );
  assert.deepEqual(repositoryWorktreeCleanupActionView(removableDetached), {
    show: true,
    disabled: false,
    className: "worktree-cleanup-button is-auto-safe",
    ariaLabel: "Clean Detached @ 02141bb - git-tree-vis",
    title: "This clean detached worktree points to history already reachable from the base branch.",
    label: "Clean",
  });
  assert.deepEqual(repositoryWorktreeCleanupActionView(removableBranch), {
    show: true,
    disabled: false,
    className: "worktree-cleanup-button",
    ariaLabel: "Clean feature/branch-shell - git-tree-vis",
    title: "This clean worktree can be removed because feature/branch-shell preserves its HEAD.",
    label: "Clean",
  });
  assert.deepEqual(repositoryWorktreeCleanupActionView(mergedBranch), {
    show: true,
    disabled: false,
    className: "worktree-cleanup-button is-auto-safe",
    ariaLabel: "Clean feature/merged-shell - git-tree-vis",
    title: "This clean branch worktree has already been merged into main.",
    label: "Clean",
  });
  assert.deepEqual(repositoryWorktreeCleanupActionView(patchEquivalentDetached), {
    show: true,
    disabled: false,
    className: "worktree-cleanup-button is-auto-safe",
    ariaLabel: "Clean Detached @ 73f34d4 - git-tree-vis",
    title: "Git's cherry-pick comparison found no patch content that only exists in this detached worktree.",
    label: "Clean",
  });
  assert.deepEqual(repositoryWorktreeCleanupActionView(staleMetadata), {
    show: true,
    disabled: false,
    className: "worktree-cleanup-button is-auto-safe",
    ariaLabel: "Prune Detached @ 0000000 - git-tree-vis",
    title: "Git reports this worktree metadata can be pruned.",
    label: "Prune",
  });
  assert.deepEqual(repositoryWorktreeCleanupActionView(dirtyBranch), {
    show: true,
    disabled: true,
    className: "worktree-cleanup-button is-disabled",
    ariaLabel:
      "Cannot clean up feature/dirty-shell - git-tree-vis: Commit, stash, or discard local changes before removing this worktree.",
    title: "Commit, stash, or discard local changes before removing this worktree.",
    label: "Clean",
  });
  assert.deepEqual(repositoryWorktreeSelection(current.path, current), {
    menuAction: "closeWorktree",
    openWorktreePath: "",
  });
  assert.deepEqual(repositoryWorktreeSelection(linked.path, current), {
    menuAction: "closeWorktree",
    openWorktreePath: linked.path,
  });
  assert.deepEqual(repositoryWorktreeSelection(linked.path, undefined), {
    menuAction: "closeWorktree",
    openWorktreePath: linked.path,
  });

  assert.deepEqual(repositoryControlsView({ branches, view: { mode: "branch", ref: "missing" }, worktrees: [bare, linked] }), {
    selectedBranch: "missing",
    selectedBranchIsAvailable: false,
    switchableWorktrees: [linked],
    currentWorktree: linked,
  });

  assert.deepEqual(repositoryControlsMenuState(closedRepositoryControlsMenus, "toggleBranch"), {
    branchMenuOpen: true,
    worktreeMenuOpen: false,
  });
  assert.deepEqual(
    repositoryControlsMenuState({ branchMenuOpen: true, worktreeMenuOpen: false }, "toggleBranch"),
    closedRepositoryControlsMenus,
  );
  assert.deepEqual(repositoryControlsMenuState({ branchMenuOpen: true, worktreeMenuOpen: false }, "toggleWorktree"), {
    branchMenuOpen: false,
    worktreeMenuOpen: true,
  });
  assert.deepEqual(repositoryControlsMenuState({ branchMenuOpen: false, worktreeMenuOpen: true }, "toggleBranch"), {
    branchMenuOpen: true,
    worktreeMenuOpen: false,
  });
  assert.deepEqual(repositoryControlsMenuState({ branchMenuOpen: true, worktreeMenuOpen: true }, "closeBranch"), {
    branchMenuOpen: false,
    worktreeMenuOpen: true,
  });
  assert.deepEqual(repositoryControlsMenuState({ branchMenuOpen: true, worktreeMenuOpen: true }, "closeWorktree"), {
    branchMenuOpen: true,
    worktreeMenuOpen: false,
  });
  assert.deepEqual(
    repositoryControlsMenuState({ branchMenuOpen: true, worktreeMenuOpen: true }, "closeAll"),
    closedRepositoryControlsMenus,
  );
}

async function testClassNamesAndGraph(server) {
  const { joinClass } = await loadTsModule(server, "src/lib/classNames.ts");
  const {
    buildGitTreeRenderModel,
    getGitTreeLaneCountForCommits,
    gitTreeLaneX,
    getGitTreeRailWidth,
    getGitTreeRequiredLaneCount,
  } = await loadTsModule(server, "src/git-tree/renderGraph.ts");
  const {
    buildGitTreeCanvasModel,
    gitTreeCanvasTotalHeight,
    gitTreeNodeY,
    gitTreeSelectedRowHeight,
  } = await loadTsModule(server, "src/git-tree/graphCanvas.ts", {
    "../lib/commitListView": await loadTsModule(server, "src/lib/commitListView.ts", {
      "./classNames": await loadTsModule(server, "src/lib/classNames.ts"),
      "./commitSearch": await loadTsModule(server, "src/lib/commitSearch.ts"),
      "./statusView": await loadTsModule(server, "src/lib/statusView.ts"),
    }),
    "./renderGraph": {
      buildGitTreeRenderModel,
      getGitTreeRailWidth,
      gitTreeLaneX,
    },
  });
  const graph = {
    column: 2,
    laneCount: 1,
    currentColor: "#111111",
    currentVariant: "dashed",
    incomingColor: "#999999",
    incomingVariant: "solid",
    currentContinues: true,
    passThrough: [{ column: 0, color: "#222222", variant: "dashed", from: "top", to: "bottom" }],
    parentStems: [{ column: 1, color: "#333333", variant: "solid", from: "node", to: "bottom" }],
    bridges: [{ fromColumn: 2, toColumn: 0, color: "#444444", variant: "solid", to: "lane" }],
    isMerge: true,
    isCurrentHead: false,
  };

  assert.equal(joinClass("graph-node", false, null, undefined, "is-current-head"), "graph-node is-current-head");
  assert.equal(joinClass(), "");
  assert.equal(getGitTreeRequiredLaneCount(graph), 3);
  assert.equal(
    getGitTreeLaneCountForCommits([
      { graph },
      { graph: { ...graph, column: 8, laneCount: 1, passThrough: [], parentStems: [], bridges: [] } },
    ]),
    9,
  );
  assert.equal(getGitTreeRailWidth(1), 42);
  assert.equal(getGitTreeRailWidth(4), 66);
  assert.equal(gitTreeLaneX(0), 9);
  assert.equal(gitTreeLaneX(2), 33);

  const model = buildGitTreeRenderModel(graph);
  assert.equal(model.width, 54);
  assert.equal(model.node.x, 33);
  assert.equal(model.node.isCurrentHead, false);
  assert.equal(model.node.className, "graph-node is-dashed");
  assert.equal(model.node.showCore, false);

  const currentHeadModel = buildGitTreeRenderModel({ ...graph, currentVariant: "solid", isCurrentHead: true });
  assert.equal(currentHeadModel.node.isCurrentHead, true);
  assert.equal(currentHeadModel.node.className, "graph-node is-current-head");
  assert.equal(currentHeadModel.node.showCore, true);

  const regularModel = buildGitTreeRenderModel({ ...graph, currentVariant: "solid", isMerge: false });
  assert.equal(regularModel.node.className, "graph-node");
  assert.equal(regularModel.node.showCore, false);

  const canvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-a",
        graph,
      },
      {
        id: "commit-b",
        graph: { ...graph, column: 0, currentColor: "#555555", isCurrentHead: true },
      },
    ],
    startIndex: 0,
    itemCount: 2,
    selectedIndex: 0,
    laneCount: 3,
    nodeY: 22,
  });
  assert.equal(gitTreeNodeY, 22);
  assert.equal(gitTreeSelectedRowHeight(), 116);
  assert.equal(gitTreeCanvasTotalHeight(2, 0), 184);
  assert.equal(canvasModel.top, 0);
  assert.equal(canvasModel.width, 54);
  assert.equal(canvasModel.height, 184);
  assert.equal(canvasModel.nodes.length, 2);
  assert.deepEqual(canvasModel.nodes[0], {
    id: "commit-a",
    x: 33,
    y: 22,
    color: "#111111",
    className: "graph-node is-dashed",
    showCore: false,
  });
  assert.equal(canvasModel.nodes[1].showCore, true);
  assert.ok(canvasModel.lines.some((line) => line.kind === "vertical" && line.x === 33 && line.fromY === 0 && line.toY === 12.5));
  assert.ok(canvasModel.lines.some((line) => line.kind === "vertical" && line.x === 21 && line.fromY === 31.5));
  const nodeStartedBridgeLine = canvasModel.lines.find(
    (line) => line.kind === "bridge" && line.fromX === 33 && line.toX === 9,
  );
  assert.ok(nodeStartedBridgeLine);
  assert.equal(nodeStartedBridgeLine.startX, nodeStartedBridgeLine.fromX);
  assert.equal(nodeStartedBridgeLine.fromY, 31.5);
  assert.equal(nodeStartedBridgeLine.controlFromX, nodeStartedBridgeLine.startX);
  assert.equal(nodeStartedBridgeLine.controlToX, 9);
  assert.equal(nodeStartedBridgeLine.toY, nodeStartedBridgeLine.joinY);
  assert.ok(nodeStartedBridgeLine.controlFromY < nodeStartedBridgeLine.controlToY);
  assert.ok(nodeStartedBridgeLine.toY < 116);
  const measuredCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-a",
        graph,
      },
      {
        id: "commit-b",
        graph: { ...graph, column: 0, currentColor: "#555555", isCurrentHead: true },
      },
    ],
    startIndex: 12,
    itemCount: 40,
    selectedIndex: 12,
    laneCount: 3,
    nodeY: 22,
    rowLayout: {
      top: 768,
      rows: [
        { id: "commit-a", top: 0, bottom: 84 },
        { id: "commit-b", top: 84, bottom: 168 },
      ],
    },
  });
  assert.equal(measuredCanvasModel.top, 768);
  assert.equal(measuredCanvasModel.height, 168);
  assert.equal(measuredCanvasModel.nodes[0].y, 22);
  assert.equal(measuredCanvasModel.nodes[1].y, 106);
  assert.ok(
    measuredCanvasModel.lines.some(
      (line) => line.kind === "vertical" && line.x === 33 && line.fromY === 0 && line.toY === 12.5,
    ),
  );
  const staleMeasuredCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-a",
        graph,
      },
    ],
    startIndex: 1,
    itemCount: 2,
    selectedIndex: -1,
    laneCount: 3,
    nodeY: 22,
    rowLayout: {
      top: 999,
      rows: [{ id: "other-commit", top: 0, bottom: 84 }],
    },
  });
  assert.equal(staleMeasuredCanvasModel.top, 68);
  assert.equal(staleMeasuredCanvasModel.height, 68);
  const laneStartedBridgeCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-lane-started-bridge",
        graph: { ...graph, column: 0, bridges: [{ fromColumn: 2, toColumn: 0, color: "#444444", variant: "solid" }] },
      },
    ],
    startIndex: 0,
    itemCount: 1,
    selectedIndex: -1,
    laneCount: 3,
    nodeY: 22,
  });
  assert.ok(
    laneStartedBridgeCanvasModel.lines.some(
      (line) =>
        line.kind === "bridge" &&
        line.fromX === 33 &&
        line.startX === line.fromX &&
        line.controlFromX === line.startX &&
        line.toX === 9,
    ),
  );
  const openBridgeCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-open-bridge",
        graph: { ...graph, bridges: [{ fromColumn: 2, toColumn: 0, color: "#444444", variant: "solid" }] },
      },
    ],
    startIndex: 0,
    itemCount: 1,
    selectedIndex: 0,
    laneCount: 3,
    nodeY: 22,
  });
  assert.ok(
    openBridgeCanvasModel.lines.some(
      (line) =>
        line.kind === "bridge" &&
        line.toY === 116 &&
        line.joinY < line.toY &&
        line.startX === line.fromX &&
        line.fromY > 31 &&
        line.controlFromX === line.startX &&
        line.controlFromY < line.controlToY,
    ),
  );
  const adjacentBridgeCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-adjacent-bridge",
        graph: { ...graph, column: 1, bridges: [{ fromColumn: 1, toColumn: 0, color: "#444444", variant: "solid" }] },
      },
    ],
    startIndex: 0,
    itemCount: 1,
    selectedIndex: -1,
    laneCount: 2,
    nodeY: 22,
  });
  const adjacentBridgeLine = adjacentBridgeCanvasModel.lines.find(
    (line) => line.kind === "bridge" && line.fromX === 21 && line.toX === 9,
  );
  assert.ok(adjacentBridgeLine);
  assert.equal(adjacentBridgeLine.startX, adjacentBridgeLine.fromX);
  assert.ok(adjacentBridgeLine.fromY > 31);
  assert.equal(adjacentBridgeLine.controlFromX, adjacentBridgeLine.startX);
  assert.ok(adjacentBridgeLine.controlFromX > adjacentBridgeLine.toX);
  assert.ok(adjacentBridgeLine.controlFromY < adjacentBridgeLine.controlToY);
  const shortRowBridgeCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-short-row-bridge",
        graph,
      },
    ],
    startIndex: 0,
    itemCount: 1,
    selectedIndex: -1,
    laneCount: 3,
    nodeY: 22,
    rowLayout: {
      top: 0,
      rows: [{ id: "commit-short-row-bridge", top: 0, bottom: 26 }],
    },
  });
  const shortRowBridgeLine = shortRowBridgeCanvasModel.lines.find(
    (line) => line.kind === "bridge" && line.fromX === 33 && line.toX === 9,
  );
  assert.ok(shortRowBridgeLine);
  assert.ok(shortRowBridgeLine.controlFromY >= shortRowBridgeLine.fromY);
  assert.ok(shortRowBridgeLine.controlFromY <= shortRowBridgeLine.controlToY);
  assert.ok(shortRowBridgeLine.controlToY <= shortRowBridgeLine.joinY);
  const duplicateLaneCollapseCanvasModel = buildGitTreeCanvasModel({
    commits: [
      {
        id: "commit-duplicate-lane-collapse",
        graph: {
          ...graph,
          column: 0,
          passThrough: [{ column: 1, color: "#222222", variant: "solid", to: "node" }],
          parentStems: [],
          bridges: [{ fromColumn: 1, toColumn: 0, color: "#222222", variant: "solid", to: "lane" }],
        },
      },
    ],
    startIndex: 0,
    itemCount: 1,
    selectedIndex: -1,
    laneCount: 2,
    nodeY: 22,
  });
  assert.ok(
    duplicateLaneCollapseCanvasModel.lines.some(
      (line) => line.kind === "vertical" && line.x === 21 && line.fromY === 0 && line.toY === 22,
    ),
  );
  assert.ok(
    duplicateLaneCollapseCanvasModel.lines.some(
      (line) => line.kind === "bridge" && line.fromX === 21 && line.startX === 21 && line.fromY === 22 && line.toX === 9,
    ),
  );
}

async function main() {
  testDevelopReleaseVersionScript();
  testFileChecksUtility();
  testSecretScanScript();
  testWorkspaceModule();
  testSourceHygieneScript();
  testSourceHelperUnitCoverage();
  testNodeSyntaxScript();
  testShellSyntaxScript();
  testCommitMessageScript();
  testWindowGeometryModule();
  testWindowAnimationModule();
  testConfigStoreModule();
  testIpcHandlersModule();
  await testAutoUpdateModule();
  testGitStatusModule();
  await testGitModule();
  testGitGraphModule();

  const { createServer } = await import("vite");
  const server = await createServer({
    appType: "custom",
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    root: projectRoot,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
  });

  try {
    await testRootMount(server);
    await testIconButtonView(server);
    await testStatusView(server);
    await testBranchNames(server);
    await testAppShellView(server);
    await testActionDialogView(server);
    await testCommitSearch(server);
    await testCommitListView(server);
    await testCommitRowView(server);
    await testCommitView(server);
    await testCommitInfoSelection(server);
    await testChangedFileInfoSelection(server);
    await testSnapshotResponseView(server);
    await testRepositoryStateView(server);
    await testActionResponseView(server);
    await testMergeGuard(server);
    await testAutoRefresh(server);
    await testPreferences(server);
    await testWorkspaceOpenOptions(server);
    await testCollapsedRailView(server);
    await testWorkspaceOpenChoices(server);
    await testFooterWorkspaceView(server);
    await testSettingsPanelView(server);
    await testErrorMessages(server);
    await testBridgeAvailability(server);
    await testDevWebBridge(server);
    await testPathAndFileStatus(server);
    await testCommitPrompt(server);
    await testCopyText(server);
    await testDismissableLayer(server);
    await testChangedNowView(server);
    await testChangedFilesView(server);
    await testChangedFileView(server);
    await testChangedFilesTemporaryInfo(server);
    await testTemporaryInfoPanelBridge(server);
    await testCommitInfoPanelBridge(server);
    await testCommitInfoPreviewPanel(server);
    await testChangedNowWindowState(server);
    await testTemporaryInfoSelection(server);
    await testRecentRepositories(server);
    await testEmptyRepositoryView(server);
    await testPanelHeaderView(server);
    await testRepositoryControlLabels(server);
    await testRepositoryControlsView(server);
    await testClassNamesAndGraph(server);
  } finally {
    await server.close();
  }

  console.log("Unit checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
