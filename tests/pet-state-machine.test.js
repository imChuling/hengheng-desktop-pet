const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadStateMachine() {
  const window = {
    setInterval: () => 1,
    clearInterval: () => {}
  };
  const context = vm.createContext({ window, Date, Math });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "pet-config.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "pet-state-machine.js"), "utf8"), context);
  return window.createPetStateMachine;
}

function makeCharacter() {
  const stateNames = ["idle", "jumping", "waving", "failed", "running", "review", "waiting", "running-left", "running-right"];
  return {
    states: Object.fromEntries(
      stateNames.map((state) => [
        state,
        {
          frames: [`${state}-0.png`, `${state}-1.png`],
          frameDurationMs: 100
        }
      ])
    )
  };
}

test("pet state machine ignores interactions while paused and resumes afterwards", () => {
  const createPetStateMachine = loadStateMachine();
  const frames = [];
  const stateMachine = createPetStateMachine({
    desktopPet: {
      getWindowEnvironment: async () => null,
      getWindowPosition: async () => ({ x: 0, y: 0 }),
      setWindowPosition: async () => {}
    },
    onFrame: (frame) => frames.push(frame)
  });

  stateMachine.initialize({
    character: makeCharacter(),
    initialAutonomousWalkEnabled: false,
    initialBehaviorMode: { type: "auto" },
    initialPaused: false
  });
  assert.equal(frames.at(-1), "idle-0.png");

  stateMachine.setPaused(true);
  const frameCountAfterPause = frames.length;
  stateMachine.handleClick();
  assert.equal(frames.length, frameCountAfterPause);

  stateMachine.setPaused(false);
  stateMachine.handleClick();
  assert.match(frames.at(-1), /jumping|waving/u);
});
