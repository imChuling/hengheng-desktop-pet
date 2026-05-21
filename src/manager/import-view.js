(function attachImportView(globalScope) {
  function createImportView({
    elements,
    formatText,
    getSelectedSpritesheet,
    getSelectedSpritesheetPreview,
    getText,
    setSelectedSpritesheet,
    stateLabel
  }) {
    function getErrorPayload(error) {
      const parsed = globalScope.DesktopPetErrors?.parseAppError?.(error);
      if (parsed) {
        return parsed;
      }

      const message = error?.message ?? "";
      if (message.includes("Could not decode")) {
        return { code: "SPRITESHEET_DECODE_FAILED", details: {} };
      }
      if (message.includes("too large") || message.includes("smaller than 32 MB")) {
        return { code: "SPRITESHEET_FILE_TOO_LARGE", details: { maxMb: 32 } };
      }

      const dimensionMatch = /Expected at least (\d+x\d+)px, got (\d+x\d+)px/u.exec(message);
      if (dimensionMatch) {
        return {
          code: "SPRITESHEET_WRONG_SIZE",
          details: {
            expected: dimensionMatch[1],
            actual: dimensionMatch[2]
          }
        };
      }

      if (message.includes("9-state Codex pet spritesheet")) {
        return { code: "SPRITESHEET_NOT_CODEX", details: {} };
      }

      return null;
    }

    function formatError(code, details = {}) {
      const ui = getText();
      const template = ui.errors?.[code] ?? ui.errors?.UNKNOWN ?? ui.importFailed;
      return formatText(template, {
        ...details,
        maxMb: details.maxMb ?? 32,
        state: details.state ? stateLabel(details.state) : ""
      });
    }

    function friendlyImportError(error) {
      const payload = getErrorPayload(error);
      if (payload) {
        return formatError(payload.code, payload.details);
      }
      return getText().importFailed;
    }

    function renderImportPreview(preview) {
      if (!preview) {
        elements.importPreview.hidden = true;
        elements.importPreview.replaceChildren();
        return;
      }

      const text = getText();
      const summary = document.createElement("p");
      summary.textContent = preview.valid
        ? text.fileReady.replace("{size}", `${preview.width}x${preview.height}`)
        : text.fileWrongSize
            .replace("{size}", `${preview.width}x${preview.height}`)
            .replace("{expected}", `${preview.expectedWidth}x${preview.expectedHeight}`);
      elements.importPreview.classList.toggle("is-ready", preview.valid);
      elements.importPreview.classList.toggle("is-invalid", !preview.valid);
      elements.importPreview.replaceChildren(summary);
      elements.importPreview.hidden = false;
    }

    function renderImportSteps() {
      if (!elements.importSteps) return;
      const hasFile = Boolean(getSelectedSpritesheet());
      const passedCheck = Boolean(getSelectedSpritesheetPreview()?.valid);
      elements.importSteps.querySelector('[data-step="file"]')?.classList.toggle("is-complete", hasFile);
      elements.importSteps.querySelector('[data-step="check"]')?.classList.toggle("is-complete", passedCheck);
      elements.importSteps.querySelector('[data-step="import"]')?.classList.toggle("is-complete", false);
      elements.saveImportedPetButton.disabled = !passedCheck;
    }

    function markImportComplete() {
      elements.importSteps.querySelector('[data-step="import"]')?.classList.add("is-complete");
    }

    function resetImportForm() {
      setSelectedSpritesheet(null, null);
      elements.importSpritesheetPathInput.value = "";
      elements.importPetNameInput.value = "";
      elements.replaceImportedPetInput.checked = false;
      renderImportPreview(null);
      renderImportSteps();
    }

    return {
      friendlyImportError,
      markImportComplete,
      renderImportPreview,
      renderImportSteps,
      resetImportForm
    };
  }

  const api = { createImportView };
  globalScope.ManagerImportView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
