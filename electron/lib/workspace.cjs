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
      return { ok: true, message: "Opened workspace in Finder." };
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

      await openDarwinApp(["Codex"], repositoryPath);
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

module.exports = { getAvailableWorkspaceTargets, openWorkspace };
