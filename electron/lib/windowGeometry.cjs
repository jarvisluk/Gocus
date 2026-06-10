const expandedMinimumSize = { width: 320, height: 620 };
const defaultExpandedSize = { width: expandedMinimumSize.width, height: 780 };
const collapsedSize = { width: 38, height: 154 };
const temporaryInfoWindowSize = { width: 280, height: 252 };
const temporaryInfoWindowGap = 10;

function clampExpandedSize(size, display) {
  return {
    width: Math.min(Math.max(Math.round(size.width), expandedMinimumSize.width), Math.max(expandedMinimumSize.width, display.width - 20)),
    height: Math.min(
      Math.max(Math.round(size.height), expandedMinimumSize.height),
      Math.max(expandedMinimumSize.height, display.height - 16),
    ),
  };
}

function expandedSizeFromConfig(config, display) {
  return clampExpandedSize(config.readExpandedWindowSize() ?? defaultExpandedSize, display);
}

function mainWindowBounds({ currentBounds, display, collapsed, expandedSize }) {
  const size = collapsed ? collapsedSize : expandedSize;
  const edgeInset = collapsed ? 0 : 10;
  const x = display.x + display.width - size.width - edgeInset;
  const fallbackY = display.y + Math.max(18, Math.floor((display.height - size.height) / 2));
  const requestedY = currentBounds?.y ?? fallbackY;
  const minY = display.y + 8;
  const maxY = display.y + display.height - size.height - 8;
  const y = Math.min(Math.max(requestedY, minY), Math.max(minY, maxY));

  return { x, y, width: size.width, height: size.height };
}

function temporaryInfoBounds({ mainBounds, display, alignTop = false }) {
  const width = temporaryInfoWindowSize.width;
  const height = temporaryInfoWindowSize.height;
  const preferredX = mainBounds.x - width - temporaryInfoWindowGap;
  const fallbackX = mainBounds.x + temporaryInfoWindowGap;
  const x = preferredX >= display.x + 8 ? preferredX : Math.min(fallbackX, display.x + display.width - width - 8);
  const preferredY = alignTop ? mainBounds.y : mainBounds.y + mainBounds.height - height;
  const minY = display.y + 8;
  const maxY = display.y + display.height - height - 8;
  const y = Math.min(Math.max(preferredY, minY), Math.max(minY, maxY));

  return { x, y, width, height };
}

module.exports = {
  collapsedSize,
  defaultExpandedSize,
  expandedMinimumSize,
  expandedSizeFromConfig,
  clampExpandedSize,
  mainWindowBounds,
  temporaryInfoBounds,
  temporaryInfoWindowSize,
};
