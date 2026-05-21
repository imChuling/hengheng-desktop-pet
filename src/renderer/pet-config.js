(function attachPetConfig(globalScope) {
  globalScope.PetConfig = {
    HOVER_STATE: "waving",
    CLICK_STATE: "jumping",
    DEFAULT_STATE: "idle",
    INACTIVE_SOFT_MS: 10_000,
    INACTIVE_HARD_MS: 180_000,
    CLICK_HOLD_MS: 2_600,
    CLICK_STREAK_WINDOW_MS: 4_000,
    DRAG_START_THRESHOLD: 6,
    DIRECTION_THRESHOLD: 8,
    AMBIENT_ACTION_MIN_MS: 22_000,
    AMBIENT_ACTION_MAX_MS: 55_000,
    AUTONOMOUS_WALK_MIN_MS: 18_000,
    AUTONOMOUS_WALK_MAX_MS: 35_000,
    AUTONOMOUS_WALK_IDLE_GRACE_MS: 30_000,
    AUTONOMOUS_WALK_INITIAL_MS: 30_000,
    AUTONOMOUS_WALK_STEP_PX: 6,
    AUTONOMOUS_WALK_MIN_DISTANCE: 80,
    AUTONOMOUS_WALK_MAX_DISTANCE: 180,
    AUTONOMOUS_WALK_HOME_RADIUS: 220,
    EDGE_REACTION_MARGIN_PX: 22,
    EDGE_REACTION_COOLDOWN_MS: 18_000,
    DRAG_SOFT_DROP_DISTANCE: 36,
    DRAG_HARD_DROP_DISTANCE: 420,
    DRAG_HARD_DROP_SPEED: 2.4,
    DRAG_HARD_DROP_MIN_SPEED_DISTANCE: 120,
    REACTION_STATES: {
      greet: "waving",
      happyClick: "jumping",
      repeatedClick: "waving",
      busyClick: "running",
      annoyed: "failed",
      softDrop: "jumping",
      hardDrop: "failed",
      edge: "review",
      curious: "review",
      waitingForUser: "waiting",
      selfBusy: "running"
    },
    AMBIENT_ACTIONS: [
      { state: "review", weight: 3, durationMs: 1_600 },
      { state: "waiting", weight: 3, durationMs: 1_800 },
      { state: "waving", weight: 2, durationMs: 1_200 },
      { state: "jumping", weight: 1, durationMs: 1_200 },
      { state: "running", weight: 1, durationMs: 1_600 }
    ],
    SIZE_PRESETS: {
      large: { petWidth: 180, stagePaddingTop: 0, stagePaddingBottom: 10, petOffsetY: -20 },
      default: { petWidth: 115, stagePaddingTop: 0, stagePaddingBottom: 8, petOffsetY: -14 },
      small: { petWidth: 82, stagePaddingTop: 0, stagePaddingBottom: 6, petOffsetY: -10 }
    }
  };
})(window);
