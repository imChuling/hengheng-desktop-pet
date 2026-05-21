const petFrame = document.getElementById("pet-frame");
const petShell = document.querySelector(".pet-shell");
const petStage = document.querySelector(".pet-stage");
const hitTestCanvas = document.createElement("canvas");
const hitTestContext = hitTestCanvas.getContext("2d", { willReadFrequently: true });
const HOVER_ENTER_ALPHA = 32;
const HOVER_LEAVE_ALPHA = 6;
const POINTER_ACTION_ALPHA = 20;
const HOVER_LEAVE_GRACE_MS = 90;

let appConfig = null;
let currentCharacter = null;
let behaviorMode = { type: "auto" };
let autonomousWalkEnabled = true;
let petPaused = false;
let language = "en";
let stateMachine = null;
let hoverOnOpaquePixel = false;
let dragCursorActive = false;
let mousePassThroughActive = false;
let lastPointerPosition = null;
let hoverLeaveTimer = null;
let destroyDragController = null;
const cleanupHandlers = [];

function syncCursorState() {
  petStage.classList.toggle("pet-hover-draggable", hoverOnOpaquePixel && !dragCursorActive);
  petStage.classList.toggle("pet-dragging", dragCursorActive);
}

function setMousePassThrough(enabled) {
  if (mousePassThroughActive === enabled) return;
  mousePassThroughActive = enabled;
  window.desktopPet.setMousePassThrough(enabled);
}

function syncMousePassThrough() {
  setMousePassThrough(!hoverOnOpaquePixel && !dragCursorActive);
}

function refreshHitTestSurface() {
  if (!petFrame.naturalWidth || !petFrame.naturalHeight) return;
  hitTestCanvas.width = petFrame.naturalWidth;
  hitTestCanvas.height = petFrame.naturalHeight;
  hitTestContext.clearRect(0, 0, hitTestCanvas.width, hitTestCanvas.height);
  hitTestContext.drawImage(petFrame, 0, 0, hitTestCanvas.width, hitTestCanvas.height);
}

function readAlphaAtPoint(point) {
  if (!petFrame.naturalWidth || !petFrame.naturalHeight) return false;

  const rect = petFrame.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  const localX = point.clientX - rect.left;
  const localY = point.clientY - rect.top;

  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
    return false;
  }

  const pixelX = Math.max(
    0,
    Math.min(petFrame.naturalWidth - 1, Math.floor((localX / rect.width) * petFrame.naturalWidth))
  );
  const pixelY = Math.max(
    0,
    Math.min(petFrame.naturalHeight - 1, Math.floor((localY / rect.height) * petFrame.naturalHeight))
  );
  const [, , , alpha] = hitTestContext.getImageData(pixelX, pixelY, 1, 1).data;
  return alpha;
}

function isOpaquePixelAtPoint(point, threshold = POINTER_ACTION_ALPHA) {
  return readAlphaAtPoint(point) > threshold;
}

function isOpaquePixelAtEvent(event) {
  return isOpaquePixelAtPoint(event, POINTER_ACTION_ALPHA);
}

function syncHoverFromPoint(point) {
  const alpha = readAlphaAtPoint(point);
  const nextHoverOnOpaquePixel = hoverOnOpaquePixel ? alpha > HOVER_LEAVE_ALPHA : alpha > HOVER_ENTER_ALPHA;
  if (nextHoverOnOpaquePixel === hoverOnOpaquePixel) return;

  window.clearTimeout(hoverLeaveTimer);

  if (nextHoverOnOpaquePixel) {
    hoverOnOpaquePixel = true;
    syncCursorState();
    syncMousePassThrough();
    stateMachine.handleHoverStart();
    return;
  }

  hoverLeaveTimer = window.setTimeout(() => {
    if (!lastPointerPosition) return;
    if (readAlphaAtPoint(lastPointerPosition) > HOVER_LEAVE_ALPHA) return;
    hoverOnOpaquePixel = false;
    syncCursorState();
    syncMousePassThrough();
    stateMachine.handleHoverEnd();
  }, HOVER_LEAVE_GRACE_MS);
}

function syncHoverFromPointer(event) {
  lastPointerPosition = {
    clientX: event.clientX,
    clientY: event.clientY
  };
  syncHoverFromPoint(lastPointerPosition);
}

function applySizeMode(mode) {
  const preset = window.PetConfig.SIZE_PRESETS[mode] ?? window.PetConfig.SIZE_PRESETS.default;
  document.documentElement.style.setProperty("--pet-width", `${preset.petWidth}px`);
  document.documentElement.style.setProperty("--stage-padding-top", `${preset.stagePaddingTop}px`);
  document.documentElement.style.setProperty("--stage-padding-bottom", `${preset.stagePaddingBottom}px`);
  document.documentElement.style.setProperty("--pet-offset-y", `${preset.petOffsetY ?? 0}px`);
}

