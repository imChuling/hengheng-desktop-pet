const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CELL_HEIGHT,
  CELL_WIDTH,
  EXPECTED_COLUMNS,
  ROW_COUNTS,
  inspectSpritesheetDimensions
} = require("../src/shared/codex-spritesheet");

test("inspectSpritesheetDimensions accepts the expected 9-action sheet size", () => {
  const preview = inspectSpritesheetDimensions(CELL_WIDTH * EXPECTED_COLUMNS, CELL_HEIGHT * ROW_COUNTS.length);

  assert.equal(preview.valid, true);
  assert.equal(preview.expectedWidth, 1536);
  assert.equal(preview.expectedHeight, 1872);
  assert.equal(preview.states.length, 9);
  assert.equal(preview.states.every((state) => state.status === "ready"), true);
});

test("inspectSpritesheetDimensions reports missing action rows for short sheets", () => {
  const preview = inspectSpritesheetDimensions(CELL_WIDTH * EXPECTED_COLUMNS, CELL_HEIGHT * 3);

  assert.equal(preview.valid, false);
  assert.equal(preview.states.filter((state) => state.status === "ready").length, 3);
  assert.equal(preview.states.find((state) => state.name === "waving").status, "missing");
});
