const petList = document.getElementById("pet-list");
const petCount = document.getElementById("pet-count");
const petEmpty = document.getElementById("pet-empty");
const emptyImportPetButton = document.getElementById("empty-import-pet");
const emptyRefreshPetsButton = document.getElementById("empty-refresh-pets");
const importButton = document.getElementById("import-pet");
const feedbackButton = document.getElementById("feedback-pet");
const helpButton = document.getElementById("help-pet");
const settingsButton = document.getElementById("settings-pet");
const refreshButton = document.getElementById("refresh-pets");
const libraryView = document.getElementById("library-view");
const importView = document.getElementById("import-view");
const helpView = document.getElementById("help-view");
const settingsView = document.getElementById("settings-view");
const previewFrame = document.getElementById("preview-frame");
const previewEmpty = document.getElementById("preview-empty");
const stateTabs = document.getElementById("state-tabs");
const selectedIcon = document.getElementById("selected-icon");
const selectedName = document.getElementById("selected-name");
const selectedMeta = document.getElementById("selected-meta");
const usePetButton = document.getElementById("use-pet");
const renamePetButton = document.getElementById("rename-pet");
const deletePetButton = document.getElementById("delete-pet");
const firstUseGuide = document.getElementById("first-use-guide");
const firstUseImportButton = document.getElementById("first-use-import");
const onboardingCard = document.getElementById("onboarding-card");
const onboardingImportButton = document.getElementById("onboarding-import");
const onboardingSettingsButton = document.getElementById("onboarding-settings");
const renameRow = document.getElementById("rename-row");
const renameInput = document.getElementById("rename-input");
const saveRenameButton = document.getElementById("save-rename");
const statusSummary = document.getElementById("status-summary");
const stateList = document.getElementById("state-list");
const resourceRecovery = document.getElementById("resource-recovery");
const resourceRecoveryRefreshButton = document.getElementById("resource-recovery-refresh");
const resourceRecoveryImportButton = document.getElementById("resource-recovery-import");
const message = document.getElementById("message");
const chooseImportFileButton = document.getElementById("choose-import-file");
const importSteps = document.getElementById("import-steps");
const importSpritesheetPathInput = document.getElementById("import-spritesheet-path");
const importPreview = document.getElementById("import-preview");
const importRecovery = document.getElementById("import-recovery");
const importPetNameInput = document.getElementById("import-pet-name");
const replaceImportedPetInput = document.getElementById("replace-imported-pet");
const cancelImportButton = document.getElementById("cancel-import");
const continueImportButton = document.getElementById("continue-import");
const saveImportedPetButton = document.getElementById("save-imported-pet");
const retryImportFileButton = document.getElementById("retry-import-file");
const closeHelpButton = document.getElementById("close-help");
const closeSettingsButton = document.getElementById("close-settings");
const settingsLanguageInput = document.getElementById("settings-language");
const settingsThemeInput = document.getElementById("settings-theme");
const settingsSizeInput = document.getElementById("settings-size");
const settingsAlwaysOnTopInput = document.getElementById("settings-always-on-top");
const settingsPausePetInput = document.getElementById("settings-pause-pet");
const settingsAutoMotionInput = document.getElementById("settings-auto-motion");
const settingsLaunchAtLoginInput = document.getElementById("settings-launch-at-login");
const settingsResetPositionButton = document.getElementById("settings-reset-position");
const appMeta = document.getElementById("app-meta");
const aboutReleaseTitle = document.getElementById("about-release-title");
const aboutReleaseDetail = document.getElementById("about-release-detail");
const importRecoveryTitle = document.getElementById("import-recovery-title");
const importRecoveryDetail = document.getElementById("import-recovery-detail");
const onboardingTitle = document.getElementById("onboarding-title");
const onboardingDetail = document.getElementById("onboarding-detail");

const { UI_TEXT, formatText } = window.ManagerI18n;
const initialManagerState = window.ManagerState.createManagerState();
const localeView = window.ManagerLocaleView.createLocaleView({
  document,
  getText: () => uiText(),
  onApplyDynamicLanguage: () => {
    getProductViewController().applyLanguage();
    renderViewButtons();
  }
});