function renderPausedState() {
  petShell.classList.toggle("pet-paused", petPaused);
}

async function setCharacter(characterId) {
  let nextCharacter = appConfig.characters.find((character) => character.id === characterId);
  if (!nextCharacter) {
    await reloadConfig();
    nextCharacter = appConfig.characters.find((character) => character.id === characterId);
  }
  if (!nextCharacter) return;
  currentCharacter = nextCharacter;
  stateMachine.setCharacter(nextCharacter);
}

async function reloadConfig() {
  appConfig = await window.desktopPet.getConfig();
  language = appConfig.language ?? "en";
}

async function bootstrap() {
  appConfig = await window.desktopPet.getConfig();
  language = appConfig.language ?? "en";
  currentCharacter = appConfig.characters.find((character) => character.id === appConfig.selectedCharacterId) ?? appConfig.characters[0];
  if (!currentCharacter) {
    console.error("[desktop-pet] No valid pet characters are available.");
    petFrame.removeAttribute("src");
    petFrame.alt = language === "zh-CN" ? "没有可用的桌宠角色。" : "No valid desktop pet characters are available.";
    return;
  }
  behaviorMode = appConfig.behaviorMode ?? { type: "auto" };
  autonomousWalkEnabled = appConfig.autonomousWalkEnabled ?? true;
  petPaused = appConfig.petPaused ?? false;
  renderPausedState();
  applySizeMode(appConfig.sizeMode ?? "default");
  stateMachine = window.createPetStateMachine({
    desktopPet: window.desktopPet,
    onFrame: (framePath) => {
      petFrame.src = framePath;
    }
  });

  petShell.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.desktopPet.openMenu();
  });

  petFrame.addEventListener("load", () => {
    refreshHitTestSurface();
    if (lastPointerPosition) {
      syncHoverFromPoint(lastPointerPosition);
    }
  });

  window.addEventListener("mousemove", (event) => {
    syncHoverFromPointer(event);
  });

  petFrame.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    dragCursorActive = isOpaquePixelAtEvent(event);
    syncCursorState();
    syncMousePassThrough();
  });

  window.addEventListener("mouseleave", () => {
    window.clearTimeout(hoverLeaveTimer);
    lastPointerPosition = null;
    hoverOnOpaquePixel = false;
    if (!dragCursorActive) {
      syncCursorState();
    }
    syncMousePassThrough();
    stateMachine.handleHoverEnd();
  });

  window.addEventListener("mouseup", () => {
    dragCursorActive = false;
    syncCursorState();
    syncMousePassThrough();
  });

  window.addEventListener("blur", () => {
    dragCursorActive = false;
    syncCursorState();
    syncMousePassThrough();
  });

  destroyDragController = window.createPetDragController({
    target: petStage,
    onBeginDrag: (event) => stateMachine.beginDrag(event),
    onClick: () => stateMachine.handleClick(),
    onDragMove: (event) => stateMachine.handleDragMove(event),
    onEndDrag: () => stateMachine.endDrag(),
    shouldBeginDragAt: (event) => isOpaquePixelAtEvent(event),
    shouldTriggerClickAt: (event) => isOpaquePixelAtEvent(event)
  });

  cleanupHandlers.push(window.desktopPet.onSetBehaviorMode((mode) => {
    behaviorMode = mode;
    stateMachine.setBehaviorMode(mode);
  }));

  cleanupHandlers.push(window.desktopPet.onSetAutonomousWalkEnabled((enabled) => {
    autonomousWalkEnabled = enabled;
    stateMachine.setAutonomousWalkEnabled(enabled);
  }));

  cleanupHandlers.push(window.desktopPet.onSetPaused((paused) => {
    petPaused = paused;
    renderPausedState();
    stateMachine.setPaused(paused);
  }));

  cleanupHandlers.push(window.desktopPet.onSetCharacter((characterId) => {
    void setCharacter(characterId);
  }));

  cleanupHandlers.push(window.desktopPet.onReloadConfig(async () => {
    await reloadConfig();
  }));

  cleanupHandlers.push(window.desktopPet.onSetSizeMode((mode) => {
    applySizeMode(mode);
  }));

  stateMachine.initialize({
    character: currentCharacter,
    initialAutonomousWalkEnabled: autonomousWalkEnabled,
    initialBehaviorMode: behaviorMode,
    initialPaused: petPaused
  });
  syncMousePassThrough();
}

window.addEventListener("beforeunload", () => {
  window.clearTimeout(hoverLeaveTimer);
  stateMachine?.destroy();
  destroyDragController?.();
  for (const cleanup of cleanupHandlers.splice(0)) {
    cleanup();
  }
});

bootstrap();
