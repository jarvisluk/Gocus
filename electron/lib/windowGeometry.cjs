const expandedMinimumSize = { width: 320, height: 620 };
const defaultExpandedSize = { width: expandedMinimumSize.width, height: 780 };
const collapsedSize = { width: 38, height: 136 };
const temporaryInfoWindowSize = { width: 280, height: 252 };
const changedFileInfoWindowSize = { width: 280, height: 252 };
const commitInfoWindowSize = { width: 348, height: 132 };
const commitInfoWindowMinimumHeight = 92;
const commitInfoWindowMaximumHeight = 240;
const temporaryInfoWindowGap = 10;
const collapsedRailMaximumHeight = 420;

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

function clampCollapsedRailHeight(height, display) {
  const requestedHeight = Math.round(Number(height));
  const availableHeight = Number(display?.height) ? display.height - 16 : collapsedRailMaximumHeight;
  const maximumHeight = Math.max(collapsedSize.height, Math.min(collapsedRailMaximumHeight, availableHeight));

  if (!Number.isFinite(requestedHeight)) return collapsedSize.height;
  return Math.min(Math.max(requestedHeight, collapsedSize.height), maximumHeight);
}

function clampCommitInfoWindowHeight(height, display) {
  const requestedHeight = Math.round(Number(height));
  const availableHeight = Number(display?.height) ? display.height - 16 : commitInfoWindowMaximumHeight;
  const maximumHeight = Math.max(commitInfoWindowMinimumHeight, Math.min(commitInfoWindowMaximumHeight, availableHeight));

  if (!Number.isFinite(requestedHeight)) return commitInfoWindowSize.height;
  return Math.min(Math.max(requestedHeight, commitInfoWindowMinimumHeight), maximumHeight);
}

function mainWindowBounds({ currentBounds, display, collapsed, expandedSize, collapsedWindowSize = collapsedSize }) {
  const size = collapsed ? collapsedWindowSize : expandedSize;
  const edgeInset = collapsed ? 0 : 10;
  const x = display.x + display.width - size.width - edgeInset;
  const fallbackY = display.y + Math.max(18, Math.floor((display.height - size.height) / 2));
  const requestedY = currentBounds?.y ?? fallbackY;
  const minY = display.y + 8;
  const maxY = display.y + display.height - size.height - 8;
  const y = Math.min(Math.max(requestedY, minY), Math.max(minY, maxY));

  return { x, y, width: size.width, height: size.height };
}

function anchorTop(anchorBounds) {
  const top = Number(anchorBounds?.top);
  return Number.isFinite(top) ? Math.round(top) : null;
}

function sideInfoBounds({ mainBounds, display, alignTop = false, size = temporaryInfoWindowSize, anchorBounds = null }) {
  const width = size.width;
  const height = size.height;
  const preferredX = mainBounds.x - width - temporaryInfoWindowGap;
  const fallbackX = mainBounds.x + temporaryInfoWindowGap;
  const x = preferredX >= display.x + 8 ? preferredX : Math.min(fallbackX, display.x + display.width - width - 8);
  const preferredAnchorTop = anchorTop(anchorBounds);
  const preferredY =
    preferredAnchorTop === null ? (alignTop ? mainBounds.y : mainBounds.y + mainBounds.height - height) : mainBounds.y + preferredAnchorTop;
  const minY = display.y + 8;
  const maxY = display.y + display.height - height - 8;
  const y = preferredAnchorTop === null ? Math.min(Math.max(preferredY, minY), Math.max(minY, maxY)) : Math.max(preferredY, minY);

  return { x, y, width, height };
}

function temporaryInfoBounds({ mainBounds, display, alignTop = false }) {
  return sideInfoBounds({ mainBounds, display, alignTop, size: temporaryInfoWindowSize });
}

function changedFileInfoBounds({ temporaryInfoBounds, display }) {
  const width = changedFileInfoWindowSize.width;
  const height = changedFileInfoWindowSize.height;
  const preferredX = temporaryInfoBounds.x - width - temporaryInfoWindowGap;
  const fallbackX = temporaryInfoBounds.x + temporaryInfoBounds.width + temporaryInfoWindowGap;
  const x = preferredX >= display.x + 8 ? preferredX : Math.min(fallbackX, display.x + display.width - width - 8);
  const minY = display.y + 8;
  const maxY = display.y + display.height - height - 8;
  const y = Math.min(Math.max(temporaryInfoBounds.y, minY), Math.max(minY, maxY));

  return { x, y, width, height };
}

function rectanglesOverlap(left, right) {
  return (
    Boolean(left) &&
    Boolean(right) &&
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function commitInfoBounds({ mainBounds, display, alignTop = false, avoidBounds = null, anchorBounds = null, size = commitInfoWindowSize }) {
  const hasAnchor = anchorTop(anchorBounds) !== null;
  const bounds = sideInfoBounds({
    mainBounds,
    display,
    alignTop: true,
    size,
    anchorBounds,
  });
  if (hasAnchor) return bounds;
  if (!rectanglesOverlap(bounds, avoidBounds)) return bounds;

  const minY = display.y + 8;
  const maxY = display.y + display.height - bounds.height - 8;
  const aboveY = avoidBounds.y - bounds.height - temporaryInfoWindowGap;
  const belowY = avoidBounds.y + avoidBounds.height + temporaryInfoWindowGap;

  if (aboveY >= minY) return { ...bounds, y: Math.min(aboveY, maxY) };
  if (belowY <= maxY) return { ...bounds, y: belowY };

  return { ...bounds, y: Math.min(Math.max(aboveY, minY), Math.max(minY, maxY)) };
}

function windowBoundsEqual(left, right) {
  return (
    Boolean(left) &&
    Boolean(right) &&
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

module.exports = {
  clampCommitInfoWindowHeight,
  clampCollapsedRailHeight,
  changedFileInfoBounds,
  changedFileInfoWindowSize,
  collapsedSize,
  commitInfoBounds,
  commitInfoWindowSize,
  defaultExpandedSize,
  expandedMinimumSize,
  expandedSizeFromConfig,
  clampExpandedSize,
  mainWindowBounds,
  temporaryInfoBounds,
  temporaryInfoWindowSize,
  windowBoundsEqual,
};
