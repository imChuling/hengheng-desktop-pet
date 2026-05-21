const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const ELECTRON_PATH = require("electron");
const RESULT_PREFIX = "DESKTOP_PET_E2E_RESULT ";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-e2e-"));
}

function runElectronPhase({ phase, userDataDir }) {
  return new Promise((resolve, reject) => {
    const child = spawn(ELECTRON_PATH, [PROJECT_ROOT], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        DESKTOP_PET_E2E: "1",
        DESKTOP_PET_E2E_PHASE: phase,
        DESKTOP_PET_E2E_USER_DATA: userDataDir,
        ELECTRON_ENABLE_LOGGING: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Electron e2e ${phase} phase timed out.\n${stderr}`));
    }, 20000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const resultLine = stdout
        .split(/\r?\n/u)
        .find((line) => line.startsWith(RESULT_PREFIX));
      if (!resultLine) {
        reject(
          new Error(
            `Electron e2e ${phase} phase produced no result. Exit ${code}, signal ${signal}.\nstdout:\n${stdout}\nstderr:\n${stderr}`
          )
        );
        return;
      }

      const result = JSON.parse(resultLine.slice(RESULT_PREFIX.length));
      if (code !== 0 || !result.ok) {
        reject(
          new Error(
            `Electron e2e ${phase} phase failed: ${result.error || `exit ${code}`}. Signal ${signal}.\nstdout:\n${stdout}\nstderr:\n${stderr}`
          )
        );
        return;
      }

      resolve(result);
    });
  });
}

test("Electron smoke flow opens manager, switches pet, persists settings after restart", async () => {
  const userDataDir = makeTempDir();
  const writeResult = await runElectronPhase({ phase: "write", userDataDir });
  const verifyResult = await runElectronPhase({ phase: "verify", userDataDir });

  assert.equal(writeResult.phase, "write");
  assert.equal(verifyResult.phase, "verify");
  assert.equal(writeResult.title, "Pet Manager");
  assert.equal(verifyResult.title, "Pet Manager");
  assert.ok(writeResult.characterCount > 0);
  assert.ok(verifyResult.characterCount > 0);
  assert.equal(verifyResult.settings.sizeMode, "small");
  assert.equal(verifyResult.settings.petPaused, true);
  assert.equal(verifyResult.settings.hasCompletedOnboarding, true);
  assert.equal(verifyResult.activeCharacterId, writeResult.selectedCharacterId);
});
