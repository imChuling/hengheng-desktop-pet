const path = require("node:path");
const fs = require("node:fs");
const { Menu, Tray, dialog, ipcMain, nativeImage, shell } = require("electron");
const { BEHAVIOR_MENU_STATES } = require("./character-store");
const { sanitizeCharacterId } = require("./codex-pet-importer");
const { buildTrayMenuTemplate } = require("./tray-menu");
const { createAppError } = require("../shared/app-error");
const { formatText } = require("../shared/format-text");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const APP_ICON_PATH = path.join(PROJECT_ROOT, "build", "icon.png");
const TRAY_ICON_PATH = path.join(PROJECT_ROOT, "build", "tray-icon.png");
const TRAY_ICON_SIZE = 18;
const FEEDBACK_URL = "https://github.com/imChuling/hengheng-desktop-pet/issues";
const MAX_CODEX_SPRITESHEET_BYTES = 32 * 1024 * 1024;
const VALID_SIZE_MODES = new Set(["large", "default", "small"]);

const MAIN_TEXT = {
  en: {
    deleteButton: "Delete",
    cancelButton: "Cancel",
    deleteTitle: "Delete Imported Pet",
    deleteMessage: 'Delete "{name}"?',
    deleteDetail: "This only removes the pet from this app. Built-in pets cannot be deleted.",
    chooseSpritesheetTitle: "Choose pet spritesheet",
    spritesheetFilter: "Pet Spritesheet",
    managerTitle: "Pet Manager"
  },
  "zh-CN": {
    deleteButton: "删除",
    cancelButton: "取消",
    deleteTitle: "删除导入的宠物",
    deleteMessage: "删除“{name}”吗？",
    deleteDetail: "这只会从本应用中移除该宠物。内置宠物不会被删除。",
    chooseSpritesheetTitle: "选择宠物 spritesheet",
    spritesheetFilter: "宠物 Spritesheet",
    managerTitle: "桌面宠物管理"
  }
};

