const defaultWindowAnimationDurationMs = 180;
const defaultWindowAnimationFrameMs = 16;

function easeOutCubic(progress) {
  const clampedProgress = Math.min(Math.max(Number(progress), 0), 1);
  return 1 - Math.pow(1 - clampedProgress, 3);
}

function interpolatedWindowBounds(fromBounds, toBounds, progress) {
  const easedProgress = easeOutCubic(progress);
  return {
    x: Math.round(fromBounds.x + (toBounds.x - fromBounds.x) * easedProgress),
    y: Math.round(fromBounds.y + (toBounds.y - fromBounds.y) * easedProgress),
    width: Math.round(fromBounds.width + (toBounds.width - fromBounds.width) * easedProgress),
    height: Math.round(fromBounds.height + (toBounds.height - fromBounds.height) * easedProgress),
  };
}

function windowBoundsAnimationFrameCount(durationMs = defaultWindowAnimationDurationMs, frameMs = defaultWindowAnimationFrameMs) {
  return Math.max(1, Math.ceil(durationMs / frameMs));
}

module.exports = {
  defaultWindowAnimationDurationMs,
  defaultWindowAnimationFrameMs,
  easeOutCubic,
  interpolatedWindowBounds,
  windowBoundsAnimationFrameCount,
};
