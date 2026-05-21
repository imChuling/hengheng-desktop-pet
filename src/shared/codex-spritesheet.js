(function attachCodexSpritesheet(globalScope) {
  const CELL_WIDTH = 192;
  const CELL_HEIGHT = 208;
  const EXPECTED_COLUMNS = 8;
  const ROW_COUNTS = [
    ["idle", 6],
    ["running-right", 8],
    ["running-left", 8],
    ["waving", 4],
    ["jumping", 5],
    ["failed", 8],
    ["waiting", 6],
    ["running", 6],
    ["review", 6]
  ];
  let errorApi = globalScope.DesktopPetErrors;
  if (!errorApi && typeof require !== "undefined") {
    try {
      errorApi = require("./app-error");
    } catch (_error) {
      errorApi = null;
    }
  }

  function createSpritesheetError(code, details, fallbackMessage) {
    return errorApi?.createAppError ? errorApi.createAppError(code, details) : new Error(fallbackMessage);
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          createSpritesheetError(
            "SPRITESHEET_DECODE_FAILED",
            {},
            "Could not decode the selected .webp file."
          )
        );
      image.src = dataUrl;
    });
  }

  function cropFrame(image, column, row) {
    const canvas = document.createElement("canvas");
    canvas.width = CELL_WIDTH;
    canvas.height = CELL_HEIGHT;
    const context = canvas.getContext("2d");
    context.drawImage(
      image,
      column * CELL_WIDTH,
      row * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT,
      0,
      0,
      CELL_WIDTH,
      CELL_HEIGHT
    );
    return canvas.toDataURL("image/png");
  }

  function inspectSpritesheetDimensions(width, height) {
    const expectedWidth = CELL_WIDTH * EXPECTED_COLUMNS;
    const expectedHeight = CELL_HEIGHT * ROW_COUNTS.length;
    const valid = width >= expectedWidth && height >= expectedHeight;
    return {
      width,
      height,
      expectedWidth,
      expectedHeight,
      valid,
      states: ROW_COUNTS.map(([state, frameCount], row) => ({
        name: state,
        expectedFrameCount: frameCount,
        status: height >= CELL_HEIGHT * (row + 1) ? "ready" : "missing"
      }))
    };
  }

  function inspectLoadedSpritesheet(image) {
    return inspectSpritesheetDimensions(image.naturalWidth, image.naturalHeight);
  }

  async function inspectSpritesheet(dataUrl) {
    const image = await loadImage(dataUrl);
    return inspectLoadedSpritesheet(image);
  }

  async function extractFramesFromSpritesheet(dataUrl) {
    const image = await loadImage(dataUrl);
    const inspection = inspectLoadedSpritesheet(image);
    if (!inspection.valid) {
      throw createSpritesheetError(
        "SPRITESHEET_WRONG_SIZE",
        {
          expected: `${inspection.expectedWidth}x${inspection.expectedHeight}`,
          actual: `${inspection.width}x${inspection.height}`,
          expectedWidth: inspection.expectedWidth,
          expectedHeight: inspection.expectedHeight,
          width: inspection.width,
          height: inspection.height
        },
        `This file does not look like a 9-state Codex pet spritesheet. Expected at least ${inspection.expectedWidth}x${inspection.expectedHeight}px, got ${inspection.width}x${inspection.height}px.`
      );
    }

    const framesByState = {};
    ROW_COUNTS.forEach(([state, frameCount], row) => {
      framesByState[state] = Array.from({ length: frameCount }, (_value, column) => cropFrame(image, column, row));
    });

    return {
      framesByState,
      iconDataUrl: cropFrame(image, 0, 0)
    };
  }

  const api = {
    CELL_HEIGHT,
    CELL_WIDTH,
    EXPECTED_COLUMNS,
    ROW_COUNTS,
    extractFramesFromSpritesheet,
    inspectSpritesheetDimensions,
    inspectSpritesheet
  };

  globalScope.CodexSpritesheet = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
