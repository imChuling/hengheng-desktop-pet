const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createCharacterService } = require("../src/main/character-service");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "desktop-pet-test-"));
}

function writeCharacter(root, id, { states = ["idle"], icon = true } = {}) {
  const characterDir = path.join(root, id);
  fs.mkdirSync(characterDir, { recursive: true });
  fs.writeFileSync(
    path.join(characterDir, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      id,
      name: id,
      frameSize: { width: 192, height: 208 },
      states: {}
    })}\n`,
    "utf8"
  );
  if (icon) {
    fs.writeFileSync(path.join(characterDir, "icon.png"), "icon");
  }
  for (const state of states) {
    const stateDir = path.join(characterDir, "frames", state);
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, "00.png"), state);
  }
}

test("listCharacterDetails lightweight data includes fallback state status", () => {
  const userData = makeTempDir();
  const builtInCharactersRoot = makeTempDir();
  writeCharacter(builtInCharactersRoot, "fallback-pet", { states: ["idle"] });

  const service = createCharacterService({
    app: {
      getPath(name) {
        assert.equal(name, "userData");
        return userData;
      }
    },
    builtInCharactersRoot
  });

  const [character] = service.listCharacterDetails();
  assert.equal(character.id, "fallback-pet");
  assert.equal(character.valid, true);
  assert.equal(character.states.find((state) => state.name === "idle").status, "ok");
  assert.equal(character.states.find((state) => state.name === "running-left").status, "fallback");
  assert.equal(character.states.find((state) => state.name === "running-left").frameCount, 0);
  assert.deepEqual(character.states.find((state) => state.name === "running-left").frames, []);
});

test("deleted selected imported pet falls back to a built-in pet", () => {
  const userData = makeTempDir();
  const builtInCharactersRoot = makeTempDir();
  const userCharactersRoot = path.join(userData, "characters");
  writeCharacter(builtInCharactersRoot, "builtin-pet", { states: ["idle"] });
  writeCharacter(userCharactersRoot, "imported-pet", { states: ["idle"] });

  const service = createCharacterService({
    app: {
      getPath(name) {
        assert.equal(name, "userData");
        return userData;
      }
    },
    builtInCharactersRoot
  });

  service.deleteImportedPet("imported-pet");
  const config = service.loadConfig({
    selectedCharacterId: "imported-pet",
    behaviorMode: { type: "auto" },
    sizeMode: "default"
  });

  assert.equal(config.selectedCharacterId, "builtin-pet");
  assert.deepEqual(config.characters.map((character) => character.id), ["builtin-pet"]);
});
