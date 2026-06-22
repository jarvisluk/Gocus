#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const defaultTargetVersionPath = path.join(projectRoot, ".github", "develop-next-version");
const stableSemverPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const candidateSemverPattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/;

function trimmed(value) {
  return String(value ?? "").trim();
}

function readDevelopNextVersion(filePath = defaultTargetVersionPath) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").trim();
}

function targetVersionFromPackageVersion(packageVersion) {
  const match = trimmed(packageVersion).match(/^([0-9]+)\.([0-9]+)\.([0-9]+)(?:[-+].*)?$/);
  if (!match) {
    throw new Error(`Cannot derive a develop target version from package.json version: ${packageVersion}`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function requireRunNumber(runNumber) {
  const value = trimmed(runNumber);
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("GITHUB_RUN_NUMBER is required to derive a develop candidate version.");
  }
  return value;
}

function resolveDevelopReleaseVersion({ inputVersion = "", developNextVersion = "", packageVersion = "", runNumber = "" }) {
  const manualVersion = trimmed(inputVersion);
  if (manualVersion) {
    if (!candidateSemverPattern.test(manualVersion)) {
      throw new Error(`Candidate version must be semver-like: ${manualVersion}.`);
    }
    return {
      source: "manual",
      targetVersion: "",
      version: manualVersion,
    };
  }

  let targetVersion = trimmed(developNextVersion);
  let source = "develop-next-version";
  if (!targetVersion) {
    targetVersion = targetVersionFromPackageVersion(packageVersion);
    source = "package-json-patch";
  }

  if (!stableSemverPattern.test(targetVersion)) {
    throw new Error(`Develop target version must be stable semver like 0.2.0: ${targetVersion}.`);
  }

  return {
    source,
    targetVersion,
    version: `${targetVersion}-dev.${requireRunNumber(runNumber)}`,
  };
}

function appendGitHubOutput(outputs) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  fs.appendFileSync(outputPath, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
}

function main() {
  const packageVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version;
  const resolved = resolveDevelopReleaseVersion({
    inputVersion: process.env.INPUT_VERSION,
    developNextVersion: readDevelopNextVersion(process.env.DEVELOP_NEXT_VERSION_PATH || defaultTargetVersionPath),
    packageVersion,
    runNumber: process.env.GITHUB_RUN_NUMBER,
  });

  appendGitHubOutput({
    version: resolved.version,
    target_version: resolved.targetVersion,
    version_source: resolved.source,
  });
  console.log(resolved.version);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = {
  readDevelopNextVersion,
  resolveDevelopReleaseVersion,
  targetVersionFromPackageVersion,
};
