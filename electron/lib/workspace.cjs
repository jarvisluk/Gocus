const { execFile } = require("node:child_process");
const { shell } = require("electron");

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
        await execOpen("open", ["-a", "Cursor", repositoryPath]);
      } else {
        await execOpen("cursor", [repositoryPath]);
      }
      return { ok: true, message: "Opened workspace in Cursor." };
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

module.exports = { openWorkspace };
