const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const sourcePackagePath = path.join(projectRoot, "package.json");
const sourcePackage = JSON.parse(fs.readFileSync(sourcePackagePath, "utf8"));
const productName = process.env.GIT_PEEK_PRODUCT_NAME || "Git Peek";
const bundleIdentifier = process.env.GIT_PEEK_BUNDLE_ID || "com.junrong.git-peek";
const version = process.env.GIT_PEEK_VERSION || sourcePackage.version || "0.1.0";
const outputRoot = path.join(projectRoot, "release", "macos");
const appPath = path.join(outputRoot, `${productName}.app`);
const installedAppPath = path.join("/Applications", `${productName}.app`);
const appContentsPath = path.join(appPath, "Contents");
const appMacOSPath = path.join(appContentsPath, "MacOS");
const appResourcesPath = path.join(appContentsPath, "Resources");
const payloadPath = path.join(appResourcesPath, "app");
const plistPath = path.join(appContentsPath, "Info.plist");
const installedExecutablePath = path.join(installedAppPath, "Contents", "MacOS", productName);

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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function copyRequiredPath(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required package input: ${path.relative(projectRoot, source)}`);
  }
  fs.cpSync(source, destination, { recursive: true });
}

function setPlistValue(key, value) {
  run("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath]);
}

function deletePlistValue(key) {
  spawnSync("/usr/libexec/PlistBuddy", ["-c", `Delete :${key}`, plistPath], {
    cwd: projectRoot,
    stdio: "ignore",
  });
}

function electronAppSourcePath() {
  const electronExecutable = require("electron");
  return path.join(path.dirname(electronExecutable), "..", "..");
}

function copyAppBundle(source, destination) {
  fs.rmSync(destination, { force: true, recursive: true });
  run("/usr/bin/ditto", [source, destination]);
}

function runningInstalledAppPids() {
  const result = spawnSync("/bin/ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
  });

  if (result.status !== 0) return [];

  return result.stdout
    .split("\n")
    .map((line) => {
      const match = line.trimStart().match(/^(\d+)\s+(.*)$/);
      if (!match) return null;

      const [, pid, command] = match;
      return command.startsWith(installedExecutablePath) ? Number(pid) : null;
    })
    .filter((pid) => Number.isInteger(pid));
}

function waitForInstalledAppExit(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runningInstalledAppPids().length === 0) return true;
    sleep(250);
  }

  return runningInstalledAppPids().length === 0;
}

function quitInstalledApp() {
  const pids = runningInstalledAppPids();
  if (pids.length === 0) return false;

  console.log(`Quitting running ${installedAppPath} before installing update.`);
  runQuiet("/usr/bin/osascript", ["-e", `tell application id "${bundleIdentifier}" to quit`]);
  if (waitForInstalledAppExit(8000)) return true;

  console.log(`Running ${productName} did not quit in time; sending SIGTERM.`);
  for (const pid of runningInstalledAppPids()) {
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }

  if (waitForInstalledAppExit(5000)) return true;

  console.log(`Running ${productName} still did not quit; forcing quit.`);
  for (const pid of runningInstalledAppPids()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }

  if (waitForInstalledAppExit(5000)) return true;

  throw new Error(`Could not quit running ${installedAppPath}. Quit it manually and run npm run package:mac again.`);
}

function writePackageManifest() {
  const manifest = {
    name: sourcePackage.name,
    productName,
    version,
    description: sourcePackage.description,
    main: sourcePackage.main,
    private: true,
  };

  fs.writeFileSync(path.join(payloadPath, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function renameMainExecutable() {
  const originalExecutablePath = path.join(appMacOSPath, "Electron");
  const renamedExecutablePath = path.join(appMacOSPath, productName);
  if (originalExecutablePath === renamedExecutablePath || !fs.existsSync(originalExecutablePath)) return;

  fs.rmSync(renamedExecutablePath, { force: true });
  fs.renameSync(originalExecutablePath, renamedExecutablePath);
}

function maybeSignApp() {
  if (process.env.SKIP_CODESIGN === "1") return;

  const identity = process.env.CODESIGN_IDENTITY || "-";
  run("/usr/bin/codesign", ["--force", "--deep", "--sign", identity, appPath]);
}

function zipApp() {
  const zipName = `${productName.replaceAll(" ", "")}-${version}-macOS.zip`;
  const zipPath = path.join(outputRoot, zipName);
  fs.rmSync(zipPath, { force: true });
  run("/usr/bin/ditto", ["-c", "-k", "--keepParent", `${productName}.app`, zipName], { cwd: outputRoot });
  return zipPath;
}

function shouldInstallApp() {
  return !process.argv.includes("--no-install");
}

function maybeInstallApp() {
  if (!shouldInstallApp()) {
    console.log("Skipped /Applications install (--no-install).");
    return null;
  }

  const shouldReopen = quitInstalledApp();
  copyAppBundle(appPath, installedAppPath);
  console.log(`Installed ${installedAppPath}`);
  return {
    path: installedAppPath,
    shouldReopen,
  };
}

function maybeOpenApp(openPath = appPath, options = {}) {
  if (!process.argv.includes("--open") && !options.shouldReopen) return;
  run("/usr/bin/open", [openPath]);
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("package:mac only supports macOS.");
  }

  run("npm", ["run", "build"]);

  fs.rmSync(outputRoot, { force: true, recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  copyAppBundle(electronAppSourcePath(), appPath);

  fs.rmSync(path.join(appResourcesPath, "default_app.asar"), { force: true });
  fs.rmSync(path.join(appResourcesPath, "default_app.asar.unpacked"), { force: true, recursive: true });
  fs.rmSync(payloadPath, { force: true, recursive: true });
  fs.mkdirSync(payloadPath, { recursive: true });

  copyRequiredPath(path.join(projectRoot, "dist"), path.join(payloadPath, "dist"));
  copyRequiredPath(path.join(projectRoot, "electron"), path.join(payloadPath, "electron"));
  copyRequiredPath(path.join(projectRoot, "assets"), path.join(payloadPath, "assets"));
  copyRequiredPath(path.join(projectRoot, "assets", "app-icon.icns"), path.join(appResourcesPath, "app-icon.icns"));
  writePackageManifest();

  deletePlistValue("ElectronAsarIntegrity");
  setPlistValue("CFBundleDisplayName", productName);
  setPlistValue("CFBundleExecutable", productName);
  setPlistValue("CFBundleName", productName);
  setPlistValue("CFBundleIdentifier", bundleIdentifier);
  setPlistValue("CFBundleShortVersionString", version);
  setPlistValue("CFBundleVersion", process.env.GIT_PEEK_BUILD || runQuiet("git", ["rev-parse", "--short", "HEAD"]) || version);
  setPlistValue("CFBundleIconFile", "app-icon.icns");
  setPlistValue("LSApplicationCategoryType", "public.app-category.developer-tools");
  renameMainExecutable();

  maybeSignApp();
  const zipPath = zipApp();
  const installedApp = maybeInstallApp();
  const openPath = installedApp?.path ?? appPath;
  maybeOpenApp(openPath, { shouldReopen: installedApp?.shouldReopen });

  console.log(`Packaged ${appPath}`);
  console.log(`Created ${zipPath}`);
}

main();
