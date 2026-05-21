const { app, session } = require("electron");
const path = require("node:path");
const { createCharacterService } = require("./main/character-service");
const { createSettingsStore } = require("./main/settings-store");
const { createWindowService } = require("./main/window-service");
const { configureSessionSecurity } = require("./main/security");
const { runE2ESmoke } = require("./main/e2e-smoke");
const { createAppController } = require("./main/app-controller");

const BUILT_IN_CHARACTERS_ROOT = path.join(__dirname, "..", "assets", "characters");

if (process.env.DESKTOP_PET_E2E_USER_DATA) {
  app.setPath("userData", process.env.DESKTOP_PET_E2E_USER_DATA);
}

const characterService = createCharacterService({ app, builtInCharactersRoot: BUILT_IN_CHARACTERS_ROOT });
const settingsStore = createSettingsStore({ app });
const windowService = createWindowService({ preloadPath: path.join(__dirname, "preload.js") });
const controller = createAppController({ app, characterService, settingsStore, windowService });

app.whenReady().then(() => {
  configureSessionSecurity(session.defaultSession);
  windowService.watchDisplayChanges();

  const { sizeMode, alwaysOnTop, windowPosition } = controller.loadSavedState();
  controller.registerIpcHandlers();

  windowService.createPetWindow({ alwaysOnTop, position: windowPosition, sizeMode });
  controller.createTray();

  if (process.env.DESKTOP_PET_E2E === "1") {
    runE2ESmoke({ app, windowService, openManagerWindow: controller.openManagerWindow });
  }

  app.on("activate", () => {
    if (!windowService.getPetWindow()) {
      controller.recreatePetWindow();
    }
  });
});

app.on("before-quit", () => {
  controller.saveState();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
