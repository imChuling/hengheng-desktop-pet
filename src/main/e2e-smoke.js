const { ipcMain } = require("electron");

function waitForReadyToShow(browserWindow, label = "window") {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return Promise.reject(new Error(`${label} is not available.`));
  }

  if (!browserWindow.webContents.isLoading()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${label} load.`));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timeout);
      browserWindow.webContents.removeListener("did-finish-load", onLoad);
      browserWindow.webContents.removeListener("did-fail-load", onFail);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onFail = (_event, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`Window load failed (${errorCode}): ${errorDescription}`));
    };

    browserWindow.webContents.once("did-finish-load", onLoad);
    browserWindow.webContents.once("did-fail-load", onFail);
  });
}

function waitForWindow(readWindow, label = "window") {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      const browserWindow = readWindow();
      if (browserWindow && !browserWindow.isDestroyed()) {
        resolve(browserWindow);
        return;
      }
      if (Date.now() - startedAt > 8000) {
        reject(new Error(`Timed out waiting for ${label} to become available.`));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}

function runPreloadSmoke(managerWindow, phase) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for preload e2e ${phase} result.`));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timeout);
      ipcMain.removeListener("e2e:smoke-result", onResult);
    };
    const onResult = (_event, json) => {
      cleanup();
      try {
        resolve(JSON.parse(json));
      } catch (error) {
        reject(error);
      }
    };

    ipcMain.once("e2e:smoke-result", onResult);
    managerWindow.webContents.send("e2e:run-smoke", phase);
  });
}

function writeResult(result) {
  process.stdout.write(`DESKTOP_PET_E2E_RESULT ${JSON.stringify(result)}\n`);
}

async function runWriteSmoke({ app, windowService, openManagerWindow }) {
  await waitForReadyToShow(await waitForWindow(() => windowService.getPetWindow(), "pet window"), "pet window");
  const managerWindow = openManagerWindow();
  await waitForReadyToShow(managerWindow, "manager window");
  const result = await runPreloadSmoke(managerWindow, "write");
  if (result.e2eError) {
    throw new Error(`${result.step}: ${result.e2eError}`);
  }

  if (result.settings.sizeMode !== "small" || result.settings.petPaused !== true) {
    throw new Error("Settings update did not round-trip through IPC.");
  }
  if (result.afterPosition.x === result.beforePosition.x && result.afterPosition.y === result.beforePosition.y) {
    throw new Error("Window position did not change through IPC.");
  }

  writeResult({ phase: "write", ok: true, ...result });
  app.quit();
}

async function runVerifySmoke({ app, windowService, openManagerWindow }) {
  await waitForReadyToShow(await waitForWindow(() => windowService.getPetWindow(), "pet window"), "pet window");
  const managerWindow = openManagerWindow();
  await waitForReadyToShow(managerWindow, "manager window");
  const result = await runPreloadSmoke(managerWindow, "verify");
  if (result.e2eError) {
    throw new Error(`${result.step}: ${result.e2eError}`);
  }

  if (result.settings.sizeMode !== "small") {
    throw new Error(`Expected persisted sizeMode "small", got "${result.settings.sizeMode}".`);
  }
  if (result.settings.petPaused !== true) {
    throw new Error("Expected persisted petPaused true.");
  }
  if (result.settings.hasCompletedOnboarding !== true) {
    throw new Error("Expected persisted onboarding completion.");
  }

  writeResult({ phase: "verify", ok: true, ...result });
  app.quit();
}

function runE2ESmoke(options) {
  const phase = process.env.DESKTOP_PET_E2E_PHASE;
  const task = phase === "verify" ? runVerifySmoke : runWriteSmoke;

  setImmediate(() => {
    task(options).catch((error) => {
      writeResult({
        phase: phase || "write",
        ok: false,
        error: error.message
      });
      options.app.exit(1);
    });
  });
}

module.exports = {
  runE2ESmoke
};
