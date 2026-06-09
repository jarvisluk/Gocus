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
    const assetPath = resolveAssetPath(fileName);
    if (!fs.existsSync(assetPath)) {
      const missingImage = nativeImage.createFromPath(assetPath);
      if (template) missingImage.setTemplateImage(true);
      return missingImage;
    }

    const image = nativeImage.createFromBuffer(fs.readFileSync(assetPath));

    const extension = path.extname(assetPath);
    const basePath = assetPath.slice(0, -extension.length);
    const highResolutionPath = `${basePath}@2x${extension}`;
    if (fs.existsSync(highResolutionPath)) {
      const dataUrl = `data:image/png;base64,${fs.readFileSync(highResolutionPath).toString("base64")}`;
      image.addRepresentation({ scaleFactor: 2, dataURL: dataUrl });
    }

    if (template) image.setTemplateImage(true);
    return image;
  }

  return { resolveAssetPath, loadImageAsset };
}

module.exports = { createAssetLoader };
