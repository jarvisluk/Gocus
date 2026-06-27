#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { downloadArtifact } = require("@electron/get");
const extract = require("extract-zip");

delete process.env.ELECTRON_OVERRIDE_DIST_PATH;
delete process.env.ELECTRON_SKIP_BINARY_DOWNLOAD;
delete process.env.npm_config_electron_skip_binary_download;

const electronPackagePath = require.resolve("electron/package.json");
const electronRoot = path.dirname(electronPackagePath);
const { version } = require(electronPackagePath);
const electronInstallScript = path.join(electronRoot, "install.js");
const platform = process.env.npm_config_platform || os.platform();
const arch = process.env.npm_config_arch || os.arch();
const platformPath = getPlatformPath(platform);
const distPath = path.join(electronRoot, "dist");
const pathFile = path.join(electronRoot, "path.txt");
const runtimePath = path.join(distPath, platformPath);

function getPlatformPath(targetPlatform) {
  switch (targetPlatform) {
    case "mas":
    case "darwin":
      return "Electron.app/Contents/MacOS/Electron";
    case "freebsd":
    case "openbsd":
    case "linux":
      return "electron";
    case "win32":
      return "electron.exe";
    default:
      throw new Error(`Electron builds are not available on platform: ${targetPlatform}`);
  }
}

function installedRuntimeMatches() {
  try {
    const installedVersion = fs.readFileSync(path.join(distPath, "version"), "utf8").replace(/^v/, "").trim();
    const installedPath = fs.readFileSync(pathFile, "utf8").trim();
    return installedVersion === version && installedPath === platformPath && fs.existsSync(runtimePath);
  } catch {
    return false;
  }
}

function listDistContents() {
  try {
    return fs.readdirSync(distPath).join(", ");
  } catch (error) {
    return `${error.code || error.name}: ${error.message}`;
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function runOfficialElectronInstaller() {
  if (!fs.existsSync(electronInstallScript)) return false;
  run(process.execPath, [electronInstallScript]);
  return true;
}

async function extractArchive(zipPath) {
  if (process.platform === "darwin") {
    run("/usr/bin/ditto", ["-x", "-k", zipPath, distPath]);
    return;
  }

  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "& { param($source, $destination) Expand-Archive -LiteralPath $source -DestinationPath $destination -Force }",
      zipPath,
      distPath,
    ]);
    return;
  }

  await extract(zipPath, { dir: distPath });
}

async function installRuntime() {
  console.log(`Ensuring Electron ${version} runtime for ${platform}-${arch}.`);

  if (installedRuntimeMatches()) {
    console.log(`Electron runtime ready: ${runtimePath}`);
    return;
  }

  if (runOfficialElectronInstaller() && installedRuntimeMatches()) {
    console.log(`Electron runtime ready: ${runtimePath}`);
    return;
  }

  fs.rmSync(distPath, { force: true, recursive: true });
  fs.rmSync(pathFile, { force: true });
  fs.mkdirSync(distPath, { recursive: true });

  const zipPath = await downloadArtifact({
    version,
    artifactName: "electron",
    platform,
    arch,
    cacheRoot: process.env.electron_config_cache,
    checksums: require(path.join(electronRoot, "checksums.json")),
    force: process.env.CI === "true" || process.env.force_no_cache === "true",
  });
  console.log(`Downloaded Electron runtime archive: ${zipPath}`);

  await extractArchive(zipPath);

  const extractedTypesPath = path.join(distPath, "electron.d.ts");
  if (fs.existsSync(extractedTypesPath)) {
    fs.renameSync(extractedTypesPath, path.join(electronRoot, "electron.d.ts"));
  }

  fs.writeFileSync(pathFile, platformPath);

  if (!installedRuntimeMatches()) {
    throw new Error(
      [
        `Electron runtime install did not produce a usable executable: ${runtimePath}`,
        `dist contents: ${listDistContents()}`,
      ].join("\n"),
    );
  }

  console.log(`Electron runtime installed: ${runtimePath}`);
}

installRuntime().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
