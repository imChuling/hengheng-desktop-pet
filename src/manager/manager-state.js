(function attachManagerState(globalScope) {
  function createManagerState() {
    return {
      characters: [],
      characterDetailsById: new Map(),
      selectedCharacterId: null,
      activeCharacterId: null,
      activeState: "idle",
      currentView: "library",
      appSettings: null,
      uiLanguage: "en",
      detailRequestId: 0,
      renaming: false,
      selectedSpritesheet: null,
      selectedSpritesheetPreview: null
    };
  }

  const api = { createManagerState };
  globalScope.ManagerState = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
