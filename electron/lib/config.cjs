const fs = require("node:fs");
const path = require("node:path");

const defaultPreferences = {
  accentColor: "#6aa8ff",
  density: "compact",
  fontFamily: "system",
  graphStyle: "solid",
  zenMode: false,
};

function createConfigStore(app) {
  function getConfigPath() {
    return path.join(app.getPath("userData"), "config.json");
  }

  function readConfig() {
    try {
      return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
    } catch {
      return {};
    }
  }

  function writeConfig(config) {
    const configPath = getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  return {
    readConfig,
    writeConfig,
    readRepositoryPath() {
      const repositoryPath = readConfig().repositoryPath;
      return typeof repositoryPath === "string" && repositoryPath ? repositoryPath : null;
    },
    saveRepositoryPath(repositoryPath) {
      writeConfig({ ...readConfig(), repositoryPath });
    },
    clearRepositoryPath() {
      const config = readConfig();
      delete config.repositoryPath;
      writeConfig(config);
    },
    readPreferences() {
      const preferences = readConfig().preferences;
      return { ...defaultPreferences, ...(preferences && typeof preferences === "object" ? preferences : {}) };
    },
    savePreferences(preferences) {
      writeConfig({ ...readConfig(), preferences: { ...defaultPreferences, ...(preferences ?? {}) } });
    },
  };
}

module.exports = { createConfigStore, defaultPreferences };
