const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { STATE_ORDER, loadAppConfig, readCharacterSummariesFromRoots } = require("./character-store");
const { sanitizeCharacterId, saveCodexPetFrames } = require("./codex-pet-importer");
const { createAppError } = require("../shared/app-error");

function createCharacterService({ app, builtInCharactersRoot }) {
  function assertSafeCharacterId(characterId) {
    if (typeof characterId !== "string" || !characterId || sanitizeCharacterId(characterId) !== characterId) {
      throw createAppError("INVALID_PET_ID");
    }
    return characterId;
  }

  function resolveUserCharacterDir(characterId) {
    const safeCharacterId = assertSafeCharacterId(characterId);
    const charactersRoot = path.resolve(getUserCharactersRoot());
    const characterDir = path.resolve(charactersRoot, safeCharacterId);
    if (characterDir !== path.join(charactersRoot, safeCharacterId)) {
      throw createAppError("INVALID_PET_ID");
    }
    return characterDir;
  }

  function getUserCharactersRoot() {
    return path.join(app.getPath("userData"), "characters");
  }

  function getCharacterRoots() {
    return [getUserCharactersRoot(), builtInCharactersRoot];
  }

  function listCharacters() {
    return readCharacterSummariesFromRoots(getCharacterRoots()).map((character) => ({
      id: character.id,
      name: character.name,
      source: character.root === getUserCharactersRoot() ? "user" : "builtin"
    }));
  }

  function readFrameFiles(stateDir) {
    if (!fs.existsSync(stateDir)) {
      return [];
    }

    return fs
      .readdirSync(stateDir)
      .filter((entry) => entry.endsWith(".png"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((entry) => path.join(stateDir, entry));
  }

  function readCharacterIdsFromRoot(charactersRoot) {
    if (!fs.existsSync(charactersRoot)) {
      return [];
    }

    return fs
      .readdirSync(charactersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  }

  function readCharacterManifestForManager(characterDir, characterId) {
    const manifestPath = path.join(characterDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return {
        manifest: {
          id: characterId,
          name: characterId,
          frameSize: { width: 192, height: 208 },
          states: {}
        },
        manifestValid: true,
        manifestMessage: "Missing manifest.json"
      };
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      return {
        manifest: {
          id: manifest.id ?? characterId,
          name: manifest.name ?? manifest.id ?? characterId,
          frameSize: manifest.frameSize ?? { width: 192, height: 208 },
          states: manifest.states ?? {}
        },
        manifestValid: true,
        manifestMessage: "OK"
      };
    } catch (error) {
      return {
        manifest: {
          id: characterId,
          name: characterId,
          frameSize: { width: 192, height: 208 },
          states: {}
        },
        manifestValid: false,
        manifestMessage: `Invalid manifest.json: ${error.message}`
      };
    }
  }

  function inspectCharacter(characterId, characterDir, source, { includeFrames = true, lightweight = false } = {}) {
    const { manifest, manifestValid, manifestMessage } = readCharacterManifestForManager(characterDir, characterId);
    const frameRoot = path.join(characterDir, "frames");
    const idleFrames = readFrameFiles(path.join(frameRoot, "idle"));
    const states = STATE_ORDER.map((state) => {
      const frames = state === "idle" ? idleFrames : readFrameFiles(path.join(frameRoot, state));
      return {
        name: state,
        frameCount: frames.length,
        expectedFrameCount: manifest.states[state]?.frameCount ?? null,
        status: frames.length > 0 ? "ok" : state === "idle" ? "missing" : "fallback",
        frames: includeFrames && !lightweight ? (frames.length > 0 ? frames : idleFrames).map((framePath) => pathToFileURL(framePath).href) : []
      };
    });
    const iconPath = path.join(characterDir, "icon.png");
    const issues = [];

    if (!manifestValid || manifestMessage !== "OK") {
      issues.push(manifestMessage);
    }
    if (!fs.existsSync(iconPath)) {
      issues.push("Missing icon.png");
    }
    if (idleFrames.length === 0) {
      issues.push("Missing frames/idle PNG frames");
    }
    if (!lightweight) {
      for (const state of states) {
        if (state.status === "fallback") {
          issues.push(`${state.name} falls back to idle`);
        }
      }
    }

    return {
      id: characterId,
      manifestId: manifest.id,
      name: manifest.name,
      source,
      directory: characterDir,
      icon: fs.existsSync(iconPath) ? pathToFileURL(iconPath).href : null,
      thumbnail: idleFrames[0] ? pathToFileURL(idleFrames[0]).href : null,
      frameSize: manifest.frameSize,
      valid: manifestValid && fs.existsSync(iconPath) && idleFrames.length > 0,
      issues,
      states
    };
  }

  function listCharacterDetails() {
    const roots = getCharacterRoots();
    const seenIds = new Set();
    const details = [];

    for (const charactersRoot of roots) {
      const source = charactersRoot === getUserCharactersRoot() ? "user" : "builtin";
      for (const characterId of readCharacterIdsFromRoot(charactersRoot).sort((a, b) => a.localeCompare(b))) {
        if (seenIds.has(characterId)) continue;
        seenIds.add(characterId);
        details.push(
          inspectCharacter(characterId, path.join(charactersRoot, characterId), source, {
            includeFrames: false,
            lightweight: true
          })
        );
      }
    }

    return details;
  }

  function getCharacterDetail(characterId) {
    assertSafeCharacterId(characterId);
    for (const charactersRoot of getCharacterRoots()) {
      const source = charactersRoot === getUserCharactersRoot() ? "user" : "builtin";
      const characterDir = path.join(charactersRoot, characterId);
      if (fs.existsSync(characterDir)) {
        return inspectCharacter(characterId, characterDir, source, { includeFrames: true });
      }
    }

    throw createAppError("PET_NOT_FOUND");
  }

  function loadConfig({ selectedCharacterId, behaviorMode, sizeMode }) {
    return loadAppConfig({
      charactersRoot: getCharacterRoots(),
      selectedCharacterId,
      behaviorMode,
      sizeMode
    });
  }

  function importPet({ characterName, framesByState, iconDataUrl, overwrite }) {
    return saveCodexPetFrames({
      charactersRoot: getUserCharactersRoot(),
      characterId: characterName,
      displayName: characterName,
      framesByState,
      iconDataUrl,
      overwrite
    });
  }

  function deleteImportedPet(characterId) {
    const characterDir = resolveUserCharacterDir(characterId);
    if (!fs.existsSync(characterDir)) {
      throw createAppError("DELETE_BUILTIN_PET");
    }

    fs.rmSync(characterDir, { recursive: true, force: true });
  }

  function renameImportedPet(characterId, nextName) {
    const characterDir = resolveUserCharacterDir(characterId);
    if (!fs.existsSync(characterDir)) {
      throw createAppError("RENAME_BUILTIN_PET");
    }

    const trimmedName = String(nextName ?? "").trim();
    if (!trimmedName) {
      throw createAppError("PET_NAME_REQUIRED");
    }

    const manifestPath = path.join(characterDir, "manifest.json");
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      : { schemaVersion: 1, id: characterId };
    manifest.id = manifest.id ?? characterId;
    manifest.name = trimmedName;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    return {
      id: characterId,
      name: trimmedName
    };
  }

  function resolveCharacterIconPath(characterId) {
    for (const charactersRoot of getCharacterRoots()) {
      const iconPath = path.join(charactersRoot, characterId, "icon.png");
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }
    return path.join(builtInCharactersRoot, characterId, "icon.png");
  }

  return {
    deleteImportedPet,
    getCharacterDetail,
    getCharacterRoots,
    importPet,
    listCharacterDetails,
    listCharacters,
    loadConfig,
    renameImportedPet,
    resolveCharacterIconPath
  };
}

module.exports = {
  createCharacterService
};