let characters = initialManagerState.characters;
let characterDetailsById = initialManagerState.characterDetailsById;
let selectedCharacterId = initialManagerState.selectedCharacterId;
let activeCharacterId = initialManagerState.activeCharacterId;
let activeState = initialManagerState.activeState;
let renaming = initialManagerState.renaming;
let selectedSpritesheet = initialManagerState.selectedSpritesheet;
let selectedSpritesheetPreview = initialManagerState.selectedSpritesheetPreview;
let currentView = initialManagerState.currentView;
let appSettings = initialManagerState.appSettings;
let uiLanguage = initialManagerState.uiLanguage;
let detailRequestId = initialManagerState.detailRequestId;
let petRowElementsById = new Map();
let stateTabElementsByName = new Map();
let highlightedCharacterId = null;
let highlightTimer = null;
let importViewController = null;
let petListViewController = null;
let settingsViewController = null;
let productViewController = null;
let previewViewController = null;

function getImportViewController() {
  if (!importViewController) {
    importViewController = window.ManagerImportView.createImportView({
      elements: {
        importPetNameInput,
        importPreview,
        importSpritesheetPathInput,
        importSteps,
        replaceImportedPetInput,
        saveImportedPetButton
      },
      formatText,
      getSelectedSpritesheet: () => selectedSpritesheet,
      getSelectedSpritesheetPreview: () => selectedSpritesheetPreview,
      getText: uiText,
      setSelectedSpritesheet: (spritesheet, preview) => {
        selectedSpritesheet = spritesheet;
        selectedSpritesheetPreview = preview;
      },
      stateLabel
    });
  }
  return importViewController;
}

function getPetListViewController() {
  if (!petListViewController) {
    petListViewController = window.ManagerPetListView.createPetListView({
      formatText,
      getText: uiText,
      stateLabel
    });
  }
  return petListViewController;
}

function getSettingsViewController() {
  if (!settingsViewController) {
    settingsViewController = window.ManagerSettingsView.createSettingsView({
      desktopPet: window.desktopPet,
      elements: {
        settingsAlwaysOnTopInput,
        settingsAutoMotionInput,
        settingsLanguageInput,
        settingsLaunchAtLoginInput,
        settingsPausePetInput,
        settingsSizeInput,
        settingsThemeInput
      },
      getText: uiText,
      onSettingsLoaded: (settings) => {
        appSettings = settings;
      },
      renderLanguage: (language) => {
        uiLanguage = language;
        applyLanguage();
      },
      setMessage
    });
  }
  return settingsViewController;
}

function getProductViewController() {
  if (!productViewController) {
    productViewController = window.ManagerProductView.createProductView({
      desktopPet: window.desktopPet,
      elements: {
        aboutReleaseDetail,
        aboutReleaseTitle,
        appMeta,
        feedbackButton,
        importRecovery,
        importRecoveryDetail,
        importRecoveryTitle,
        onboardingCard,
        onboardingDetail,
        onboardingImportButton,
        onboardingSettingsButton,
        onboardingTitle,
        retryImportFileButton
      },
      formatText,
      getText: uiText,
      setMessage
    });
  }
  return productViewController;
}

function getPreviewViewController() {
  if (!previewViewController) {
    previewViewController = window.ManagerPreviewView.createPreviewView({
      elements: {
        previewEmpty,
        previewFrame
      },
      getSelectedCharacter,
      getState
    });
  }
  return previewViewController;
}

function uiText() {
  return UI_TEXT[uiLanguage] ?? UI_TEXT.en;
}

function renderViewButtons() {
  const text = uiText();
  importButton.textContent = currentView === "import" ? text.library : text.importPet;
  helpButton.textContent = currentView === "help" ? text.library : text.help;
  settingsButton.textContent = currentView === "settings" ? text.library : text.settings;
  feedbackButton.textContent = text.feedback;
  refreshButton.textContent = text.refresh;
}

function applyLanguage() {
  localeView.applyLanguage(uiLanguage);
  render();
}

