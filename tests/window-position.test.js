const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clampPositionToWorkArea,
  defaultPositionForWorkArea,
  isBoundsVisibleInWorkAreas
} = require("../src/main/window-position");

test("window position clamp allows pet to sit closer to left, right, and bottom edges", () => {
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const bounds = { x: 0, y: 0, width: 156, height: 150 };

  assert.deepEqual(clampPositionToWorkArea({ x: -100, y: 880 }, bounds, workArea), {
    x: -28,
    y: 774
  });
  assert.deepEqual(clampPositionToWorkArea({ x: 1500, y: 0 }, bounds, workArea), {
    x: 1312,
    y: 0
  });
});

test("default reset position uses the selected display work area", () => {
  const externalWorkArea = { x: 1440, y: 0, width: 1280, height: 720 };
  const bounds = { width: 156, height: 150 };

  assert.deepEqual(defaultPositionForWorkArea(bounds, externalWorkArea), {
    x: 2552,
    y: 560
  });
});

test("visibility check treats a small visible part as recoverable", () => {
  const workAreas = [{ x: 0, y: 0, width: 1440, height: 900 }];

  assert.equal(isBoundsVisibleInWorkAreas({ x: -120, y: 20, width: 156, height: 150 }, workAreas), false);
  assert.equal(isBoundsVisibleInWorkAreas({ x: -80, y: 20, width: 156, height: 150 }, workAreas), true);
});
