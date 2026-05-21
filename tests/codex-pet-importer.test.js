const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { ROW_COUNTS, sanitizeCharacterId, saveCodexPetFrames } = require("../src/main/codex-pet-importer");
const { parseAppError } = require("../src/shared/app-error");

const PNG_DATA_URL = `data:image/png;base64,${Buffer.from("png").toString("base64")}`;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-test-"));
}

function makeFramesByState() {
  return Object.fromEntries(
    ROW_COUNTS.map(([state, frameCount]) => [
      state,
      Array.from({ length: frameCount }, () => PNG_DATA_URL)
    ])
  );
}

function assertAppError(fn, expectedCode, expectedDetails = {}) {
  assert.throws(fn, (error) => {
    const payload = parseAppError(error);
    assert.equal(payload?.code, expectedCode);
    for (const [key, value] of Object.entries(expectedDetails)) {
      assert.equal(payload.details[key], value);
    }
    return true;
  });
}

test("sanitizeCharacterId keeps ids filesystem-safe", () => {
  assert.equal(sanitizeCharacterId("  My Pet!! 2026  "), "My-Pet-2026");
  assert.equal(sanitizeCharacterId("../../bad/name"), "badname");
  assert.equal(sanitizeCharacterId("___ok___"), "___ok___");
});

test("saveCodexPetFrames validates required states", () => {
  const charactersRoot = makeTempDir();
  const framesByState = makeFramesByState();
  delete framesByState.idle;

  assertAppError(
    () => saveCodexPetFrames({
      charactersRoot,
      characterId: "broken",
      displayName: "Broken",
      framesByState,
      iconDataUrl: PNG_DATA_URL
    }),
    "IMPORT_MISSING_STATE",
    { state: "idle" }
  );
});

test("saveCodexPetFrames preserves existing pet when overwrite validation fails", () => {
  const charactersRoot = makeTempDir();
  saveCodexPetFrames({
    charactersRoot,
    characterId: "buddy",
    displayName: "Buddy",
    framesByState: makeFramesByState(),
    iconDataUrl: PNG_DATA_URL
  });

  const manifestPath = path.join(charactersRoot, "buddy", "manifest.json");
  const originalManifest = fs.readFileSync(manifestPath, "utf8");

  assertAppError(
    () => saveCodexPetFrames({
      charactersRoot,
      characterId: "buddy",
      displayName: "Broken Buddy",
      framesByState: {},
      iconDataUrl: PNG_DATA_URL,
      overwrite: true
    }),
    "IMPORT_MISSING_STATE"
  );

  assert.equal(fs.readFileSync(manifestPath, "utf8"), originalManifest);
});