function setMessage(text, type = "info") {
  message.textContent = text;
  message.dataset.type = type;
}

function friendlyImportError(error) {
  return getImportViewController().friendlyImportError(error);
}

function showView(view) {
  currentView = view;
  libraryView.hidden = view !== "library";
  importView.hidden = view !== "import";
  helpView.hidden = view !== "help";
  settingsView.hidden = view !== "settings";
  refreshButton.hidden = view !== "library";
  renderViewButtons();
  setMessage("");
  if (view === "settings") {
    void loadSettings();
  }
  if (view === "import") {
    renderImportSteps();
  }
  if (view === "library") {
    startPreview();
  } else {
    stopPreview();
  }
}

function renderSettings() {
  getSettingsViewController().renderSettings(appSettings);
}

async function loadSettings() {
  await getSettingsViewController().loadSettings();
}

async function updateSettings(patch) {
  await getSettingsViewController().updateSettings(patch);
}

function renderImportPreview(preview) {
  getImportViewController().renderImportPreview(preview);
}

function renderImportSteps() {
  getImportViewController().renderImportSteps();
}

function resetImportForm() {
  getImportViewController().resetImportForm();
  getProductViewController().hideImportRecovery();
}

function getSelectedCharacter() {
  const summary = characters.find((character) => character.id === selectedCharacterId) ?? characters[0] ?? null;
  if (!summary) return null;
  return characterDetailsById.get(summary.id) ?? summary;
}

function getState(character, stateName) {
  return character?.states.find((state) => state.name === stateName) ?? character?.states[0] ?? null;
}

function stateHasPlayableFrames(state, character) {
  const idleState = getState(character, "idle");
  if (!characterDetailsById.has(character?.id)) return false;
  return state?.frames?.length > 0 || (state?.status === "fallback" && idleState?.frames?.length > 0);
}

function healthClass(character) {
  if (!character.valid) return "is-invalid";
  return character.issues.length > 0 ? "has-issues" : "";
}

function sourceLabel(source) {
  return getPetListViewController().sourceLabel(source);
}

function stateLabel(stateName) {
  return uiText().states[stateName] ?? stateName;
}

function friendlyIssue(issue) {
  return getPetListViewController().friendlyIssue(issue);
}

function healthSummary(character) {
  return getPetListViewController().healthSummary(character);
}

function stopPreview() {
  getPreviewViewController().stopPreview();
}

function startPreview() {
  getPreviewViewController().startPreview(activeState);
}

async function loadSelectedCharacterDetail() {
  const characterId = selectedCharacterId;
  if (!characterId) return null;
  if (characterDetailsById.has(characterId)) {
    return characterDetailsById.get(characterId);
  }

  const requestId = ++detailRequestId;
  try {
    const detail = await window.desktopPet.getCharacterDetail(characterId);
    if (requestId !== detailRequestId || detail.id !== selectedCharacterId) return null;
    characterDetailsById.set(detail.id, detail);
    render();
    return detail;
  } catch (error) {
    setMessage(error.message || uiText().previewLoadFailed, "error");
    return null;
  }
}

async function selectCharacterInManager(characterId) {
  if (selectedCharacterId === characterId && characterDetailsById.has(characterId)) return;

  selectedCharacterId = characterId;
  const summary = characters.find((character) => character.id === characterId);
  activeState = getState(characterDetailsById.get(characterId) ?? summary, activeState)?.name ?? "idle";
  renaming = false;
  renderPetList();

  await loadSelectedCharacterDetail();
  const character = getSelectedCharacter();
  activeState = getState(character, activeState)?.name ?? "idle";
  render();
}

