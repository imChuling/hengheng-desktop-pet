(function attachProductView(globalScope) {
  function createProductView({ desktopPet, elements, formatText, getText, setMessage }) {
    let appInfo = null;

    function renderAppInfo(nextAppInfo) {
      if (nextAppInfo) {
        appInfo = nextAppInfo;
      }

      const text = getText();
      if (elements.appMeta) {
        elements.appMeta.textContent = appInfo
          ? formatText(text.versionLine, { version: appInfo.version })
          : "";
      }
      if (elements.aboutReleaseDetail) {
        elements.aboutReleaseTitle.textContent = text.releaseInfo;
        elements.aboutReleaseDetail.textContent = appInfo
          ? formatText(text.releaseDetail, { version: appInfo.version })
          : text.releaseDetailLoading;
      }
    }

    async function loadAppInfo() {
      try {
        renderAppInfo(await desktopPet.getAppInfo());
      } catch (_error) {
        renderAppInfo(null);
      }
    }

    function applyLanguage() {
      const text = getText();
      if (elements.feedbackButton) elements.feedbackButton.textContent = text.feedback;
      if (elements.onboardingTitle) elements.onboardingTitle.textContent = text.startHere;
      if (elements.onboardingDetail) elements.onboardingDetail.textContent = text.startHereDetail;
      for (const [step, label] of Object.entries(text.onboardingSteps)) {
        const element = elements.onboardingCard?.querySelector(`[data-onboarding-step="${step}"]`);
        if (element) element.textContent = label;
      }
      if (elements.onboardingImportButton) elements.onboardingImportButton.textContent = text.importPet;
      if (elements.onboardingSettingsButton) elements.onboardingSettingsButton.textContent = text.settings;
      if (elements.importRecoveryTitle) elements.importRecoveryTitle.textContent = text.importRecoveryTitle;
      if (elements.importRecoveryDetail) elements.importRecoveryDetail.textContent = text.importRecoveryDetail;
      if (elements.retryImportFileButton) elements.retryImportFileButton.textContent = text.chooseAnotherFile;
      renderAppInfo();
    }

    function showImportRecovery(errorText) {
      if (!elements.importRecovery) return;
      elements.importRecovery.hidden = false;
      elements.importRecovery.dataset.type = "error";
      if (elements.importRecoveryDetail) {
        elements.importRecoveryDetail.textContent = errorText || getText().importRecoveryDetail;
      }
    }

    function hideImportRecovery() {
      if (!elements.importRecovery) return;
      elements.importRecovery.hidden = true;
      elements.importRecovery.dataset.type = "";
      if (elements.importRecoveryDetail) {
        elements.importRecoveryDetail.textContent = getText().importRecoveryDetail;
      }
    }

    async function openFeedback() {
      try {
        await desktopPet.openFeedback();
      } catch (_error) {
        setMessage(getText().feedbackFailed, "error");
      }
    }

    return {
      applyLanguage,
      hideImportRecovery,
      loadAppInfo,
      openFeedback,
      showImportRecovery
    };
  }

  const api = { createProductView };
  globalScope.ManagerProductView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
