const MIN_VISIBLE_PX = 48;
const EDGE_OVERHANG_X = 28;
const EDGE_OVERHANG_BOTTOM = 24;
const DEFAULT_RIGHT_MARGIN = 12;
const DEFAULT_BOTTOM_MARGIN = 10;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function intersectSize(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return {
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function isBoundsVisibleInWorkAreas(bounds, workAreas, minVisiblePx = MIN_VISIBLE_PX) {
  const requiredWidth = Math.min(minVisiblePx, bounds.width);
  const requiredHeight = Math.min(minVisiblePx, bounds.height);
  return workAreas.some((workArea) => {
    const intersection = intersectSize(bounds, workArea);
    return intersection.width >= requiredWidth && intersection.height >= requiredHeight;
  });
}

function defaultPositionForWorkArea(bounds, workArea) {
  return {
    x: workArea.x + workArea.width - bounds.width - DEFAULT_RIGHT_MARGIN,
    y: workArea.y + workArea.height - bounds.height - DEFAULT_BOTTOM_MARGIN
  };
}

function clampPositionToWorkArea({ x, y }, bounds, workArea) {
  const maxX = workArea.x + workArea.width - bounds.width;
  const maxY = workArea.y + workArea.height - bounds.height;
  return {
    x: clamp(Math.round(x), workArea.x - EDGE_OVERHANG_X, Math.max(workArea.x, maxX) + EDGE_OVERHANG_X),
    y: clamp(Math.round(y), workArea.y, Math.max(workArea.y, maxY) + EDGE_OVERHANG_BOTTOM)
  };
}

module.exports = {
  DEFAULT_BOTTOM_MARGIN,
  DEFAULT_RIGHT_MARGIN,
  EDGE_OVERHANG_BOTTOM,
  EDGE_OVERHANG_X,
  MIN_VISIBLE_PX,
  clampPositionToWorkArea,
  defaultPositionForWorkArea,
  intersectSize,
  isBoundsVisibleInWorkAreas
};