function createPetRow(characterId) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "pet-row";
  row.dataset.characterId = characterId;

  const icon = document.createElement("img");
  icon.draggable = false;
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.alt = "";

  const text = document.createElement("div");
  const title = document.createElement("div");
  title.className = "pet-row-title";
  const meta = document.createElement("div");
  meta.className = "pet-row-meta";
  const source = document.createElement("span");
  const selected = document.createElement("span");
  selected.className = "source-pill is-active";
  selected.textContent = uiText().active;
  meta.append(source, selected);
  text.append(title, meta);

  const dot = document.createElement("span");
  row.append(icon, text, dot);

  row.addEventListener("click", () => {
    const character = characters.find((candidate) => candidate.id === row.dataset.characterId);
    if (!character) return;
    void selectCharacterInManager(character.id);
  });

  return {
    dot,
    icon,
    row,
    selected,
    source,
    title
  };
}

function updatePetRow(rowRecord, character) {
  const { dot, icon, row, selected, source, title } = rowRecord;
  row.classList.toggle("is-selected", character.id === selectedCharacterId);
  row.classList.toggle("is-new", character.id === highlightedCharacterId);
  title.textContent = character.name;
  source.className = `source-pill ${character.source === "user" ? "is-imported" : "is-built-in"}`;
  source.textContent = sourceLabel(character.source);
  selected.textContent = uiText().active;
  selected.hidden = character.id !== activeCharacterId;
  dot.className = `health-dot ${healthClass(character)}`;
  dot.title = character.valid ? formatText(uiText().issueCount, { count: character.issues.length }) : uiText().invalidPet;

  const iconSrc = character.thumbnail ?? character.icon ?? "";
  if (icon.getAttribute("src") !== iconSrc) {
    if (iconSrc) {
      icon.src = iconSrc;
    } else {
      icon.removeAttribute("src");
    }
  }
}

function renderPetList() {
  petCount.textContent = String(characters.length);
  petEmpty.hidden = characters.length > 0;
  const nextRows = new Map();
  const rowNodes = characters.map((character) => {
    const rowRecord = petRowElementsById.get(character.id) ?? createPetRow(character.id);
    updatePetRow(rowRecord, character);
    nextRows.set(character.id, rowRecord);
    return rowRecord.row;
  });
  petRowElementsById = nextRows;
  petList.replaceChildren(...rowNodes);
}

function scrollPetIntoView(characterId) {
  const rowRecord = petRowElementsById.get(characterId);
  rowRecord?.row.scrollIntoView?.({
    block: "nearest",
    inline: "nearest"
  });
}

function highlightPet(characterId) {
  highlightedCharacterId = characterId;
  if (highlightTimer) {
    clearTimeout(highlightTimer);
  }
  renderPetList();
  scrollPetIntoView(characterId);
  highlightTimer = setTimeout(() => {
    if (highlightedCharacterId !== characterId) return;
    highlightedCharacterId = null;
    highlightTimer = null;
    renderPetList();
  }, 1800);
}

function createStateTab(stateName) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "state-tab";
  tab.dataset.stateName = stateName;
  tab.addEventListener("click", () => {
    const character = getSelectedCharacter();
    const state = getState(character, tab.dataset.stateName);
    if (!character || !state) return;
    activeState = state.name;
    renderStateTabs(character);
    renderStateList(character);
    startPreview();
  });
  return tab;
}

function renderStateTabs(character) {
  const nextTabs = new Map();
  const tabNodes = character.states.map((state) => {
    const tab = stateTabElementsByName.get(state.name) ?? createStateTab(state.name);
    tab.classList.toggle("is-active", state.name === activeState);
    tab.textContent = stateLabel(state.name);
    tab.disabled = !stateHasPlayableFrames(state, character);
    nextTabs.set(state.name, tab);
    return tab;
  });
  stateTabElementsByName = nextTabs;
  stateTabs.replaceChildren(...tabNodes);
}

