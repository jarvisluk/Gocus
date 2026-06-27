#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const sourcePackagePath = path.join(projectRoot, "package.json");
const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, "utf8"));
const productName = process.env.GOCUS_PRODUCT_NAME || "Gocus";
const safeProductName = productName.replaceAll(" ", "");
const version = process.env.GOCUS_VERSION || sourcePackage.version || "0.1.0";
const appArchitecture = process.env.GOCUS_ARCH || process.arch;
const builderArchitecture = appArchitecture === "arm64" ? "arm64" : "x64";
const defaultUpdateChannel = "stable";
const defaultUpdateRepository = "jarvisluk/gocus";
const outputRoot = path.join(projectRoot, "release", "windows");
const builderOutputRoot = path.join(projectRoot, "release", "windows-builder");
const installerOnly = process.argv.includes("--installer-only");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    run(process.execPath, [npmExecPath, ...args]);
    return;
  }

  run("npm", args, { shell: process.platform === "win32" });
}

function updateChannel() {
  const channel = (process.env.GOCUS_UPDATE_CHANNEL || defaultUpdateChannel).trim().toLowerCase();
  return channel === "develop" ? "develop" : "stable";
}

function readUpdateChannelOverrides() {
  const rawChannels = process.env.GOCUS_UPDATE_CHANNELS;
  if (!rawChannels || !rawChannels.trim()) return {};

  const parsed = JSON.parse(rawChannels);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("GOCUS_UPDATE_CHANNELS must be a JSON object.");
  }
  return parsed;
}

function updateChannels() {
  const channels = {
    stable: process.env.GOCUS_UPDATE_REPO || defaultUpdateRepository,
    ...readUpdateChannelOverrides(),
  };

  if (process.env.GOCUS_UPDATE_STABLE_REPO) channels.stable = process.env.GOCUS_UPDATE_STABLE_REPO;
  if (process.env.GOCUS_UPDATE_DEVELOP_REPO) channels.develop = process.env.GOCUS_UPDATE_DEVELOP_REPO;

  return channels;
}

function removeInstallerArtifacts() {
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!isStaleInstallerArtifact(entry.name)) continue;
    fs.rmSync(path.join(outputRoot, entry.name), { force: true });
  }
}

function isReleaseInstallerArtifact(fileName) {
  return /\.(exe|blockmap)$/i.test(fileName) || /^latest.*\.ya?ml$/i.test(fileName);
}

function isStaleInstallerArtifact(fileName) {
  return isReleaseInstallerArtifact(fileName) || /^builder-debug\.yml$/i.test(fileName);
}

function copyBuilderArtifacts() {
  for (const entry of fs.readdirSync(builderOutputRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!isReleaseInstallerArtifact(entry.name)) continue;

    const source = path.join(builderOutputRoot, entry.name);
    const destination = path.join(outputRoot, entry.name);
    fs.copyFileSync(source, destination);
    console.log(`Created ${destination}`);
  }
}

function electronBuilderCliPath() {
  return path.join(projectRoot, "node_modules", "electron-builder", "out", "cli", "cli.js");
}

function buildConfig() {
  const repository = updateChannels().stable || defaultUpdateRepository;
  return {
    appId: "com.jarvisluk.gocus",
    productName,
    copyright: "Copyright (c) Jarvis Luk",
    asar: true,
    npmRebuild: false,
    directories: {
      output: builderOutputRoot,
    },
    files: [
      "dist/**/*",
      "electron/**/*",
      "assets/**/*",
      "package.json",
    ],
    extraMetadata: {
      productName,
      version,
      main: sourcePackage.main,
      repository: sourcePackage.repository,
      updateRepository: repository,
      updateChannel: updateChannel(),
      updateChannels: updateChannels(),
      private: true,
    },
    win: {
      icon: "assets/app-icon.ico",
      target: [
        {
          target: "nsis",
          arch: [builderArchitecture],
        },
        {
          target: "portable",
          arch: [builderArchitecture],
        },
      ],
    },
    nsis: {
      artifactName: `${safeProductName} Setup ${version}-win-${builderArchitecture}.\${ext}`,
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: productName,
    },
    portable: {
      artifactName: `${safeProductName}-${version}-win-${builderArchitecture}-portable.\${ext}`,
    },
  };
}

function runInstallerBuild() {
  fs.rmSync(builderOutputRoot, { force: true, recursive: true });
  removeInstallerArtifacts();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gocus-electron-builder-"));
  const configPath = path.join(tempDir, "windows-builder.json");
  fs.writeFileSync(configPath, `${JSON.stringify(buildConfig(), null, 2)}\n`);

  try {
    run(process.execPath, [electronBuilderCliPath(), "--config", configPath, "--win", "--publish", "never"], {
      env: {
        ...process.env,
        CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || "false",
      },
    });
    copyBuilderArtifacts();
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
    fs.rmSync(builderOutputRoot, { force: true, recursive: true });
  }
}

function usage() {
  console.log(`Usage: node scripts/package-windows-release.cjs [--installer-only]

Builds Windows release artifacts for Gocus.

Outputs:
  release/windows/${safeProductName}-<version>-win-<arch>.zip
  release/windows/${safeProductName} Setup <version>-win-<arch>.exe
  release/windows/${safeProductName}-<version>-win-<arch>-portable.exe
  release/windows/*.blockmap
  release/windows/latest.yml

Options:
  --installer-only    Build only the NSIS installer and electron-builder portable exe
  -h, --help          Show this help`);
}

function main() {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    usage();
    return;
  }

  if (process.platform !== "win32") {
    throw new Error("package:win:release only supports Windows.");
  }

  if (!installerOnly) {
    run(process.execPath, [path.join(projectRoot, "scripts", "package-windows.cjs")]);
  } else {
    run(process.execPath, [path.join(projectRoot, "scripts", "ensure-electron-runtime.cjs")]);
    runNpm(["run", "build"]);
  }

  runInstallerBuild();
  if (process.env.GOCUS_BUILD) console.log(`Build metadata: ${process.env.GOCUS_BUILD}`);
}

main();
