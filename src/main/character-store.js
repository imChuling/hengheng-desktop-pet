const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const STATE_ORDER = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review"
];
const DEFAULT_STATE = "idle";

const BEHAVIOR_MENU_STATES = [...STATE_ORDER];

const SIZE_PRESETS = {
  large: { width: 210, height: 228 },
  default: { width: 156, height: 150 },
  small: { width: 128, height: 108 }
};

const DEFAULT_FRAME_SIZE = {
  width: 192,
  height: 208
};

function defaultFrameDurationMs(state) {
  return state.startsWith("running") ? 85 : state === "jumping" ? 110 : 140;
}

function warnInvalidCharacter(characterId, message) {
  console.warn(`[desktop-pet] Skipping invalid character "${characterId}": ${message}`);
}

function warnCharacterFallback(characterId, state, message) {
  console.warn(`[desktop-pet] Character "${characterId}" state "${state}" uses idle fallback: ${message}`);
}

function readCharacterPackageManifest(characterDir, characterId) {
  const manifestPath = path.join(characterDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return {
      schemaVersion: 0,
      id: characterId,
      name: characterId,
      frameSize: DEFAULT_FRAME_SIZE,
      states: {}
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid manifest.json: ${error.message}`);
  }

  return {
    schemaVersion: manifest.schemaVersion ?? 1,
    id: manifest.id ?? characterId,
    name: manifest.name ?? manifest.id ?? characterId,
    frameSize: manifest.frameSize ?? DEFAULT_FRAME_SIZE,
    states: manifest.states ?? {}
  };
}

function readStateFrames(stateDir) {
  if (!fs.existsSync(stateDir)) {
    return [];
  }

  return fs
    .readdirSync(stateDir)
    .filter((entry) => entry.endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((entry) => pathToFileURL(path.join(stateDir, entry)).href);
}

function readCharacterIds(charactersRoot) {
  return fs
    .readdirSync(charactersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function readCharacterIdsFromRoots(characterRoots) {
  const characterIds = new Set();
  for (const charactersRoot of characterRoots) {
    if (!fs.existsSync(charactersRoot)) continue;
    for (const characterId of readCharacterIds(charactersRoot)) {
      characterIds.add(characterId);
    }
  }
  return [...characterIds].sort((a, b) => a.localeCompare(b));
}

function readCharacterSummariesFromRoots(characterRoots) {
  return readCharacterIdsFromRoots(characterRoots).flatMap((characterId) => {
    const characterDir = resolveCharacterDir(characterRoots, characterId);
    try {
      const manifest = readCharacterPackageManifest(characterDir, characterId);
      const idleFrames = readStateFrames(path.join(characterDir, "frames", "idle"));
      if (idleFrames.length === 0) {
        warnInvalidCharacter(characterId, "missing frames/idle PNG frames");
        return [];
      }
      return [
        {
          id: characterId,
          name: manifest.name ?? characterId,
          root: path.dirname(characterDir)
        }
      ];
    } catch (error) {
      warnInvalidCharacter(characterId, error.message);
      return [];
    }
  });
}

function resolveCharacterDir(characterRoots, characterId) {
  for (const charactersRoot of characterRoots) {
    const characterDir = path.join(charactersRoot, characterId);
    if (fs.existsSync(characterDir)) {
      return characterDir;
    }
  }
  return path.join(characterRoots[0], characterId);
}

function loadCharacterManifest(charactersRoot, characterId) {
  const characterRoots = Array.isArray(charactersRoot) ? charactersRoot : [charactersRoot];
  const characterDir = resolveCharacterDir(characterRoots, characterId);
  const frameRoot = path.join(characterDir, "frames");
  const packageManifest = readCharacterPackageManifest(characterDir, characterId);
  const states = {};
  const idleFrames = readStateFrames(path.join(frameRoot, DEFAULT_STATE));
  if (idleFrames.length === 0) {
    throw new Error("Character must contain at least one frames/idle PNG frame.");
  }

  for (const state of STATE_ORDER) {
    const stateDir = path.join(frameRoot, state);
    const stateManifest = packageManifest.states[state] ?? {};
    const frames = readStateFrames(stateDir);
    const resolvedFrames = frames.length > 0 ? frames : idleFrames;
    if (frames.length === 0 && state !== DEFAULT_STATE) {
      warnCharacterFallback(characterId, state, "state folder is missing or empty");
    }

    states[state] = {
      frames: resolvedFrames,
      frameDurationMs: stateManifest.frameDurationMs ?? defaultFrameDurationMs(state)
    };
  }

  return {
    id: packageManifest.id,
    name: packageManifest.name,
    width: packageManifest.frameSize.width ?? DEFAULT_FRAME_SIZE.width,
    height: packageManifest.frameSize.height ?? DEFAULT_FRAME_SIZE.height,
    states
  };
}

function loadAppConfig({ charactersRoot, selectedCharacterId, behaviorMode, sizeMode }) {
  const characterRoots = Array.isArray(charactersRoot) ? charactersRoot : [charactersRoot];
  const characters = readCharacterIdsFromRoots(characterRoots).flatMap((characterId) => {
    try {
      return [loadCharacterManifest(characterRoots, characterId)];
    } catch (error) {
      warnInvalidCharacter(characterId, error.message);
      return [];
    }
  });

  const resolvedCharacterId = characters.find((character) => character.id === selectedCharacterId)
    ? selectedCharacterId
    : characters[0]?.id ?? "lcl2";

  return {
    selectedCharacterId: resolvedCharacterId,
    behaviorMode,
    sizeMode,
    characters
  };
}

function getWindowSizeForMode(mode) {
  return SIZE_PRESETS[mode] ?? SIZE_PRESETS.default;
}

module.exports = {
  BEHAVIOR_MENU_STATES,
  SIZE_PRESETS,
  STATE_ORDER,
  getWindowSizeForMode,
  loadAppConfig,
  readCharacterIds,
  readCharacterIdsFromRoots,
  readCharacterSummariesFromRoots,
  readCharacterPackageManifest
};
