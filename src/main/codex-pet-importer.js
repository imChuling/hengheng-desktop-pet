const fs = require("node:fs");
const path = require("node:path");
const { createAppError } = require("../shared/app-error");

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const MAX_FRAME_DATA_URL_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_DATA_URL_BYTES = 64 * 1024 * 1024;
const ROW_COUNTS = [
  ["idle", 6],
  ["running-right", 8],
  ["running-left", 8],
  ["waving", 4],
  ["jumping", 5],
  ["failed", 8],
  ["waiting", 6],
  ["running", 6],
  ["review", 6]
];

function defaultFrameDurationMs(state) {
  return state.startsWith("running") ? 85 : state === "jumping" ? 110 : 140;
}

function sanitizeCharacterId(input) {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function createCharacterId(input) {
  const safeInput = sanitizeCharacterId(input);
  if (safeInput) {
    return safeInput;
  }

  return `pet-${Date.now().toString(36)}`;
}

function createUniquePath(parentDir, prefix) {
  return path.join(parentDir, `${prefix}-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
}

function buildCharacterManifest(characterId, displayName) {
  return {
    schemaVersion: 1,
    id: characterId,
    name: displayName || characterId,
    source: {
      type: "codex-pet-spritesheet"
    },
    frameSize: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT
    },
    states: Object.fromEntries(
      ROW_COUNTS.map(([state, frameCount]) => [
        state,
        {
          frameCount,
          frameDurationMs: defaultFrameDurationMs(state)
        }
      ])
    )
  };
}

function pngDataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_FRAME_DATA_URL_BYTES) {
    throw createAppError("IMPORT_INVALID_PNG_FRAME");
  }

  const match = /^data:image\/png;base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw createAppError("IMPORT_INVALID_PNG_FRAME");
  }
  return Buffer.from(match[1], "base64");
}

function validateAndDecodeImport({ framesByState, iconDataUrl }) {
  if (!framesByState || typeof framesByState !== "object") {
    throw createAppError("IMPORT_NO_FRAMES");
  }

  let totalDataUrlBytes = typeof iconDataUrl === "string" ? iconDataUrl.length : 0;
  const decodedFramesByState = {};
  for (const [state, frameCount] of ROW_COUNTS) {
    const frames = framesByState[state];
    if (!Array.isArray(frames)) {
      throw createAppError("IMPORT_MISSING_STATE", { state });
    }

    if (frames.length !== frameCount) {
      throw createAppError("IMPORT_WRONG_FRAME_COUNT", {
        state,
        expected: frameCount,
        actual: frames.length
      });
    }

    decodedFramesByState[state] = frames.map((frameDataUrl, column) => {
      totalDataUrlBytes += typeof frameDataUrl === "string" ? frameDataUrl.length : MAX_FRAME_DATA_URL_BYTES + 1;
      if (totalDataUrlBytes > MAX_IMPORT_DATA_URL_BYTES) {
        throw createAppError("IMPORT_TOO_LARGE", { maxMb: 32 });
      }

      try {
        return pngDataUrlToBuffer(frameDataUrl);
      } catch (error) {
        throw createAppError("IMPORT_INVALID_FRAME", { state, frame: column });
      }
    });
  }

  let iconBuffer;
  try {
    iconBuffer = pngDataUrlToBuffer(iconDataUrl);
  } catch (error) {
    throw createAppError("IMPORT_INVALID_ICON");
  }

  return {
    decodedFramesByState,
    iconBuffer
  };
}

function writeCharacterDirectory(characterDir, safeCharacterId, displayName, decodedFramesByState, iconBuffer) {
  fs.mkdirSync(characterDir, { recursive: true });
  for (const [state, frameCount] of ROW_COUNTS) {
    const stateDir = path.join(characterDir, "frames", state);
    fs.mkdirSync(stateDir, { recursive: true });

    decodedFramesByState[state].forEach((frameBuffer, column) => {
      fs.writeFileSync(path.join(stateDir, `${String(column).padStart(2, "0")}.png`), frameBuffer);
    });
  }

  fs.writeFileSync(path.join(characterDir, "icon.png"), iconBuffer);
  fs.writeFileSync(
    path.join(characterDir, "manifest.json"),
    `${JSON.stringify(buildCharacterManifest(safeCharacterId, displayName), null, 2)}\n`,
    "utf8"
  );
}

function replaceDirectoryWithBackup({ sourceDir, targetDir, backupDir }) {
  let backupCreated = false;
  try {
    if (fs.existsSync(targetDir)) {
      fs.renameSync(targetDir, backupDir);
      backupCreated = true;
    }
    fs.renameSync(sourceDir, targetDir);
    if (backupCreated) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (!fs.existsSync(targetDir) && backupCreated && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, targetDir);
    }
    throw error;
  }
}

function saveCodexPetFrames({ charactersRoot, characterId, displayName, framesByState, iconDataUrl, overwrite = false }) {
  const safeCharacterId = createCharacterId(characterId);
  const { decodedFramesByState, iconBuffer } = validateAndDecodeImport({ framesByState, iconDataUrl });

  fs.mkdirSync(charactersRoot, { recursive: true });
  const characterDir = path.join(charactersRoot, safeCharacterId);
  if (fs.existsSync(characterDir) && !overwrite) {
    throw createAppError("IMPORT_DUPLICATE_PET", { name: safeCharacterId });
  }

  const tempDir = createUniquePath(charactersRoot, `.${safeCharacterId}.tmp`);
  const backupDir = createUniquePath(charactersRoot, `.${safeCharacterId}.backup`);

  try {
    writeCharacterDirectory(tempDir, safeCharacterId, displayName, decodedFramesByState, iconBuffer);
    replaceDirectoryWithBackup({
      sourceDir: tempDir,
      targetDir: characterDir,
      backupDir
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  return {
    id: safeCharacterId,
    name: displayName || safeCharacterId,
    directory: characterDir
  };
}

module.exports = {
  CELL_HEIGHT,
  CELL_WIDTH,
  ROW_COUNTS,
  createCharacterId,
  saveCodexPetFrames,
  sanitizeCharacterId
};
