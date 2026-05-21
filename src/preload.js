const { contextBridge, ipcRenderer } = require("electron");

const desktopPetApi = {
  chooseCodexSpritesheet: () => ipcRenderer.invoke("pet:choose-codex-spritesheet"),
  getAppInfo: () => ipcRenderer.invoke("pet:get-app-info"),
  getConfig: () => ipcRenderer.invoke("pet:get-config"),
  getSettings: () => ipcRenderer.invoke("pet:get-settings"),
  updateSettings: (patch) => ipcRenderer.invoke("pet:update-settings", patch),
  resetPosition: () => ipcRenderer.invoke("pet:reset-position"),
  listCharacterDetails: () => ipcRenderer.invoke("pet:list-character-details"),
  getCharacterDetail: (characterId) => ipcRenderer.invoke("pet:get-character-detail", characterId),
  selectCharacter: (characterId) => ipcRenderer.invoke("pet:select-character", characterId),
  deleteCharacter: (characterId) => ipcRenderer.invoke("pet:delete-character", characterId),
  renameCharacter: (options) => ipcRenderer.invoke("pet:rename-character", options),
  saveImportedCodexPet: (options) => ipcRenderer.invoke("pet:save-imported-codex-pet", options),
  openFeedback: () => ipcRenderer.invoke("pet:open-feedback"),
  openMenu: () => ipcRenderer.send("pet:open-menu"),
  setMousePassThrough: (enabled) => ipcRenderer.send("pet:set-mouse-pass-through", enabled),
  setWindowPosition: (position) => ipcRenderer.invoke("pet:set-window-position", position),
  getWindowEnvironment: () => ipcRenderer.invoke("pet:get-window-environment"),
  getWindowPosition: () => ipcRenderer.invoke("pet:get-window-position"),
  onReloadConfig: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("pet:reload-config", listener);
    return () => ipcRenderer.removeListener("pet:reload-config", listener);
  },
  onReloadManager: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("manager:reload", listener);
    return () => ipcRenderer.removeListener("manager:reload", listener);
  },
  onSettingsUpdated: (handler) => {
    const listener = (_event, settings) => handler(settings);
    ipcRenderer.on("manager:settings-updated", listener);
    return () => ipcRenderer.removeListener("manager:settings-updated", listener);
  },
  onSetAutonomousWalkEnabled: (handler) => {
    const listener = (_event, enabled) => handler(enabled);
    ipcRenderer.on("pet:set-autonomous-walk-enabled", listener);
    return () => ipcRenderer.removeListener("pet:set-autonomous-walk-enabled", listener);
  },
  onSetPaused: (handler) => {
    const listener = (_event, paused) => handler(paused);
    ipcRenderer.on("pet:set-paused", listener);
    return () => ipcRenderer.removeListener("pet:set-paused", listener);
  },
  onSetBehaviorMode: (handler) => {
    const listener = (_event, mode) => handler(mode);
    ipcRenderer.on("pet:set-behavior-mode", listener);
    return () => ipcRenderer.removeListener("pet:set-behavior-mode", listener);
  },
  onSetCharacter: (handler) => {
    const listener = (_event, characterId) => handler(characterId);
    ipcRenderer.on("pet:set-character", listener);
    return () => ipcRenderer.removeListener("pet:set-character", listener);
  },
  onSetSizeMode: (handler) => {
    const listener = (_event, mode) => handler(mode);
    ipcRenderer.on("pet:set-size-mode", listener);
    return () => ipcRenderer.removeListener("pet:set-size-mode", listener);
  }
};

if (process.env.DESKTOP_PET_E2E === "1") {
  async function runE2ESmoke(phase) {
    if (phase === "verify") {
      const settings = await ipcRenderer.invoke("pet:get-settings");
      const list = await ipcRenderer.invoke("pet:list-character-details");
      const position = await ipcRenderer.invoke("pet:get-window-position");
      return JSON.stringify({
        activeCharacterId: list.selectedCharacterId,
        characterCount: list.characters.length,
        position,
        settings,
        title: document.title
      });
    }

    const list = await ipcRenderer.invoke("pet:list-character-details");
    if (!Array.isArray(list.characters) || list.characters.length === 0) {
      throw new Error("No characters available in manager.");
    }
    const target = list.characters.find((character) => character.valid) || list.characters[0];
    await ipcRenderer.invoke("pet:select-character", target.id);
    const beforePosition = await ipcRenderer.invoke("pet:get-window-position");
    await ipcRenderer.invoke("pet:set-window-position", {
      x: beforePosition.x + 16,
      y: beforePosition.y + 12,
      persist: true
    });
    const afterPosition = await ipcRenderer.invoke("pet:get-window-position");
    const settings = await ipcRenderer.invoke("pet:update-settings", {
      hasCompletedOnboarding: true,
      petPaused: true,
      sizeMode: "small"
    });
    const appInfo = await ipcRenderer.invoke("pet:get-app-info");
    return JSON.stringify({
      appInfo,
      characterCount: list.characters.length,
      selectedCharacterId: target.id,
      settings,
      beforePosition,
      afterPosition,
      title: document.title
    });
  }

  desktopPetApi.runE2ESmoke = runE2ESmoke;
  ipcRenderer.on("e2e:run-smoke", async (_event, phase) => {
    try {
      ipcRenderer.send("e2e:smoke-result", await runE2ESmoke(phase));
    } catch (error) {
      ipcRenderer.send(
        "e2e:smoke-result",
        JSON.stringify({
          e2eError: error.message,
          step: `preloadSmoke:${phase}`
        })
      );
    }
  });
}

contextBridge.exposeInMainWorld("desktopPet", desktopPetApi);