function renderDetails(character) {
  const text = uiText();
  const hasImportedPets = characters.some((candidate) => candidate.source === "user");
  selectedIcon.src = character.thumbnail ?? character.icon ?? "";
  selectedIcon.hidden = !(character.thumbnail ?? character.icon);
  selectedName.textContent = character.name;
  selectedMeta.textContent = `${character.id} · ${sourceLabel(character.source)} · ${character.valid ? text.usable : text.invalid}`;

  usePetButton.disabled = !character.valid;
  renamePetButton.disabled = character.source !== "user";
  renamePetButton.textContent = renaming && character.source === "user" ? text.cancel : text.rename;
  deletePetButton.disabled = character.source !== "user";
  firstUseGuide.hidden = hasImportedPets;
  onboardingCard.hidden = Boolean(appSettings?.hasCompletedOnboarding);
  resourceRecovery.hidden = character.valid;
  renameRow.classList.toggle("is-visible", renaming && character.source === "user");
  renameInput.value = character.name;

  const summary = healthSummary(character);
  const item = document.createElement("div");
  item.className = `status-card ${character.valid ? "is-ready" : "needs-attention"}`;
  const label = document.createElement("strong");
  label.textContent = summary.label;
  const detail = document.createElement("span");
  detail.textContent = summary.detail;
  item.append(label, detail);
  statusSummary.replaceChildren(item);
}

function renderStateList(character) {
  const text = uiText();
  const relaxState = getState(character, "idle");
  const fallbackStates = character.states.filter((state) => state.status === "fallback");
  const missingStates = character.states.filter((state) => state.status === "missing");
  const optionalReadyCount = character.states.filter((state) => state.name !== "idle" && state.status === "ok").length;
  const diagnosticItems = [
    {
      label: text.coreAnimation,
      value: relaxState?.status === "ok" ? text.readyValue : text.missingValue,
      status: relaxState?.status === "ok" ? "ok" : "missing"
    },
    {
      label: text.optionalAnimations,
      value: formatText(text.optionalReadyCount, {
        ready: optionalReadyCount,
        total: Math.max(character.states.length - 1, 0)
      }),
      status: missingStates.length > 0 ? "missing" : fallbackStates.length > 0 ? "fallback" : "ok"
    }
  ];

  if (fallbackStates.length > 0) {
    diagnosticItems.push({
      label: text.usesRelaxInstead,
      value: fallbackStates.map((state) => stateLabel(state.name)).join(", "),
      status: "fallback"
    });
  }

  if (missingStates.length > 0) {
    diagnosticItems.push({
      label: text.missing,
      value: missingStates.map((state) => stateLabel(state.name)).join(", "),
      status: "missing"
    });
  }

  stateList.replaceChildren(
    ...diagnosticItems.map((diagnostic) => {
      const item = document.createElement("div");
      item.className = "state-item";
      const label = document.createElement("span");
      label.className = "state-item-name";
      label.textContent = diagnostic.label;
      const status = document.createElement("span");
      status.className = `state-status ${diagnostic.status}`;
      status.textContent = diagnostic.value;
      item.append(label, status);
      return item;
    })
  );
}

function renderEmpty() {
  petCount.textContent = "0";
  petEmpty.hidden = false;
  petRowElementsById = new Map();
  stateTabElementsByName = new Map();
  petList.replaceChildren();
  stateTabs.replaceChildren();
  statusSummary.replaceChildren();
  stateList.replaceChildren();
  previewFrame.removeAttribute("src");
  getPreviewViewController().clearPreview();
  selectedIcon.hidden = true;
  selectedName.textContent = uiText().noPetSelected;
  selectedMeta.textContent = "";
  usePetButton.disabled = true;
  renamePetButton.disabled = true;
  deletePetButton.disabled = true;
  firstUseGuide.hidden = false;
  resourceRecovery.hidden = false;
}

function render() {
  const character = getSelectedCharacter();
  if (!character) {
    renderEmpty();
    return;
  }

  selectedCharacterId = character.id;
  if (!getState(character, activeState)) {
    activeState = "idle";
  }

  renderPetList();
  renderStateTabs(character);
  renderDetails(character);
  renderStateList(character);
  if (currentView === "library") {
    startPreview();
  }
}

async function loadCharacters() {
  try {
    const payload = await window.desktopPet.listCharacterDetails();
    const previousDetails = characterDetailsById;
    characters = payload.characters;
    characterDetailsById = new Map(
      characters
        .map((character) => [character.id, previousDetails.get(character.id)])
        .filter(([, detail]) => Boolean(detail))
    );
    activeCharacterId = payload.selectedCharacterId;
    selectedCharacterId = selectedCharacterId ?? activeCharacterId;
    if (!getSelectedCharacter()) {
      selectedCharacterId = activeCharacterId ?? characters[0]?.id ?? null;
    }
    setMessage("");
    render();
    await loadSelectedCharacterDetail();
  } catch (error) {
    setMessage(error.message || uiText().petsLoadFailed, "error");
  }
}

