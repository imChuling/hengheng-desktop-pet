const assert = require("node:assert/strict");
const test = require("node:test");

const { createAppError, parseAppError } = require("../src/shared/app-error");
const { createImportView } = require("../src/manager/import-view");
const { formatText, UI_TEXT } = require("../src/manager/i18n");

test("app errors round-trip stable code and details", () => {
  const error = createAppError("IMPORT_MISSING_STATE", { state: "idle" });
  assert.deepEqual(parseAppError(error), {
    code: "IMPORT_MISSING_STATE",
    details: { state: "idle" }
  });
});

test("Manager import errors are rendered from localized error code copy", () => {
  const view = createImportView({
    elements: {},
    formatText,
    getSelectedSpritesheet: () => null,
    getSelectedSpritesheetPreview: () => null,
    getText: () => UI_TEXT["zh-CN"],
    setSelectedSpritesheet: () => {},
    stateLabel: (state) => UI_TEXT["zh-CN"].states[state] ?? state
  });

  const message = view.friendlyImportError(createAppError("IMPORT_MISSING_STATE", { state: "idle" }));
  assert.match(message, /缺少“放松”这组动作/u);
  assert.doesNotMatch(message, /IMPORT_MISSING_STATE/u);
});
