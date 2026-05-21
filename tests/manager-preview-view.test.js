const assert = require("node:assert/strict");
const test = require("node:test");

const { defaultFrameDuration } = require("../src/manager/preview-view");

test("manager preview view keeps animation timing policy centralized", () => {
  assert.equal(defaultFrameDuration("running-left"), 85);
  assert.equal(defaultFrameDuration("running-right"), 85);
  assert.equal(defaultFrameDuration("jumping"), 110);
  assert.equal(defaultFrameDuration("idle"), 140);
});
