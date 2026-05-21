const assert = require("node:assert/strict");
const test = require("node:test");

const { DEFAULT_SETTINGS, normalizeSettings } = require("../src/main/settings-store");

test("normalizeSettings keeps valid values and rounds window position", () => {
  const settings = normalizeSettings({
    selectedCharacterId: "jimmy",
    behaviorMode: { type: "locked", state: "waving" },
    sizeMode: "large",
    alwaysOnTop: false,
    autonomousWalkEnabled: false,
    launchAtLogin: true,
    theme: "dark",
    language: "zh-CN",
    petPaused: true,
    hasCompletedOnboarding: true,
    windowPosition: { x: 10.4, y: 99.8 }
  });

  assert.deepEqual(settings, {
    selectedCharacterId: "jimmy",
    behaviorMode: { type: "locked", state: "waving" },
    sizeMode: "large",
    alwaysOnTop: false,
    autonomousWalkEnabled: false,
    launchAtLogin: true,
    theme: "dark",
    language: "zh-CN",
    petPaused: true,
    hasCompletedOnboarding: true,
    windowPosition: { x: 10, y: 100 }
  });
});

test("normalizeSettings falls back from invalid values", () => {
  const settings = normalizeSettings({
    selectedCharacterId: "",
    behaviorMode: { type: "locked", state: 42 },
    sizeMode: "",
    alwaysOnTop: "yes",
    autonomousWalkEnabled: "no",
    launchAtLogin: "later",
    language: "fr",
    petPaused: "maybe",
    hasCompletedOnboarding: "done",
    windowPosition: { x: Infinity, y: 1 }
  });

  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test("normalizeSettings accepts valid theme values and rejects invalid ones", () => {
  assert.equal(normalizeSettings({ theme: "dark" }).theme, "dark");
  assert.equal(normalizeSettings({ theme: "light" }).theme, "light");
  assert.equal(normalizeSettings({ theme: "system" }).theme, "system");
  assert.equal(normalizeSettings({ theme: "invalid" }).theme, "system");
  assert.equal(normalizeSettings({ theme: 42 }).theme, "system");
  assert.equal(normalizeSettings({}).theme, "system");
});
