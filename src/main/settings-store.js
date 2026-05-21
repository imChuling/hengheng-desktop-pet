const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_FILE_NAME = "settings.json";
const SAVE_DEBOUNCE_MS = 500;

const DEFAULT_SETTINGS = {
  selectedCharacterId: "lcl2",
  behaviorMode: { type: "auto" },
  sizeMode: "default",
  alwaysOnTop: true,
  autonomousWalkEnabled: true,
  launchAtLogin: false,
  theme: "system",
  language: "en",
  petPaused: false,
  hasCompletedOnboarding: false,
  windowPosition: null
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSettings(rawSettings) {
  const settings = isPlainObject(rawSettings) ? rawSettings : {};
  const behaviorMode = isPlainObject(settings.behaviorMode) ? settings.behaviorMode : DEFAULT_SETTINGS.behaviorMode;
  const windowPosition = isPlainObject(settings.windowPosition) ? settings.windowPosition : null;

  return {
    selectedCharacterId:
      typeof settings.selectedCharacterId === "string" && settings.selectedCharacterId
        ? settings.selectedCharacterId
        : DEFAULT_SETTINGS.selectedCharacterId,
    behaviorMode:
      behaviorMode.type === "locked" && typeof behaviorMode.state === "string"
        ? { type: "locked", state: behaviorMode.state }
        : { type: "auto" },
    sizeMode: typeof settings.sizeMode === "string" && settings.sizeMode ? settings.sizeMode : DEFAULT_SETTINGS.sizeMode,
    alwaysOnTop: typeof settings.alwaysOnTop === "boolean" ? settings.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    autonomousWalkEnabled:
      typeof settings.autonomousWalkEnabled === "boolean"
        ? settings.autonomousWalkEnabled
        : DEFAULT_SETTINGS.autonomousWalkEnabled,
    launchAtLogin:
      typeof settings.launchAtLogin === "boolean" ? settings.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    theme: ["system", "light", "dark"].includes(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
    language: settings.language === "zh-CN" ? "zh-CN" : DEFAULT_SETTINGS.language,
    petPaused: typeof settings.petPaused === "boolean" ? settings.petPaused : DEFAULT_SETTINGS.petPaused,
    hasCompletedOnboarding:
      typeof settings.hasCompletedOnboarding === "boolean"
        ? settings.hasCompletedOnboarding
        : DEFAULT_SETTINGS.hasCompletedOnboarding,
    windowPosition:
      windowPosition && isFiniteNumber(windowPosition.x) && isFiniteNumber(windowPosition.y)
        ? { x: Math.round(windowPosition.x), y: Math.round(windowPosition.y) }
        : null
  };
}

function createSettingsStore({ app }) {
  let settings = { ...DEFAULT_SETTINGS };
  let saveTimer = null;

  function getSettingsPath() {
    return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
  }

  function writeSettings() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    const settingsPath = getSettingsPath();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  }

  function scheduleWrite() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(writeSettings, SAVE_DEBOUNCE_MS);
  }

  function load() {
    try {
      const settingsPath = getSettingsPath();
      if (!fs.existsSync(settingsPath)) {
        settings = { ...DEFAULT_SETTINGS };
        return settings;
      }

      settings = normalizeSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
      return settings;
    } catch {
      settings = { ...DEFAULT_SETTINGS };
      return settings;
    }
  }

  function get() {
    return settings;
  }

  function update(patch, { debounce = false } = {}) {
    settings = normalizeSettings({
      ...settings,
      ...patch
    });

    if (debounce) {
      scheduleWrite();
    } else {
      writeSettings();
    }

    return settings;
  }

  function flush() {
    writeSettings();
  }

  return {
    flush,
    get,
    load,
    update
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  createSettingsStore,
  normalizeSettings
};
