#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const sourcePackagePath = path.join(projectRoot, "package.json");
const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, "utf8"));
const productName = process.env.GOCUS_PRODUCT_NAME || "Gocus";
const safeProductName = productName.replaceAll(" ", "");
const version = process.env.GOCUS_VERSION || sourcePackage.version || "0.1.0";
const appArchitecture = process.env.GOCUS_ARCH || process.arch;
const defaultUpdateChannel = "stable";
const defaultUpdateRepository = "jarvisluk/gocus";
const outputRoot = path.join(projectRoot, "release", "windows");
const appPath = path.join(outputRoot, safeProductName);
const resourcesPath = path.join(appPath, "resources");
const payloadPath = path.join(resourcesPath, "app");
const executablePath = path.join(appPath, `${productName}.exe`);

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

function runQuiet(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    run(process.execPath, [npmExecPath, ...args]);
    return;
  }

  run("npm", args, { shell: process.platform === "win32" });
}

function copyRequiredPath(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required package input: ${path.relative(projectRoot, source)}`);
  }
  fs.cpSync(source, destination, { recursive: true });
}

function electronRuntimePath() {
  const electronExecutable = require("electron");
  return path.dirname(electronExecutable);
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

function writePackageManifest() {
  const channels = updateChannels();
  const manifest = {
    name: sourcePackage.name,
    productName,
    version,
    description: sourcePackage.description,
    main: sourcePackage.main,
    repository: sourcePackage.repository,
    updateRepository: channels.stable || defaultUpdateRepository,
    updateChannel: updateChannel(),
    updateChannels: channels,
    private: true,
  };

  fs.writeFileSync(path.join(payloadPath, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function renameMainExecutable() {
  const originalExecutablePath = path.join(appPath, "electron.exe");
  if (originalExecutablePath === executablePath || !fs.existsSync(originalExecutablePath)) return;

  fs.rmSync(executablePath, { force: true });
  fs.renameSync(originalExecutablePath, executablePath);
}

async function stampMainExecutableIcon() {
  const iconPath = path.join(projectRoot, "assets", "app-icon.ico");
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Missing required Windows icon: ${path.relative(projectRoot, iconPath)}`);
  }

  const { rcedit } = await import("rcedit");
  await rcedit(executablePath, { icon: iconPath });
}

function zipApp() {
  const zipName = `${safeProductName}-${version}-win-${appArchitecture}.zip`;
  const zipPath = path.join(outputRoot, zipName);
  fs.rmSync(zipPath, { force: true });
  run(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& { param($source, $destination) Compress-Archive -LiteralPath $source -DestinationPath $destination -Force }",
      appPath,
      zipPath,
    ],
    { cwd: outputRoot },
  );
  return zipPath;
}

function maybeOpenApp() {
  if (!process.argv.includes("--open")) return;
  run("cmd.exe", ["/c", "start", "", executablePath]);
}

function usage() {
  console.log(`Usage: node scripts/package-windows.cjs [--open]

Builds and packages Gocus as a portable Windows app folder and zip.

Outputs:
  release/windows/${safeProductName}
  release/windows/${safeProductName}-<version>-win-<arch>.zip

Options:
  --open        Open the packaged app after building
  -h, --help    Show this help

Environment:
  GOCUS_PRODUCT_NAME           Override the app display name
  GOCUS_VERSION                Override the packaged app version
  GOCUS_BUILD                  Build metadata for release workflows
  GOCUS_ARCH                   Override the release asset architecture label
  GOCUS_UPDATE_REPO            Override the GitHub owner/repo used for updates
  GOCUS_UPDATE_CHANNEL         Mark the packaged update channel: stable or develop
  GOCUS_UPDATE_CHANNELS        JSON owner/repo map, for example {"stable":"owner/repo"}
  GOCUS_UPDATE_STABLE_REPO     Override the stable update repository
  GOCUS_UPDATE_DEVELOP_REPO    Override the develop update repository`);
}

async function main() {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    usage();
    return;
  }

  if (process.platform !== "win32") {
    throw new Error("package:win only supports Windows.");
  }

  run(process.execPath, [path.join(projectRoot, "scripts", "ensure-electron-runtime.cjs")]);
  runNpm(["run", "build"]);

  fs.rmSync(outputRoot, { force: true, recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.cpSync(electronRuntimePath(), appPath, { recursive: true });

  fs.rmSync(path.join(resourcesPath, "default_app.asar"), { force: true });
  fs.rmSync(path.join(resourcesPath, "default_app.asar.unpacked"), { force: true, recursive: true });
  fs.rmSync(payloadPath, { force: true, recursive: true });
  fs.mkdirSync(payloadPath, { recursive: true });

  copyRequiredPath(path.join(projectRoot, "dist"), path.join(payloadPath, "dist"));
  copyRequiredPath(path.join(projectRoot, "electron"), path.join(payloadPath, "electron"));
  copyRequiredPath(path.join(projectRoot, "assets"), path.join(payloadPath, "assets"));
  writePackageManifest();
  renameMainExecutable();
  await stampMainExecutableIcon();

  const zipPath = zipApp();
  maybeOpenApp();

  console.log(`Packaged ${appPath}`);
  console.log(`Created ${zipPath}`);
  if (process.env.GOCUS_BUILD) console.log(`Build metadata: ${process.env.GOCUS_BUILD}`);
  if (runQuiet("git", ["rev-parse", "--is-inside-work-tree"]) === "true") {
    console.log(`Source commit: ${runQuiet("git", ["rev-parse", "--short", "HEAD"])}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
