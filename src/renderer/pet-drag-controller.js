(function attachPetDragController(globalScope) {
  const { DRAG_START_THRESHOLD } = globalScope.PetConfig;

  function createPetDragController({
    target,
    onBeginDrag,
    onClick,
    onDragMove,
    onEndDrag,
    shouldBeginDragAt,
    shouldTriggerClickAt
  }) {
    let pointerDownInfo = null;

    const handleMouseDown = async (event) => {
      if (event.button !== 0) return;
      event.preventDefault();

      const dragEligible = shouldBeginDragAt ? shouldBeginDragAt(event) : true;
      pointerDownInfo = {
        button: event.button,
        screenX: event.screenX,
        screenY: event.screenY,
        moved: false,
        dragEligible,
        clickEligible: shouldTriggerClickAt ? shouldTriggerClickAt(event) : true
      };

      if (dragEligible) {
        await onBeginDrag(event);
      }
    };

    const handleMouseMove = (event) => {
      if (pointerDownInfo?.dragEligible && event.buttons === 0) {
        pointerDownInfo = null;
        onEndDrag();
        return;
      }

      if (pointerDownInfo && !pointerDownInfo.moved) {
        const dx = event.screenX - pointerDownInfo.screenX;
        const dy = event.screenY - pointerDownInfo.screenY;
        if (Math.hypot(dx, dy) >= DRAG_START_THRESHOLD) {
          pointerDownInfo.moved = true;
        }
      }

      if (pointerDownInfo?.dragEligible) {
        onDragMove(event);
      }
    };

    const handleMouseUp = (event) => {
      const shouldTriggerClick =
        pointerDownInfo &&
        pointerDownInfo.button === event.button &&
        !pointerDownInfo.moved &&
        pointerDownInfo.clickEligible;
      const dragEligible = pointerDownInfo?.dragEligible;

      pointerDownInfo = null;
      if (dragEligible) {
        onEndDrag();
      }

      if (shouldTriggerClick) {
        onClick();
      }
    };

    const handleBlur = () => {
      const dragEligible = pointerDownInfo?.dragEligible;
      pointerDownInfo = null;
      if (dragEligible) {
        onEndDrag();
      }
    };

    target.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      pointerDownInfo = null;
      target.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleBlur);
    };
  }

  globalScope.createPetDragController = createPetDragController;
})(window);