function createAppController({ app, characterService, settingsStore, windowService }) {
  let tray = null;
  let selectedCharacterId = "lcl2";
  let behaviorMode = { type: "auto" };
  let sizeMode = "default";
  let autonomousWalkEnabled = true;
  let launchAtLogin = false;
  let language = "en";
  let petPaused = false;

  function sendToRenderer(channel, payload) {
    windowService.getPetWindow()?.webContents.send(channel, payload);
  }

  function sendToManager(channel, payload) {
    windowService.getManagerWindow()?.webContents.send(channel, payload);
  }

  function textForMain() {
    return MAIN_TEXT[language] ?? MAIN_TEXT.en;
  }

  function getRuntimeSettings() {
    return {
      sizeMode,
      alwaysOnTop: windowService.getPetWindow()?.isAlwaysOnTop() ?? settingsStore.get().alwaysOnTop,
      autonomousWalkEnabled,
      launchAtLogin,
      theme: settingsStore.get().theme,
      language,
      petPaused,
      hasCompletedOnboarding: settingsStore.get().hasCompletedOnboarding
    };
  }

  function notifyManagerSettingsUpdated() {
    sendToManager("manager:settings-updated", getRuntimeSettings());
  }

  function resolveTrayIconPath() {
    if (fs.existsSync(TRAY_ICON_PATH)) return TRAY_ICON_PATH;
    if (fs.existsSync(APP_ICON_PATH)) return APP_ICON_PATH;
    return characterService.resolveCharacterIconPath(selectedCharacterId);
  }

  function loadTrayImage() {
    const iconPath = resolveTrayIconPath();
    if (!fs.existsSync(iconPath)) return nativeImage.createEmpty();
    const image = nativeImage.createFromPath(iconPath);
    return iconPath === TRAY_ICON_PATH ? image : image.resize({ height: TRAY_ICON_SIZE });
  }

  function refreshTrayIcon() {
    if (!tray) return;
    tray.setImage(loadTrayImage());
  }

  function refreshTrayMenu() {
    if (!tray) return;
    tray.setContextMenu(buildMenu());
  }

  function handleCharacterSelect(characterId) {
    selectedCharacterId = characterId;
    settingsStore.update({ selectedCharacterId });
    refreshTrayIcon();
    refreshTrayMenu();
    sendToRenderer("pet:set-character", selectedCharacterId);
    sendToManager("manager:reload");
  }

  function openManagerWindow() {
    const managerWindow = windowService.openManagerWindow();
    managerWindow.setTitle(textForMain().managerTitle);
    return managerWindow;
  }

  function handleImportedCharacter(characterId) {
    selectedCharacterId = characterId;
    settingsStore.update({ selectedCharacterId });
    refreshTrayIcon();
    refreshTrayMenu();
    sendToRenderer("pet:reload-config");
    sendToRenderer("pet:set-character", selectedCharacterId);
    sendToManager("manager:reload");
  }

  async function handleDeleteCharacter(characterId) {
    const character = characterService.listCharacters().find((candidate) => candidate.id === characterId);
    if (!character || character.source !== "user") return;
    const text = textForMain();

    const result = await dialog.showMessageBox(windowService.getManagerWindow() ?? windowService.getPetWindow(), {
      type: "warning",
      buttons: [text.deleteButton, text.cancelButton],
      defaultId: 1,
      cancelId: 1,
      title: text.deleteTitle,
      message: formatText(text.deleteMessage, { name: character.name }),
      detail: text.deleteDetail
    });

    if (result.response !== 0) return;

    characterService.deleteImportedPet(characterId);
    const config = characterService.loadConfig({ selectedCharacterId, behaviorMode, sizeMode });
    selectedCharacterId = config.selectedCharacterId;
    settingsStore.update({ selectedCharacterId });
    refreshTrayIcon();
    refreshTrayMenu();
    sendToRenderer("pet:reload-config");
    sendToRenderer("pet:set-character", selectedCharacterId);
    sendToManager("manager:reload");
  }

  function handleRenameCharacter(characterId, nextName) {
    const renamedCharacter = characterService.renameImportedPet(characterId, nextName);
    refreshTrayMenu();
    sendToManager("manager:reload");
    return renamedCharacter;
  }

  function handleSetAutoBehavior() {
    behaviorMode = { type: "auto" };
    settingsStore.update({ behaviorMode });
    refreshTrayMenu();
    sendToRenderer("pet:set-behavior-mode", behaviorMode);
  }

  function handleLockBehavior(state) {
    behaviorMode = { type: "locked", state };
    settingsStore.update({ behaviorMode });
    refreshTrayMenu();
    sendToRenderer("pet:set-behavior-mode", behaviorMode);
  }

  function handleSetSizeMode(nextSizeMode) {
    if (!VALID_SIZE_MODES.has(nextSizeMode)) {
      throw createAppError("INVALID_SIZE_SETTING");
    }
    sizeMode = nextSizeMode;
    windowService.applyPetWindowSize(sizeMode);
    settingsStore.update({ sizeMode, windowPosition: windowService.getPetWindowPosition() });
    refreshTrayMenu();
    notifyManagerSettingsUpdated();
    sendToRenderer("pet:set-size-mode", sizeMode);
  }

  function handleResetPosition() {
    windowService.resetPetWindowPosition(sizeMode);
    settingsStore.update({ windowPosition: windowService.getPetWindowPosition() });
    notifyManagerSettingsUpdated();
  }

  function handleSetAlwaysOnTop(next) {
    const petWindow = windowService.getPetWindow();
    if (!petWindow) return;
    petWindow.setAlwaysOnTop(next);
    settingsStore.update({ alwaysOnTop: next });
    refreshTrayMenu();
    notifyManagerSettingsUpdated();
  }

  function handleToggleAlwaysOnTop() {
    const petWindow = windowService.getPetWindow();
    if (!petWindow) return;
    handleSetAlwaysOnTop(!petWindow.isAlwaysOnTop());
  }

  function handleSetPetPaused(next) {
    petPaused = next;
    settingsStore.update({ petPaused });
    refreshTrayMenu();
    notifyManagerSettingsUpdated();
    sendToRenderer("pet:set-paused", petPaused);
  }

  function handleTogglePetPaused() {
    handleSetPetPaused(!petPaused);
  }

  function handleTogglePetVisibility() {
    const petWindow = windowService.getPetWindow();
    if (!petWindow) return;
    windowService.setPetWindowVisible(!windowService.isPetWindowVisible());
    refreshTrayMenu();
  }

  function handleSetAutonomousWalkEnabled(next) {
    autonomousWalkEnabled = next;
    settingsStore.update({ autonomousWalkEnabled });
    refreshTrayMenu();
    notifyManagerSettingsUpdated();
    sendToRenderer("pet:set-autonomous-walk-enabled", autonomousWalkEnabled);
  }

  function handleToggleAutonomousWalk() {
    handleSetAutonomousWalkEnabled(!autonomousWalkEnabled);
  }

  function readLaunchAtLogin() {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  }

  function handleSetLaunchAtLogin(next) {
    app.setLoginItemSettings({ openAtLogin: next });
    launchAtLogin = readLaunchAtLogin();
    settingsStore.update({ launchAtLogin });
    refreshTrayMenu();
    notifyManagerSettingsUpdated();
  }

  function handleToggleLaunchAtLogin() {
    handleSetLaunchAtLogin(!launchAtLogin);
  }

  function normalizeBehaviorModeForApp(mode) {
    if (mode?.type === "locked" && BEHAVIOR_MENU_STATES.includes(mode.state)) {
      return { type: "locked", state: mode.state };
    }
    return { type: "auto" };
  }

  function normalizeSizeModeForApp(mode) {
    return VALID_SIZE_MODES.has(mode) ? mode : "default";
  }

  function requirePlainObject(value, code) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw createAppError(code);
    }
    return value;
  }

  function hasOwn(object, property) {
    return Object.prototype.hasOwnProperty.call(object, property);
  }

  function applySettingsPatch(patchInput) {
    const patch = requirePlainObject(patchInput, "INVALID_SETTINGS_REQUEST");

    if (hasOwn(patch, "sizeMode")) {
      handleSetSizeMode(normalizeSizeModeForApp(patch.sizeMode));
    }
    if (hasOwn(patch, "alwaysOnTop")) {
      handleSetAlwaysOnTop(Boolean(patch.alwaysOnTop));
    }
    if (hasOwn(patch, "autonomousWalkEnabled")) {
      handleSetAutonomousWalkEnabled(Boolean(patch.autonomousWalkEnabled));
    }
    if (hasOwn(patch, "launchAtLogin")) {
      handleSetLaunchAtLogin(Boolean(patch.launchAtLogin));
    }
    if (hasOwn(patch, "theme")) {
      const theme = ["system", "light", "dark"].includes(patch.theme) ? patch.theme : "system";
      settingsStore.update({ theme });
      notifyManagerSettingsUpdated();
    }
    if (hasOwn(patch, "language")) {
      language = patch.language === "zh-CN" ? "zh-CN" : "en";
      settingsStore.update({ language });
      refreshTrayMenu();
      notifyManagerSettingsUpdated();
    }
    if (hasOwn(patch, "petPaused")) {
      handleSetPetPaused(Boolean(patch.petPaused));
    }
    if (hasOwn(patch, "hasCompletedOnboarding")) {
      settingsStore.update({ hasCompletedOnboarding: Boolean(patch.hasCompletedOnboarding) });
      notifyManagerSettingsUpdated();
    }

    return getRuntimeSettings();
  }

  function normalizeWindowPositionInput(value) {
    const position = requirePlainObject(value, "INVALID_WINDOW_POSITION");
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw createAppError("INVALID_WINDOW_POSITION");
    }
    return { x: position.x, y: position.y, persist: position.persist !== false };
  }

  function isTrustedIpcEvent(event) {
    return windowService.isTrustedSender({ webContents: event.sender, frameUrl: event.senderFrame?.url });
  }

  function assertTrustedIpcSender(event) {
    if (!isTrustedIpcEvent(event)) {
      throw createAppError("UNTRUSTED_IPC_SENDER");
    }
  }

  function trustedIpcHandler(handler) {
    return (event, ...args) => {
      assertTrustedIpcSender(event);
      return handler(event, ...args);
    };
  }

  function trustedIpcListener(listener) {
    return (event, ...args) => {
      if (!isTrustedIpcEvent(event)) {
        console.warn("[desktop-pet] Ignored IPC event from untrusted sender.");
        return undefined;
      }
      return listener(event, ...args);
    };
  }

  function buildMenu() {
    return Menu.buildFromTemplate(
      buildTrayMenuTemplate({
        behaviorMode,
        behaviorMenuStates: BEHAVIOR_MENU_STATES,
        autonomousWalkEnabled,
        mainWindow: windowService.getPetWindow(),
        onCharacterSelect: handleCharacterSelect,
        onManageCharacters: openManagerWindow,
        onLockBehavior: handleLockBehavior,
        onResetPosition: handleResetPosition,
        onSetAutoBehavior: handleSetAutoBehavior,
        onSetSizeMode: handleSetSizeMode,
        onToggleLaunchAtLogin: handleToggleLaunchAtLogin,
        onTogglePetPaused: handleTogglePetPaused,
        onTogglePetVisibility: handleTogglePetVisibility,
        onToggleAutonomousWalk: handleToggleAutonomousWalk,
        onToggleAlwaysOnTop: handleToggleAlwaysOnTop,
        onQuit: () => app.quit(),
        readCharacters: () => characterService.listCharacters(),
        language,
        launchAtLogin,
        petPaused,
        selectedCharacterId,
        sizeMode
      })
    );
  }

  function createTray() {
    tray = new Tray(loadTrayImage());
    tray.setToolTip("哼哼");
    tray.setContextMenu(buildMenu());
  }

  function registerIpcHandlers() {
    ipcMain.handle("pet:get-settings", trustedIpcHandler(() => getRuntimeSettings()));
    ipcMain.handle("pet:get-app-info", trustedIpcHandler(() => ({
      name: app.getName(),
      version: app.getVersion(),
      productName: "哼哼",
      feedbackUrl: FEEDBACK_URL
    })));
    ipcMain.handle("pet:update-settings", trustedIpcHandler((_event, patch) => applySettingsPatch(patch)));
    ipcMain.handle("pet:reset-position", trustedIpcHandler(() => {
      handleResetPosition();
      return getRuntimeSettings();
    }));
    ipcMain.handle("pet:get-config", trustedIpcHandler(() => {
      const config = characterService.loadConfig({ selectedCharacterId, behaviorMode, sizeMode });
      selectedCharacterId = config.selectedCharacterId;
      settingsStore.update({ selectedCharacterId });
      config.autonomousWalkEnabled = autonomousWalkEnabled;
      config.petPaused = petPaused;
      config.language = language;
      return config;
    }));
    ipcMain.handle("pet:list-character-details", trustedIpcHandler(() => ({
      selectedCharacterId,
      characters: characterService.listCharacterDetails()
    })));
    ipcMain.handle(
      "pet:get-character-detail",
      trustedIpcHandler((_event, characterId) => characterService.getCharacterDetail(characterId))
    );
    ipcMain.handle("pet:select-character", trustedIpcHandler((_event, characterId) => {
      handleCharacterSelect(characterId);
      return { selectedCharacterId };
    }));
    ipcMain.handle("pet:delete-character", trustedIpcHandler(async (_event, characterId) => {
      await handleDeleteCharacter(characterId);
      return { selectedCharacterId, characters: characterService.listCharacterDetails() };
    }));
    ipcMain.handle("pet:rename-character", trustedIpcHandler((_event, options) => {
      const { characterId, name } = requirePlainObject(options, "INVALID_RENAME_REQUEST");
      const renamedCharacter = handleRenameCharacter(characterId, name);
      return { renamedCharacter, characters: characterService.listCharacterDetails() };
    }));
    ipcMain.on("pet:open-menu", trustedIpcListener(() => {
      const menu = buildMenu();
      menu.popup({ window: windowService.getPetWindow() });
    }));
    ipcMain.on("pet:set-mouse-pass-through", trustedIpcListener((_event, enabled) => {
      windowService.setPetWindowMousePassThrough(Boolean(enabled));
    }));
    ipcMain.handle("pet:open-feedback", trustedIpcHandler(async () => {
      await shell.openExternal(FEEDBACK_URL);
      return { opened: true };
    }));
    ipcMain.handle("pet:set-window-position", trustedIpcHandler((_event, positionInput) => {
      const { x, y, persist } = normalizeWindowPositionInput(positionInput);
      windowService.setPetWindowPosition({ x, y });
      if (persist) {
        settingsStore.update(
          { windowPosition: windowService.getPetWindowPosition() },
          { debounce: true }
        );
      }
    }));
    ipcMain.handle("pet:get-window-position", trustedIpcHandler(() => windowService.getPetWindowPosition()));
    ipcMain.handle("pet:get-window-environment", trustedIpcHandler(() => windowService.getPetWindowEnvironment()));
    ipcMain.handle("pet:choose-codex-spritesheet", trustedIpcHandler(async () => {
      const text = textForMain();
      const result = await dialog.showOpenDialog(
        windowService.getManagerWindow() ?? windowService.getPetWindow(),
        {
          title: text.chooseSpritesheetTitle,
          properties: ["openFile"],
          filters: [{ name: text.spritesheetFilter, extensions: ["webp"] }]
        }
      );

      if (result.canceled || result.filePaths.length === 0) return null;

      const filePath = result.filePaths[0];
      const fileSize = fs.statSync(filePath).size;
      if (fileSize > MAX_CODEX_SPRITESHEET_BYTES) {
        throw createAppError("SPRITESHEET_FILE_TOO_LARGE", { maxMb: 32 });
      }
      return {
        path: filePath,
        dataUrl: `data:image/webp;base64,${fs.readFileSync(filePath).toString("base64")}`,
        suggestedName: sanitizeCharacterId(path.basename(filePath, path.extname(filePath))) || "new-pet"
      };
    }));
    ipcMain.handle("pet:save-imported-codex-pet", trustedIpcHandler((_event, options) => {
      const { characterName, framesByState, iconDataUrl, overwrite } = requirePlainObject(
        options,
        "INVALID_IMPORT_REQUEST"
      );
      const importedCharacter = characterService.importPet({ characterName, framesByState, iconDataUrl, overwrite });
      handleImportedCharacter(importedCharacter.id);
      return importedCharacter;
    }));
  }

  function loadSavedState() {
    const saved = settingsStore.load();
    selectedCharacterId = saved.selectedCharacterId;
    behaviorMode = normalizeBehaviorModeForApp(saved.behaviorMode);
    sizeMode = normalizeSizeModeForApp(saved.sizeMode);
    autonomousWalkEnabled = saved.autonomousWalkEnabled;
    launchAtLogin = readLaunchAtLogin();
    if (launchAtLogin !== saved.launchAtLogin) {
      settingsStore.update({ launchAtLogin });
    }
    language = saved.language;
    petPaused = saved.petPaused;
    return { sizeMode, alwaysOnTop: saved.alwaysOnTop, windowPosition: saved.windowPosition };
  }

  function saveState() {
    settingsStore.update({
      alwaysOnTop: windowService.getPetWindow()?.isAlwaysOnTop() ?? settingsStore.get().alwaysOnTop,
      selectedCharacterId,
      behaviorMode,
      autonomousWalkEnabled,
      launchAtLogin,
      language,
      petPaused,
      sizeMode,
      windowPosition: windowService.getPetWindowPosition()
    });
    settingsStore.flush();
  }

  function recreatePetWindow() {
    const settings = settingsStore.get();
    windowService.createPetWindow({
      alwaysOnTop: settings.alwaysOnTop,
      position: settings.windowPosition,
      sizeMode
    });
  }

  return {
    createTray,
    loadSavedState,
    openManagerWindow,
    recreatePetWindow,
    registerIpcHandlers,
    saveState
  };
}

module.exports = { createAppController };
