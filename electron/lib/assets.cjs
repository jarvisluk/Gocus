const fs = require("node:fs");
const path = require("node:path");

function createAssetLoader({ nativeImage, resourcesPath, electronDir }) {
  function resolveAssetPath(fileName) {
    const candidates = [
      path.join(electronDir, "..", "assets", fileName),
      path.join(resourcesPath ?? "", "assets", fileName),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
  }

  function loadImageAsset(fileName, { template = false } = {}) {
    const image = nativeImage.createFromPath(resolveAssetPath(fileName));
    if (template) image.setTemplateImage(true);
    return image;
  }

  return { resolveAssetPath, loadImageAsset };
}

module.exports = { createAssetLoader };
