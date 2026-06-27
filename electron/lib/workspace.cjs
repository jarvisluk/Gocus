const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { shell } = require("electron");

const workspaceOpenTargetOrder = ["vscode", "cursor", "codex", "antigravity", "antigravityApp", "finder", "terminal", "xcode"];
const darwinAppNamesByTarget = {
  vscode: ["Visual Studio Code"],
  cursor: ["Cursor"],
  codex: ["Codex"],
  antigravity: ["Antigravity IDE"],
  antigravityApp: ["Antigravity"],
  finder: ["Finder"],
  terminal: ["Terminal"],
  xcode: ["Xcode"],
};
const darwinAppPathsByTarget = {
  finder: ["/System/Library/CoreServices/Finder.app"],
  terminal: ["/System/Applications/Utilities/Terminal.app", "/Applications/Utilities/Terminal.app"],
};

function execOpen(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function execOutput(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8", timeout: 3000, ...options }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout ?? "").trim());
    });
  });
}

function commandExists(command) {
  return new Promise((resolve) => {
    const lookupCommand = process.platform === "win32" ? "where" : "which";
    execFile(lookupCommand, [command], (error) => {
      resolve(!error);
    });
  });
}

function possibleDarwinAppPaths(appName) {
  const bundleName = `${appName}.app`;
  return [
    path.join(os.homedir(), "Applications", bundleName),
    path.join("/Applications", bundleName),
    path.join("/System/Applications", bundleName),
    path.join("/System/Applications/Utilities", bundleName),
    path.join("/Applications/Utilities", bundleName),
  ];
}

function darwinAppExists(target) {
  const appNames = darwinAppNamesByTarget[target] ?? [];
  const explicitPaths = darwinAppPathsByTarget[target] ?? [];
  const candidatePaths = [...explicitPaths, ...appNames.flatMap(possibleDarwinAppPaths)];

  return candidatePaths.some((candidatePath) => fs.existsSync(candidatePath));
}

async function openDarwinApp(appNames, repositoryPath) {
  let lastError;

  for (const appName of appNames) {
    try {
      await execOpen("open", ["-a", appName, repositoryPath]);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function nvmCodexCliCandidatePaths(homeDir = os.homedir()) {
  const versionsDir = path.join(homeDir, ".nvm", "versions", "node");
  if (!fs.existsSync(versionsDir)) return [];

  return fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(versionsDir, entry.name, "bin", "codex"))
    .sort()
    .reverse();
}

function codexCliCandidatePaths({ env = process.env, homeDir = os.homedir() } = {}) {
  return [
    env.GOCUS_CODEX_CLI,
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    path.join(homeDir, ".local", "bin", "codex"),
    ...nvmCodexCliCandidatePaths(homeDir),
  ].filter(Boolean);
}

function isExecutableFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandFromLoginShell(command) {
  const shellPath = process.env.SHELL || "/bin/zsh";
  const output = await execOutput(shellPath, ["-lc", `command -v ${command}`]);
  const commandPath = output.split(/\r?\n/).find(Boolean);
  if (!commandPath || !path.isAbsolute(commandPath) || !isExecutableFile(commandPath)) return null;
  return commandPath;
}

async function resolveCodexCliCommand() {
  if (await commandExists("codex")) return "codex";

  try {
    const shellCommand = await resolveCommandFromLoginShell("codex");
    if (shellCommand) return shellCommand;
  } catch {
    // GUI-launched apps may not have a usable login shell environment.
  }

  for (const candidatePath of codexCliCandidatePaths()) {
    if (isExecutableFile(candidatePath)) return candidatePath;
  }

  return null;
}

async function openCodexDesktop(targetPath) {
  const codexCommand = await resolveCodexCliCommand();
  if (codexCommand) {
    await execOpen(codexCommand, ["app", targetPath]);
    return;
  }

  await openDarwinApp(["Codex"], targetPath);
}

function targetLabel(target) {
  if (target === "vscode") return "VS Code";
  if (target === "cursor") return "Cursor";
  if (target === "codex") return "Codex";
  if (target === "antigravity") return "Antigravity IDE";
  if (target === "antigravityApp") return "Antigravity";
  if (target === "finder") return fileManagerLabel();
  if (target === "terminal") return "Terminal";
  if (target === "xcode") return "Xcode";
  return "selected app";
}

function fileManagerLabel() {
  return process.platform === "win32" ? "Explorer" : "Finder";
}

function resolveWorkspaceFilePath(repositoryPath, filePath) {
  if (!repositoryPath) return null;
  if (typeof filePath !== "string" || !filePath.trim()) return null;

  const normalizedPath = path.normalize(filePath);
  if (path.isAbsolute(normalizedPath) || normalizedPath === "." || normalizedPath.startsWith(`..${path.sep}`) || normalizedPath === "..") {
    return null;
  }

  const resolvedPath = path.resolve(repositoryPath, normalizedPath);
  const relativePath = path.relative(repositoryPath, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;

  return resolvedPath;
}

async function isWorkspaceTargetAvailable(target) {
  if (process.platform === "darwin") return darwinAppExists(target);
  if (target === "finder") return true;
  if (target === "terminal") return process.platform === "win32" || commandExists("x-terminal-emulator");
  if (target === "vscode") return commandExists("code");
  if (target === "cursor") return commandExists("cursor");
  return false;
}

async function getAvailableWorkspaceTargets() {
  const availability = await Promise.all(
    workspaceOpenTargetOrder.map(async (target) => ({
      target,
      available: await isWorkspaceTargetAvailable(target),
    })),
  );

  return availability.filter((entry) => entry.available).map((entry) => entry.target);
}

async function openWorkspace(repositoryPath, target) {
  if (!repositoryPath) {
    return { ok: false, reason: "not_configured", error: "Choose a working folder first." };
  }

  try {
    if (target === "finder") {
      const error = await shell.openPath(repositoryPath);
      if (error) throw new Error(error);
      return { ok: true, message: `Opened workspace in ${fileManagerLabel()}.` };
    }

    if (target === "vscode") {
      if (process.platform === "darwin") {
        await execOpen("open", ["-a", "Visual Studio Code", repositoryPath]);
      } else {
        await execOpen("code", [repositoryPath]);
      }
      return { ok: true, message: "Opened workspace in VS Code." };
    }

    if (target === "cursor") {
      if (process.platform === "darwin") {
        await openDarwinApp(["Cursor"], repositoryPath);
      } else {
        await execOpen("cursor", [repositoryPath]);
      }
      return { ok: true, message: "Opened workspace in Cursor." };
    }

    if (target === "codex") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Codex is only available as a macOS app target here." };
      }

      await openCodexDesktop(repositoryPath);
      return { ok: true, message: "Opened workspace in Codex." };
    }

    if (target === "antigravity") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Antigravity IDE is only available as a macOS app target here." };
      }

      await openDarwinApp(["Antigravity IDE"], repositoryPath);
      return { ok: true, message: "Opened workspace in Antigravity IDE." };
    }

    if (target === "antigravityApp") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Antigravity is only available as a macOS app target here." };
      }

      await openDarwinApp(["Antigravity"], repositoryPath);
      return { ok: true, message: "Opened workspace in Antigravity." };
    }

    if (target === "terminal") {
      if (process.platform === "darwin") {
        await execOpen("open", ["-a", "Terminal", repositoryPath]);
      } else if (process.platform === "win32") {
        await execOpen("cmd.exe", ["/c", "start", "", "cmd.exe", "/K", `cd /d "${repositoryPath}"`]);
      } else {
        await execOpen("x-terminal-emulator", ["--working-directory", repositoryPath]);
      }
      return { ok: true, message: "Opened workspace in Terminal." };
    }

    if (target === "xcode") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Xcode is only available on macOS." };
      }

      await execOpen("open", ["-a", "Xcode", repositoryPath]);
      return { ok: true, message: "Opened workspace in Xcode." };
    }

    return { ok: false, reason: "action_failed", error: "Unknown workspace target." };
  } catch (error) {
    return {
      ok: false,
      reason: "action_failed",
      error: error.message || "Unable to open workspace.",
    };
  }
}

