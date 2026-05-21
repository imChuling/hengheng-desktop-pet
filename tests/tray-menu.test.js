const assert = require("node:assert/strict");
const test = require("node:test");

const { buildTrayMenuTemplate } = require("../src/main/tray-menu");

function noop() {}

function buildTemplate(language, overrides = {}) {
  return buildTrayMenuTemplate({
    behaviorMode: { type: "auto" },
    behaviorMenuStates: ["idle", "running-right"],
    autonomousWalkEnabled: true,
    mainWindow: { isVisible: () => true, isAlwaysOnTop: () => true },
    onCharacterSelect: noop,
    onManageCharacters: noop,
    onLockBehavior: noop,
    onResetPosition: noop,
    onSetAutoBehavior: noop,
    onSetSizeMode: noop,
    onToggleLaunchAtLogin: noop,
    onTogglePetPaused: noop,
    onTogglePetVisibility: noop,
    onToggleAutonomousWalk: noop,
    onToggleAlwaysOnTop: noop,
    onQuit: noop,
    readCharacters: () => [{ id: "lcl2", name: "LCL2" }],
    language,
    launchAtLogin: false,
    petPaused: false,
    selectedCharacterId: "lcl2",
    sizeMode: "default",
    ...overrides
  });
}

test("tray menu uses Chinese labels when language is zh-CN", () => {
  const template = buildTemplate("zh-CN");

  assert.equal(template[0].label, "宠物");
  assert.equal(template[0].submenu[0].label, "管理宠物");
  assert.equal(template[2].label, "隐藏宠物");
  assert.equal(template[4].label, "暂停宠物");
  assert.equal(template.find((item) => item.label === "行为").submenu[3].label, "向右走");
  assert.equal(template.find((item) => item.label === "自动移动").toolTip, "仅在行为为默认时生效。");
});

test("tray menu switches pause and visibility labels from runtime state", () => {
  const template = buildTemplate("zh-CN", {
    mainWindow: { isVisible: () => false, isAlwaysOnTop: () => true },
    petPaused: true
  });

  assert.equal(template[2].label, "显示宠物");
  assert.equal(template[4].label, "恢复宠物");
});
