const path = require("node:path");
const { BrowserWindow, screen } = require("electron");

const { getWindowSizeForMode } = require("./character-store");
const {
  clampPositionToWorkArea,
  defaultPositionForWorkArea,
  isBoundsVisibleInWorkAreas
} = require("./window-position");
const { filePathToUrl, isAllowedAppUrl } = require("./security");

function createWindowService({ preloadPath }) {
  let petWindow = null;
  let managerWindow = null;
  let petWindowIgnoresMouse = false;
  const allowedUrlsByWebContents = new WeakMap();

  function hardenWindowNavigation(browserWindow, allowedUrls) {
    browserWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const eventName of ["will-navigate", "will-frame-navigate", "will-redirect"]) {
      browserWindow.webContents.on(eventName, (event, navigationUrl) => {
        if (!isAllowedAppUrl(navigationUrl, allowedUrls)) {
          event.preventDefault();
        }
      });
    }
  }

  function loadAllowedLocalFile(browserWindow, filePath) {
    const allowedUrls = new Set([filePathToUrl(filePath)]);
    allowedUrlsByWebContents.set(browserWindow.webContents, allowedUrls);
    hardenWindowNavigation(browserWindow, allowedUrls);
    browserWindow.loadFile(filePath);
  }

  function isPetWindowVisibleInAnyWorkArea(bounds) {
    return isBoundsVisibleInWorkAreas(
      bounds,
      screen.getAllDisplays().map((display) => display.workArea)
    );
  }

  function clampPetWindowPosition({ x, y }) {
    if (!petWindow) return { x: Math.round(x), y: Math.round(y) };

    const targetPoint = {
      x: Math.round(x),
      y: Math.round(y)
    };
    const bounds = petWindow.getBounds();
    const display = screen.getDisplayNearestPoint(targetPoint);
    return clampPositionToWorkArea(targetPoint, bounds, display.workArea);
  }

  function ensurePetWindowInWorkArea() {
    if (!petWindow) return;
    const bounds = petWindow.getBounds();
    if (isPetWindowVisibleInAnyWorkArea(bounds)) {
      const clampedPosition = clampPetWindowPosition({ x: bounds.x, y: bounds.y });
      if (clampedPosition.x !== bounds.x || clampedPosition.y !== bounds.y) {
        petWindow.setPosition(clampedPosition.x, clampedPosition.y);
      }
      return;
    }

    const fallbackPosition = clampPetWindowPosition(getDefaultPetWindowPositionFromBounds(bounds));
    petWindow.setPosition(fallbackPosition.x, fallbackPosition.y);
  }

  function createPetWindow({ alwaysOnTop = true, position = null, sizeMode }) {
    const { workArea } = screen.getPrimaryDisplay();
    const { width, height } = getWindowSizeForMode(sizeMode);
    const defaultPosition = defaultPositionForWorkArea({ width, height }, workArea);
    const hasSavedPosition =
      position && Number.isFinite(position.x) && Number.isFinite(position.y);
    petWindowIgnoresMouse = false;

    petWindow = new BrowserWindow({
      width,
      height,
      x: hasSavedPosition ? Math.round(position.x) : defaultPosition.x,
      y: hasSavedPosition ? Math.round(position.y) : defaultPosition.y,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: false,
      alwaysOnTop,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    loadAllowedLocalFile(petWindow, path.join(__dirname, "..", "renderer", "index.html"));
    ensurePetWindowInWorkArea();
    petWindow.on("closed", () => {
      petWindow = null;
      petWindowIgnoresMouse = false;
    });
    return petWindow;
  }

  function getFallbackDisplay() {
    if (managerWindow && !managerWindow.isDestroyed()) {
      return screen.getDisplayMatching(managerWindow.getBounds());
    }
    return screen.getPrimaryDisplay();
  }

  function getBestPetDisplay() {
    if (!petWindow) return getFallbackDisplay();
    const bounds = petWindow.getBounds();
    return isPetWindowVisibleInAnyWorkArea(bounds) ? screen.getDisplayMatching(bounds) : getFallbackDisplay();
  }

  function getDefaultPetWindowPositionFromBounds(bounds, display = screen.getPrimaryDisplay()) {
    return defaultPositionForWorkArea(bounds, display.workArea);
  }

  function getDefaultPetWindowPosition(sizeMode) {
    const { width, height } = getWindowSizeForMode(sizeMode);
    return getDefaultPetWindowPositionFromBounds({ width, height });
  }

  function openManagerWindow() {
    if (managerWindow) {
      managerWindow.focus();
      return managerWindow;
    }

    managerWindow = new BrowserWindow({
      width: 980,
      height: 660,
      minWidth: 980,
      minHeight: 660,
      title: "Pet Manager",
      resizable: false,
      maximizable: false,
      minimizable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });

    loadAllowedLocalFile(managerWindow, path.join(__dirname, "..", "manager", "index.html"));
    managerWindow.on("closed", () => {
      managerWindow = null;
    });
    return managerWindow;
  }

  function applyPetWindowSize(mode) {
    if (!petWindow) return;
    const currentBounds = petWindow.getBounds();
    const { width, height } = getWindowSizeForMode(mode);
    petWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width,
      height
    });
    ensurePetWindowInWorkArea();
  }

  function resetPetWindowPosition(sizeMode) {
    if (!petWindow) return;
    const bounds = petWindow.getBounds();
    const display = getBestPetDisplay();
    const position = clampPositionToWorkArea(getDefaultPetWindowPositionFromBounds(bounds, display), bounds, display.workArea);
    petWindow.setPosition(position.x, position.y);
  }

  function getPetWindowPosition() {
    if (!petWindow) return { x: 0, y: 0 };
    const [x, y] = petWindow.getPosition();
    return { x, y };
  }

  function getPetWindowEnvironment() {
    ensurePetWindowInWorkArea();
    if (!petWindow) {
      const { workArea } = screen.getPrimaryDisplay();
      return {
        bounds: { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height },
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 }
      };
    }

    const bounds = petWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    return {
      bounds: {
        x: display.workArea.x,
        y: display.workArea.y,
        width: display.workArea.width,
        height: display.workArea.height
      },
      position: { x: bounds.x, y: bounds.y },
      size: { width: bounds.width, height: bounds.height }
    };
  }

  function setPetWindowPosition({ x, y }) {
    if (!petWindow) return;
    const position = clampPetWindowPosition({ x, y });
    petWindow.setPosition(position.x, position.y);
  }

  function setPetWindowMousePassThrough(enabled) {
    if (!petWindow || petWindowIgnoresMouse === enabled) return;
    petWindowIgnoresMouse = enabled;
    petWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }

  function setPetWindowVisible(visible) {
    if (!petWindow) return;
    if (visible) {
      ensurePetWindowInWorkArea();
      petWindow.showInactive();
    } else {
      petWindow.hide();
    }
  }

  function isPetWindowVisible() {
    return petWindow?.isVisible() ?? false;
  }

  function getPetWindow() {
    return petWindow;
  }

  function getManagerWindow() {
    return managerWindow;
  }

  function isKnownWindowWebContents(webContents) {
    return Boolean(
      webContents &&
        ((petWindow && !petWindow.isDestroyed() && webContents === petWindow.webContents) ||
          (managerWindow && !managerWindow.isDestroyed() && webContents === managerWindow.webContents))
    );
  }

  function isTrustedSender({ webContents, frameUrl }) {
    if (!isKnownWindowWebContents(webContents)) {
      return false;
    }

    const allowedUrls = allowedUrlsByWebContents.get(webContents);
    if (!allowedUrls) {
      return false;
    }

    return isAllowedAppUrl(frameUrl, allowedUrls) || isAllowedAppUrl(webContents.getURL(), allowedUrls);
  }

  function watchDisplayChanges() {
    for (const eventName of ["display-added", "display-removed", "display-metrics-changed"]) {
      screen.removeListener(eventName, ensurePetWindowInWorkArea);
      screen.on(eventName, ensurePetWindowInWorkArea);
    }
  }

  return {
    applyPetWindowSize,
    createPetWindow,
    getManagerWindow,
    getPetWindow,
    getPetWindowEnvironment,
    getPetWindowPosition,
    ensurePetWindowInWorkArea,
    isTrustedSender,
    openManagerWindow,
    isPetWindowVisible,
    resetPetWindowPosition,
    setPetWindowMousePassThrough,
    setPetWindowPosition,
    setPetWindowVisible,
    watchDisplayChanges
  };
}

module.exports = {
  createWindowService
};