async function openWorkspaceFile(repositoryPath, target, filePath) {
  if (!repositoryPath) {
    return { ok: false, reason: "not_configured", error: "Choose a working folder first." };
  }

  const targetPath = resolveWorkspaceFilePath(repositoryPath, filePath);
  if (!targetPath) {
    return { ok: false, reason: "action_failed", error: "Unable to resolve the selected file path." };
  }

  if (!fs.existsSync(targetPath)) {
    return { ok: false, reason: "action_failed", error: "Selected file no longer exists on disk." };
  }

  try {
    if (target === "finder") {
      shell.showItemInFolder(targetPath);
      return { ok: true, message: `Revealed file in ${fileManagerLabel()}.` };
    }

    if (target === "vscode") {
      if (process.platform === "darwin") {
        await execOpen("open", ["-a", "Visual Studio Code", targetPath]);
      } else {
        await execOpen("code", ["-g", targetPath]);
      }
      return { ok: true, message: "Opened file in VS Code." };
    }

    if (target === "cursor") {
      if (process.platform === "darwin") {
        await openDarwinApp(["Cursor"], targetPath);
      } else {
        await execOpen("cursor", ["-g", targetPath]);
      }
      return { ok: true, message: "Opened file in Cursor." };
    }

    if (target === "codex") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Codex is only available as a macOS app target here." };
      }

      await openCodexDesktop(targetPath);
      return { ok: true, message: "Opened file in Codex." };
    }

    if (target === "antigravity") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Antigravity IDE is only available as a macOS app target here." };
      }

      await openDarwinApp(["Antigravity IDE"], targetPath);
      return { ok: true, message: "Opened file in Antigravity IDE." };
    }

    if (target === "antigravityApp") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Antigravity is only available as a macOS app target here." };
      }

      await openDarwinApp(["Antigravity"], targetPath);
      return { ok: true, message: "Opened file in Antigravity." };
    }

    if (target === "terminal") {
      const containingFolder = path.dirname(targetPath);
      if (process.platform === "darwin") {
        await execOpen("open", ["-a", "Terminal", containingFolder]);
      } else if (process.platform === "win32") {
        await execOpen("cmd.exe", ["/c", "start", "", "cmd.exe", "/K", `cd /d "${containingFolder}"`]);
      } else {
        await execOpen("x-terminal-emulator", ["--working-directory", containingFolder]);
      }
      return { ok: true, message: "Opened containing folder in Terminal." };
    }

    if (target === "xcode") {
      if (process.platform !== "darwin") {
        return { ok: false, reason: "action_failed", error: "Xcode is only available on macOS." };
      }

      await execOpen("open", ["-a", "Xcode", targetPath]);
      return { ok: true, message: "Opened file in Xcode." };
    }

    return { ok: false, reason: "action_failed", error: `Unknown ${targetLabel(target)} target.` };
  } catch (error) {
    return {
      ok: false,
      reason: "action_failed",
      error: error.message || "Unable to open file.",
    };
  }
}

module.exports = {
  getAvailableWorkspaceTargets,
  openWorkspace,
  openWorkspaceFile,
  __private: {
    codexCliCandidatePaths,
    nvmCodexCliCandidatePaths,
  },
};
