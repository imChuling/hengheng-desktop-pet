(function attachPetStateMachine(globalScope) {
  const {
    AMBIENT_ACTION_MAX_MS,
    AMBIENT_ACTION_MIN_MS,
    AMBIENT_ACTIONS,
    AUTONOMOUS_WALK_HOME_RADIUS,
    AUTONOMOUS_WALK_IDLE_GRACE_MS,
    AUTONOMOUS_WALK_INITIAL_MS,
    AUTONOMOUS_WALK_MAX_DISTANCE,
    AUTONOMOUS_WALK_MAX_MS,
    AUTONOMOUS_WALK_MIN_DISTANCE,
    AUTONOMOUS_WALK_MIN_MS,
    AUTONOMOUS_WALK_STEP_PX,
    CLICK_HOLD_MS,
    CLICK_STREAK_WINDOW_MS,
    DEFAULT_STATE,
    DIRECTION_THRESHOLD,
    DRAG_HARD_DROP_DISTANCE,
    DRAG_HARD_DROP_MIN_SPEED_DISTANCE,
    DRAG_HARD_DROP_SPEED,
    DRAG_SOFT_DROP_DISTANCE,
    EDGE_REACTION_COOLDOWN_MS,
    EDGE_REACTION_MARGIN_PX,
    HOVER_STATE,
    INACTIVE_HARD_MS,
    INACTIVE_SOFT_MS,
    REACTION_STATES
  } = globalScope.PetConfig;

  function createPetStateMachine({ desktopPet, onFrame }) {
    let currentCharacter = null;
    let currentState = DEFAULT_STATE;
    let currentFrameIndex = 0;
    let frameTimer = null;
    let behaviorMode = { type: "auto" };
    let autonomousWalkEnabled = true;
    let paused = false;
    let lastInteractionAt = Date.now();
    let hoverActive = false;
    let clickStreak = 0;
    let lastClickAt = 0;
    let reactionState = null;
    let reactionUntil = 0;
    let nextAmbientActionAt = 0;
    let nextAutonomousWalkAt = 0;
    let autonomousHomePosition = null;
    let autonomousWalkDirection = null;
    let autonomousWalkTarget = null;
    let isDragging = false;
    let dragOrigin = null;
    let dragStats = null;
    let dragWindowOrigin = null;
    let dragDirection = null;
    let pendingWindowPosition = null;
    let isWindowMoveInFlight = false;
    let idleWatcherTimer = null;
    let edgeReactionInFlight = false;
    let lastEdgeReactionAt = 0;

    function clearFrameTimer() {
      window.clearInterval(frameTimer);
      frameTimer = null;
    }

    function clearIdleWatcher() {
      window.clearInterval(idleWatcherTimer);
      idleWatcherTimer = null;
    }

    function getStateConfig(state = currentState) {
      return currentCharacter.states[state] ?? currentCharacter.states[DEFAULT_STATE];
    }

    function resolveAvailableState(state, fallbackState = DEFAULT_STATE) {
      const stateConfig = currentCharacter?.states[state];
      if (stateConfig?.frames?.length) {
        return state;
      }
      return currentCharacter?.states[fallbackState]?.frames?.length ? fallbackState : DEFAULT_STATE;
    }

    function renderFrame() {
      const stateConfig = getStateConfig();
      const framePath = stateConfig.frames[currentFrameIndex % stateConfig.frames.length];
      onFrame(framePath);
    }

    function markInteraction() {
      if (paused) return;
      lastInteractionAt = Date.now();
      autonomousWalkDirection = null;
      autonomousWalkTarget = null;
      scheduleNextAutonomousWalk();
    }

    function randomBetween(min, max) {
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    function scheduleNextAmbientAction() {
      nextAmbientActionAt = Date.now() + randomBetween(AMBIENT_ACTION_MIN_MS, AMBIENT_ACTION_MAX_MS);
    }

    function scheduleNextAutonomousWalk() {
      nextAutonomousWalkAt =
        lastInteractionAt + AUTONOMOUS_WALK_IDLE_GRACE_MS + randomBetween(AUTONOMOUS_WALK_MIN_MS, AUTONOMOUS_WALK_MAX_MS);
    }

    function scheduleInitialAutonomousWalk() {
      nextAutonomousWalkAt = Date.now() + AUTONOMOUS_WALK_INITIAL_MS;
    }

    function chooseWeightedAction(actions) {
      const totalWeight = actions.reduce((total, action) => total + action.weight, 0);
      let cursor = Math.random() * totalWeight;
      for (const action of actions) {
        cursor -= action.weight;
        if (cursor <= 0) {
          return action;
        }
      }
      return actions[actions.length - 1];
    }

    function playReaction(state, durationMs = CLICK_HOLD_MS) {
      reactionState = resolveAvailableState(state);
      reactionUntil = Date.now() + durationMs;
      autonomousWalkDirection = null;
      autonomousWalkTarget = null;
      scheduleNextAmbientAction();
      scheduleNextAutonomousWalk();
      syncState();
    }

    function freezeOnDefaultState() {
      currentState = resolveAvailableState(DEFAULT_STATE);
      currentFrameIndex = 0;
      clearFrameTimer();
      renderFrame();
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function flushWindowPosition() {
      if (isWindowMoveInFlight || !pendingWindowPosition) return;

      const nextPosition = pendingWindowPosition;
      pendingWindowPosition = null;
      isWindowMoveInFlight = true;

      desktopPet
        .setWindowPosition(nextPosition)
        .catch(() => {})
        .finally(() => {
          isWindowMoveInFlight = false;
          if (pendingWindowPosition) {
            flushWindowPosition();
          }
        });
    }

    function computeAutoState() {
      const now = Date.now();
      const inactiveMs = now - lastInteractionAt;

      if (isDragging && dragOrigin) {
        if (dragDirection === "left") return "running-left";
        if (dragDirection === "right") return "running-right";
        return DEFAULT_STATE;
      }

      if (autonomousWalkDirection && autonomousWalkTarget) {
        return autonomousWalkDirection === "left" ? "running-left" : "running-right";
      }

      if (reactionState && now < reactionUntil) {
        return reactionState;
      }

      if (reactionState && now >= reactionUntil) {
        reactionState = null;
      }

      if (hoverActive) {
        return HOVER_STATE;
      }

      if (inactiveMs >= INACTIVE_HARD_MS) {
        return "failed";
      }

      if (inactiveMs >= INACTIVE_SOFT_MS) {
        return Math.floor(inactiveMs / INACTIVE_SOFT_MS) % 2 === 0 ? "waiting" : "review";
      }

      if (now >= nextAmbientActionAt) {
        const action = chooseWeightedAction(AMBIENT_ACTIONS);
        reactionState = resolveAvailableState(action.state);
        reactionUntil = now + action.durationMs;
        scheduleNextAmbientAction();
        return reactionState;
      }

      return DEFAULT_STATE;
    }

    async function beginAutonomousWalk() {
      if (paused) return;
      if (!autonomousWalkEnabled) return;
      if (autonomousWalkTarget || isDragging || hoverActive || behaviorMode.type === "locked") return;
      if (reactionState && Date.now() < reactionUntil) return;
      if (Date.now() - lastInteractionAt < AUTONOMOUS_WALK_IDLE_GRACE_MS) {
        scheduleNextAutonomousWalk();
        return;
      }

      const environment = await desktopPet.getWindowEnvironment().catch(() => null);
      if (!environment) {
        scheduleNextAutonomousWalk();
        return;
      }

      const { bounds, position, size } = environment;
      const minX = bounds.x;
      const maxX = bounds.x + bounds.width - size.width;
      if (maxX <= minX) {
        scheduleNextAutonomousWalk();
        return;
      }

      if (!autonomousHomePosition) {
        autonomousHomePosition = { x: position.x, y: position.y };
      }

      const homeMinX = clamp(autonomousHomePosition.x - AUTONOMOUS_WALK_HOME_RADIUS, minX, maxX);
      const homeMaxX = clamp(autonomousHomePosition.x + AUTONOMOUS_WALK_HOME_RADIUS, minX, maxX);
      const direction =
        position.x <= homeMinX + AUTONOMOUS_WALK_MIN_DISTANCE
          ? "right"
          : position.x >= homeMaxX - AUTONOMOUS_WALK_MIN_DISTANCE
            ? "left"
            : Math.random() < 0.5
              ? "left"
              : "right";
      const signedDistance =
        (direction === "left" ? -1 : 1) * randomBetween(AUTONOMOUS_WALK_MIN_DISTANCE, AUTONOMOUS_WALK_MAX_DISTANCE);
      const targetX = clamp(position.x + signedDistance, homeMinX, homeMaxX);

      if (Math.abs(targetX - position.x) <= AUTONOMOUS_WALK_STEP_PX) {
        scheduleNextAutonomousWalk();
        return;
      }

      autonomousWalkDirection = targetX < position.x ? "left" : "right";
      autonomousWalkTarget = {
        x: targetX,
        y: clamp(autonomousHomePosition.y, bounds.y, bounds.y + bounds.height - size.height)
      };
      reactionState = null;
      reactionUntil = 0;
      syncState();
    }

    async function stepAutonomousWalk() {
      if (paused) return;
      if (!autonomousWalkTarget || isWindowMoveInFlight) return;

      const position = await desktopPet.getWindowPosition().catch(() => null);
      if (!position) {
        autonomousWalkDirection = null;
        autonomousWalkTarget = null;
        scheduleNextAutonomousWalk();
        syncState();
        return;
      }

      const deltaX = autonomousWalkTarget.x - position.x;
      if (Math.abs(deltaX) <= AUTONOMOUS_WALK_STEP_PX) {
        pendingWindowPosition = { x: autonomousWalkTarget.x, y: autonomousWalkTarget.y, persist: false };
        flushWindowPosition();
        autonomousWalkDirection = null;
        autonomousWalkTarget = null;
        scheduleNextAutonomousWalk();
        syncState();
        return;
      }

      pendingWindowPosition = {
        x: position.x + Math.sign(deltaX) * AUTONOMOUS_WALK_STEP_PX,
        y: autonomousWalkTarget.y,
        persist: false
      };
      flushWindowPosition();
    }

    async function maybeReactToScreenEdge() {
      if (paused || edgeReactionInFlight) return;
      if (isDragging || hoverActive || behaviorMode.type === "locked") return;
      if (autonomousWalkTarget || (reactionState && Date.now() < reactionUntil)) return;
      if (Date.now() - lastEdgeReactionAt < EDGE_REACTION_COOLDOWN_MS) return;

      edgeReactionInFlight = true;
      const environment = await desktopPet.getWindowEnvironment().catch(() => null);
      edgeReactionInFlight = false;
      if (!environment || paused || isDragging) return;

      const { bounds, position, size } = environment;
      const nearLeft = position.x <= bounds.x + EDGE_REACTION_MARGIN_PX;
      const nearRight = position.x + size.width >= bounds.x + bounds.width - EDGE_REACTION_MARGIN_PX;
      const nearTop = position.y <= bounds.y + EDGE_REACTION_MARGIN_PX;
      const nearBottom = position.y + size.height >= bounds.y + bounds.height - EDGE_REACTION_MARGIN_PX;
      if (!nearLeft && !nearRight && !nearTop && !nearBottom) return;

      lastEdgeReactionAt = Date.now();
      playReaction(REACTION_STATES.edge, 1600);
    }

    function resolveDesiredState() {
      if (behaviorMode.type === "locked") {
        return behaviorMode.state;
      }

      return computeAutoState();
    }

    function startAnimation(state, { resetFrame = true } = {}) {
      const resolvedState = resolveAvailableState(state);
      clearFrameTimer();
      currentState = resolvedState;
      if (resetFrame) {
        currentFrameIndex = 0;
      }

      renderFrame();

      const stateConfig = getStateConfig();
      frameTimer = window.setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % stateConfig.frames.length;
        renderFrame();
      }, stateConfig.frameDurationMs);
    }

    function syncState() {
      if (paused) return;
      const desiredState = resolveDesiredState();
      if (desiredState === currentState) return;
      startAnimation(desiredState, { resetFrame: true });
    }

    async function beginDrag(event) {
      if (paused) return;
      if (event.button !== 0) return;
      dragWindowOrigin = await desktopPet.getWindowPosition();
      autonomousHomePosition = null;
      dragOrigin = {
        startScreenX: event.screenX,
        startScreenY: event.screenY,
        lastScreenX: event.screenX,
        lastScreenY: event.screenY
      };
      dragStats = {
        lastMoveAt: Date.now(),
        maxSpeed: 0,
        totalDistance: 0
      };
      isDragging = true;
      dragDirection = null;
      markInteraction();
      syncState();
    }

    function handleDragMove(event) {
      if (paused) return;
      if (!isDragging || !dragOrigin || !dragStats || !dragWindowOrigin) return;

      const stepX = event.screenX - dragOrigin.lastScreenX;
      const stepY = event.screenY - dragOrigin.lastScreenY;
      const now = Date.now();
      const elapsedMs = Math.max(1, now - dragStats.lastMoveAt);
      const stepDistance = Math.hypot(stepX, stepY);
      dragStats.totalDistance += stepDistance;
      dragStats.maxSpeed = Math.max(dragStats.maxSpeed, stepDistance / elapsedMs);
      dragStats.lastMoveAt = now;

      dragOrigin.lastScreenX = event.screenX;
      dragOrigin.lastScreenY = event.screenY;

      const deltaX = event.screenX - dragOrigin.startScreenX;
      const deltaY = event.screenY - dragOrigin.startScreenY;

      if (Math.abs(stepX) >= 2) {
        dragDirection = stepX < 0 ? "left" : "right";
      } else if (!dragDirection && Math.abs(deltaX) >= DIRECTION_THRESHOLD) {
        dragDirection = deltaX < 0 ? "left" : "right";
      }

      pendingWindowPosition = {
        x: dragWindowOrigin.x + deltaX,
        y: dragWindowOrigin.y + deltaY
      };
      flushWindowPosition();

      syncState();
    }

    function endDrag() {
      if (paused) return;
      if (!isDragging) return;
      const completedDragStats = dragStats;
      isDragging = false;
      dragOrigin = null;
      dragStats = null;
      dragWindowOrigin = null;
      dragDirection = null;
      autonomousHomePosition = null;
      markInteraction();

      const isHardDrop =
        completedDragStats.totalDistance >= DRAG_HARD_DROP_DISTANCE ||
        (completedDragStats.totalDistance >= DRAG_HARD_DROP_MIN_SPEED_DISTANCE &&
          completedDragStats.maxSpeed >= DRAG_HARD_DROP_SPEED);

      if (isHardDrop) {
        playReaction(REACTION_STATES.hardDrop, 1800);
        return;
      }

      if (completedDragStats.totalDistance >= DRAG_SOFT_DROP_DISTANCE) {
        playReaction(REACTION_STATES.softDrop, 1800);
        return;
      }

      syncState();
    }

    function handleHoverStart() {
      if (paused) return;
      if (isDragging) return;
      if (reactionState && Date.now() < reactionUntil) return;
      hoverActive = true;
      markInteraction();
      syncState();
    }

    function handleHoverEnd() {
      if (paused) return;
      hoverActive = false;
      markInteraction();
      syncState();
    }

    function handleClick() {
      if (paused) return;
      if (isDragging) return;
      const now = Date.now();
      clickStreak = now - lastClickAt <= CLICK_STREAK_WINDOW_MS ? clickStreak + 1 : 1;
      lastClickAt = now;
      markInteraction();

      if (clickStreak === 1) {
        playReaction(REACTION_STATES.happyClick, CLICK_HOLD_MS);
      } else if (clickStreak === 2) {
        playReaction(REACTION_STATES.repeatedClick, 2200);
      } else if (clickStreak === 3) {
        playReaction(REACTION_STATES.busyClick, 2400);
      } else {
        playReaction(REACTION_STATES.annoyed, 3000);
      }
    }

    function setBehaviorMode(nextMode) {
      behaviorMode = nextMode;
      if (paused) return;
      markInteraction();
      syncState();
    }

    function setAutonomousWalkEnabled(enabled) {
      autonomousWalkEnabled = enabled;
      if (paused) return;
      if (!autonomousWalkEnabled) {
        autonomousWalkDirection = null;
        autonomousWalkTarget = null;
        syncState();
        return;
      }
      scheduleInitialAutonomousWalk();
    }

    function setCharacter(character) {
      currentCharacter = character;
      currentFrameIndex = 0;
      reactionState = null;
      reactionUntil = 0;
      autonomousHomePosition = null;
      autonomousWalkDirection = null;
      autonomousWalkTarget = null;
      if (paused) {
        freezeOnDefaultState();
        return;
      }
      scheduleNextAmbientAction();
      scheduleInitialAutonomousWalk();
      syncState();
    }

    function startIdleWatcher() {
      clearIdleWatcher();
      idleWatcherTimer = window.setInterval(() => {
        if (!autonomousWalkTarget && Date.now() >= nextAutonomousWalkAt) {
          void beginAutonomousWalk();
        }
        void stepAutonomousWalk();
        void maybeReactToScreenEdge();
        syncState();
      }, 250);
    }

    function setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      autonomousWalkDirection = null;
      autonomousWalkTarget = null;
      isDragging = false;
      dragOrigin = null;
      dragStats = null;
      dragWindowOrigin = null;
      dragDirection = null;

      if (paused) {
        clearIdleWatcher();
        freezeOnDefaultState();
        return;
      }

      markInteraction();
      startAnimation(resolveDesiredState(), { resetFrame: false });
      startIdleWatcher();
    }

    function destroy() {
      clearFrameTimer();
      clearIdleWatcher();
      pendingWindowPosition = null;
      edgeReactionInFlight = false;
      autonomousWalkDirection = null;
      autonomousWalkTarget = null;
      isDragging = false;
      dragOrigin = null;
      dragStats = null;
      dragWindowOrigin = null;
    }

    function initialize({ character, initialAutonomousWalkEnabled, initialBehaviorMode, initialPaused }) {
      currentCharacter = character;
      autonomousWalkEnabled = initialAutonomousWalkEnabled ?? true;
      behaviorMode = initialBehaviorMode ?? { type: "auto" };
      paused = initialPaused ?? false;
      scheduleNextAmbientAction();
      scheduleInitialAutonomousWalk();
      if (paused) {
        freezeOnDefaultState();
      } else {
        startAnimation(resolveDesiredState(), { resetFrame: true });
        startIdleWatcher();
      }
    }

    return {
      beginDrag,
      endDrag,
      handleClick,
      handleDragMove,
      handleHoverEnd,
      handleHoverStart,
      initialize,
      destroy,
      setAutonomousWalkEnabled,
      setBehaviorMode,
      setCharacter,
      setPaused
    };
  }

  globalScope.createPetStateMachine = createPetStateMachine;
})(window);