refreshButton.addEventListener("click", () => {
  void loadCharacters();
});

emptyRefreshPetsButton.addEventListener("click", () => {
  void loadCharacters();
});

emptyImportPetButton.addEventListener("click", () => {
  showView("import");
});

resourceRecoveryRefreshButton.addEventListener("click", () => {
  void loadCharacters();
});

resourceRecoveryImportButton.addEventListener("click", () => {
  showView("import");
});

importButton.addEventListener("click", () => {
  showView(currentView === "import" ? "library" : "import");
});

helpButton.addEventListener("click", () => {
  showView(currentView === "help" ? "library" : "help");
});

feedbackButton.addEventListener("click", () => {
  void getProductViewController().openFeedback();
});

settingsButton.addEventListener("click", () => {
  showView(currentView === "settings" ? "library" : "settings");
});

cancelImportButton.addEventListener("click", () => {
  showView("library");
});

continueImportButton.addEventListener("click", () => {
  resetImportForm();
  continueImportButton.hidden = true;
  showView("import");
  chooseImportFileButton.focus();
});

firstUseImportButton.addEventListener("click", () => {
  showView("import");
});

onboardingImportButton.addEventListener("click", () => {
  showView("import");
});

onboardingSettingsButton.addEventListener("click", () => {
  showView("settings");
});

closeHelpButton.addEventListener("click", () => {
  showView("library");
});

closeSettingsButton.addEventListener("click", () => {
  showView("library");
});

chooseImportFileButton.addEventListener("click", async () => {
  let selectedFile;
  try {
    getProductViewController().hideImportRecovery();
    selectedFile = await window.desktopPet.chooseCodexSpritesheet();
    if (!selectedFile) return;
    selectedSpritesheetPreview = await window.CodexSpritesheet.inspectSpritesheet(selectedFile.dataUrl);
  } catch (error) {
    selectedSpritesheet = null;
    selectedSpritesheetPreview = null;
    renderImportPreview(null);
    renderImportSteps();
    const errorText = friendlyImportError(error) || uiText().chooseSpritesheetFailed;
    getProductViewController().showImportRecovery(errorText);
    setMessage(errorText, "error");
    return;
  }

  selectedSpritesheet = selectedFile;
  continueImportButton.hidden = true;
  importSpritesheetPathInput.value = selectedFile.path;
  if (!importPetNameInput.value.trim()) {
    importPetNameInput.value = selectedFile.suggestedName;
  }
  renderImportPreview(selectedSpritesheetPreview);
  renderImportSteps();
  setMessage("");
});

saveImportedPetButton.addEventListener("click", async () => {
  const characterName = importPetNameInput.value.trim();

  if (!selectedSpritesheet) {
    setMessage(uiText().chooseFileFirst, "error");
    return;
  }

  if (!selectedSpritesheetPreview?.valid) {
    setMessage(uiText().chooseCompleteFile, "error");
    return;
  }

  if (!characterName) {
    setMessage(uiText().enterPetName, "error");
    return;
  }

  saveImportedPetButton.disabled = true;
  getProductViewController().hideImportRecovery();
  setMessage(uiText().importing, "info");

  try {
    const extractedSpritesheet = await window.CodexSpritesheet.extractFramesFromSpritesheet(selectedSpritesheet.dataUrl);
    const importedCharacter = await window.desktopPet.saveImportedCodexPet({
      characterName,
      framesByState: extractedSpritesheet.framesByState,
      iconDataUrl: extractedSpritesheet.iconDataUrl,
      overwrite: replaceImportedPetInput.checked
    });
    getImportViewController().markImportComplete();
    resetImportForm();
    selectedCharacterId = importedCharacter.id;
    activeCharacterId = importedCharacter.id;
    activeState = "idle";
    await loadCharacters();
    continueImportButton.hidden = false;
    showView("library");
    highlightPet(importedCharacter.id);
    setMessage(formatText(uiText().importedPet, { name: importedCharacter.name }), "success");
  } catch (error) {
    const errorText = friendlyImportError(error);
    getProductViewController().showImportRecovery(errorText);
    setMessage(errorText, "error");
  } finally {
    renderImportSteps();
  }
});

