(function attachPreviewView(globalScope) {
  function defaultFrameDuration(stateName) {
    return stateName.startsWith("running") ? 85 : stateName === "jumping" ? 110 : 140;
  }

  function createPreviewView({ elements, getSelectedCharacter, getState }) {
    let previewTimer = null;
    let previewFrameIndex = 0;
    let previewSignature = "";

    function stopPreview() {
      if (previewTimer) {
        clearInterval(previewTimer);
        previewTimer = null;
      }
      previewSignature = "";
    }

    function startPreview(activeState) {
      const character = getSelectedCharacter();
      const state = getState(character, activeState);
      const frames = state?.frames ?? [];
      const nextSignature = `${character?.id ?? ""}:${activeState}:${frames.join("|")}`;

      if (frames.length === 0) {
        stopPreview();
        elements.previewFrame.removeAttribute("src");
        elements.previewEmpty.hidden = false;
        return;
      }

      elements.previewEmpty.hidden = true;
      if (previewSignature === nextSignature && previewTimer) {
        return;
      }

      stopPreview();
      previewSignature = nextSignature;
      previewFrameIndex = 0;

      elements.previewFrame.src = frames[0];
      if (frames.length < 2) return;

      previewTimer = setInterval(() => {
        previewFrameIndex = (previewFrameIndex + 1) % frames.length;
        elements.previewFrame.src = frames[previewFrameIndex];
      }, defaultFrameDuration(activeState));
    }

    function clearPreview() {
      stopPreview();
      elements.previewFrame.removeAttribute("src");
      elements.previewEmpty.hidden = false;
    }

    return {
      clearPreview,
      startPreview,
      stopPreview
    };
  }

  const api = { createPreviewView, defaultFrameDuration };
  globalScope.ManagerPreviewView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
