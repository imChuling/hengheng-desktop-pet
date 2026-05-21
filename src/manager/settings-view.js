(function attachSettingsView(globalScope) {
  function createSettingsView({ desktopPet, elements, getText, onSettingsLoaded, renderLanguage, setMessage }) {
    function applyTheme(theme) {
      const html = document.documentElement;
      if (theme === "light" || theme === "dark") {
        html.dataset.theme = theme;
      } else {
        delete html.dataset.theme;
      }
    }

    function renderSettings(settings) {
      if (!settings) return;
      elements.settingsLanguageInput.value = settings.language ?? "en";
      elements.settingsThemeInput.value = settings.theme ?? "system";
      elements.settingsSizeInput.value = settings.sizeMode ?? "default";
      elements.settingsAlwaysOnTopInput.checked = Boolean(settings.alwaysOnTop);
      elements.settingsPausePetInput.checked = Boolean(settings.petPaused);
      elements.settingsAutoMotionInput.checked = Boolean(settings.autonomousWalkEnabled);
      elements.settingsLaunchAtLoginInput.checked = Boolean(settings.launchAtLogin);
      applyTheme(settings.theme ?? "system");
      renderLanguage(settings.language ?? "en");
    }

    async function loadSettings() {
      try {
        const settings = await desktopPet.getSettings();
        onSettingsLoaded(settings);
        renderSettings(settings);
      } catch (error) {
        setMessage(error.message || getText().settingsLoadFailed, "error");
      }
    }

    async function updateSettings(patch) {
      try {
        const settings = await desktopPet.updateSettings(patch);
        onSettingsLoaded(settings);
        renderSettings(settings);
        setMessage(getText().settingsUpdated, "success");
      } catch (error) {
        setMessage(error.message || getText().settingsUpdateFailed, "error");
        await loadSettings();
      }
    }

    async function resetPosition() {
      try {
        const settings = await desktopPet.resetPosition();
        onSettingsLoaded(settings);
        renderSettings(settings);
        setMessage(getText().resetDone, "success");
      } catch (error) {
        setMessage(error.message || getText().resetFailed, "error");
      }
    }

    return {
      loadSettings,
      renderSettings,
      resetPosition,
      updateSettings
    };
  }

  const api = { createSettingsView };
  globalScope.ManagerSettingsView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