retryImportFileButton.addEventListener("click", () => {
  chooseImportFileButton.click();
});

settingsLanguageInput.addEventListener("change", () => {
  void updateSettings({ language: settingsLanguageInput.value });
});

settingsThemeInput.addEventListener("change", () => {
  void updateSettings({ theme: settingsThemeInput.value });
});

settingsSizeInput.addEventListener("change", () => {
  void updateSettings({ sizeMode: settingsSizeInput.value });
});

settingsAlwaysOnTopInput.addEventListener("change", () => {
  void updateSettings({ alwaysOnTop: settingsAlwaysOnTopInput.checked });
});

settingsPausePetInput.addEventListener("change", () => {
  void updateSettings({ petPaused: settingsPausePetInput.checked });
});

settingsAutoMotionInput.addEventListener("change", () => {
  void updateSettings({ autonomousWalkEnabled: settingsAutoMotionInput.checked });
});

settingsLaunchAtLoginInput.addEventListener("change", () => {
  void updateSettings({ launchAtLogin: settingsLaunchAtLoginInput.checked });
});

settingsResetPositionButton.addEventListener("click", async () => {
  await getSettingsViewController().resetPosition();
});

usePetButton.addEventListener("click", async () => {
  const character = getSelectedCharacter();
  if (!character) return;

  try {
    await window.desktopPet.selectCharacter(character.id);
    activeCharacterId = character.id;
    appSettings = await window.desktopPet.updateSettings({ hasCompletedOnboarding: true });
    setMessage(formatText(uiText().usingPet, { name: character.name }), "success");
    await loadCharacters();
  } catch (error) {
    setMessage(error.message || uiText().selectFailed, "error");
  }
});

renamePetButton.addEventListener("click", async () => {
  const character = getSelectedCharacter();
  if (!character || character.source !== "user") return;

  if (renaming) {
    renaming = false;
    renderDetails(character);
    return;
  }

  renaming = true;
  renderDetails(character);
  renameInput.focus();
  renameInput.select();
});

async function saveRename() {
  const character = getSelectedCharacter();
  if (!character || character.source !== "user" || !renaming) return;

  try {
    await window.desktopPet.renameCharacter({
      characterId: character.id,
      name: renameInput.value
    });
    renaming = false;
    setMessage(uiText().renamed, "success");
    await loadCharacters();
  } catch (error) {
    setMessage(error.message || uiText().renameFailed, "error");
  }
}

saveRenameButton.addEventListener("click", () => {
  void saveRename();
});

renameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void saveRename();
  }
  if (event.key === "Escape") {
    renaming = false;
    render();
  }
});

deletePetButton.addEventListener("click", async () => {
  const character = getSelectedCharacter();
  if (!character || character.source !== "user") return;

  try {
    const result = await window.desktopPet.deleteCharacter(character.id);
    selectedCharacterId = result.selectedCharacterId ?? null;
    activeCharacterId = result.selectedCharacterId ?? null;
    activeState = "idle";
    await loadCharacters();
    setMessage(uiText().deleted, "success");
  } catch (error) {
    setMessage(error.message || uiText().deleteFailed, "error");
  }
});

window.desktopPet.onReloadManager(() => {
  void loadCharacters();
});

window.desktopPet.onSettingsUpdated((settings) => {
  appSettings = settings;
  renderSettings();
});

document.addEventListener("dragstart", (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

document.addEventListener("contextmenu", (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.preventDefault();
  }
});

window.addEventListener("beforeunload", () => {
  stopPreview();
});

void loadCharacters();
void loadSettings();
void getProductViewController().loadAppInfo();
