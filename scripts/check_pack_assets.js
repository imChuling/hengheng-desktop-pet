#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
const CHARACTERS_DIR = path.join(ASSETS_DIR, "characters");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const FONT_WARN_BYTES = 8 * 1024 * 1024;
const FONT_FAIL_BYTES = 32 * 1024 * 1024;
const MANAGER_FONT = "assets/fonts/LXGWWenKai-UI-Subset.woff2";
const EXPECTED_STATES = [
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
const PACKAGED_ASSET_DIRS = new Set(["characters", "fonts"]);
const TEMP_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", "frames-manifest.json"]);

const errors = [];
const warnings = [];

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${relative(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name));
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function checkBuildFileGlobs() {
  const packageJson = readJson(PACKAGE_JSON);
  if (!packageJson) return;

  const files = packageJson.build?.files;
  if (!Array.isArray(files)) {
    errors.push("package.json build.files must be an explicit allowlist.");
    return;
  }

  if (files.includes("assets/**/*") || files.includes("assets/**")) {
    errors.push('package.json build.files must not include broad "assets/**/*"; package only runtime asset folders.');
  }

  for (const forbidden of ["assets/stickers/**/*", "assets/generated-logo/**/*"]) {
    if (files.includes(forbidden)) {
      errors.push(`package.json build.files includes non-runtime assets: ${forbidden}`);
    }
  }

  for (const required of ["assets/fonts/**/*", "assets/characters/**/*"]) {
    if (!files.includes(required)) {
      errors.push(`package.json build.files is missing required runtime assets: ${required}`);
    }
  }

}

function checkFonts() {
  const fontFiles = listFiles(FONTS_DIR).filter((filePath) => /\.(otf|ttf|woff2?)$/iu.test(filePath));
  if (fontFiles.length === 0) {
    errors.push("assets/fonts does not contain any font file.");
    return;
  }

  if (!fs.existsSync(path.join(ROOT, MANAGER_FONT))) {
    errors.push(`${MANAGER_FONT} is missing. Run "npm run subset-font" before packaging.`);
  }

  for (const fontFile of fontFiles) {
    const rel = relative(fontFile);
    const size = fs.statSync(fontFile).size;
    if (size > FONT_FAIL_BYTES) {
      errors.push(`${rel} is ${formatBytes(size)}; keep packaged fonts under ${formatBytes(FONT_FAIL_BYTES)}.`);
    } else if (size > FONT_WARN_BYTES) {
      warnings.push(`${rel} is ${formatBytes(size)}. Consider subsetting CJK fonts before release.`);
    }
  }
}

function checkUnusedAssetDirs() {
  for (const assetDir of listDirs(ASSETS_DIR)) {
    const name = path.basename(assetDir);
    if (!PACKAGED_ASSET_DIRS.has(name)) {
      warnings.push(`${relative(assetDir)} is not a runtime asset folder and is intentionally excluded from package.json.`);
    }
  }
}

function checkTemporaryPackagedFiles() {
  for (const filePath of [...listFiles(FONTS_DIR), ...listFiles(CHARACTERS_DIR)]) {
    const fileName = path.basename(filePath);
    if (TEMP_FILE_NAMES.has(fileName)) {
      warnings.push(`${relative(filePath)} is a temporary/helper file. It should stay excluded from packaged files.`);
    }
  }
}

function checkBuiltInCharacters() {
  const characterDirs = listDirs(CHARACTERS_DIR).filter((dir) => !path.basename(dir).startsWith("."));
  if (characterDirs.length === 0) {
    errors.push("assets/characters does not contain any built-in pet.");
    return;
  }

  for (const characterDir of characterDirs) {
    const name = path.basename(characterDir);
    const manifestPath = path.join(characterDir, "manifest.json");
    const iconPath = path.join(characterDir, "icon.png");
    if (!fs.existsSync(manifestPath)) {
      errors.push(`Built-in pet "${name}" is missing manifest.json.`);
    } else {
      const manifest = readJson(manifestPath);
      if (manifest) {
        if (!manifest.id || manifest.id !== name) {
          warnings.push(`${relative(manifestPath)} id does not match folder name "${name}".`);
        }
        if (!manifest.name) {
          errors.push(`${relative(manifestPath)} is missing name.`);
        }
      }
    }

    if (!fs.existsSync(iconPath)) {
      errors.push(`Built-in pet "${name}" is missing icon.png.`);
    }

    const framesDir = path.join(characterDir, "frames");
    const idleFrames = listFiles(path.join(framesDir, "idle")).filter((filePath) => filePath.endsWith(".png"));
    if (idleFrames.length === 0) {
      errors.push(`Built-in pet "${name}" is missing frames/idle PNG frames.`);
    }

    for (const state of EXPECTED_STATES) {
      const stateDir = path.join(framesDir, state);
      const frames = listFiles(stateDir).filter((filePath) => filePath.endsWith(".png"));
      if (state === "idle" && frames.length === 0) continue;
      if (state !== "idle" && frames.length === 0) {
        warnings.push(`Built-in pet "${name}" has no ${state} frames and will use Relax fallback.`);
      }
    }
  }
}

function main() {
  checkBuildFileGlobs();
  checkFonts();
  checkUnusedAssetDirs();
  checkTemporaryPackagedFiles();
  checkBuiltInCharacters();

  for (const warning of warnings) {
    console.warn(`[asset-check] warning: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[asset-check] error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[asset-check] OK: checked fonts and ${listDirs(CHARACTERS_DIR).length} built-in pets.`);
}

main();
