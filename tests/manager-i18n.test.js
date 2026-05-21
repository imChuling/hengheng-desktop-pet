const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { UI_TEXT } = require("../src/manager/i18n");

test("Manager Chinese copy uses product wording for import and file checks", () => {
  const text = UI_TEXT["zh-CN"];

  assert.equal(text.library, "主页");
  assert.equal(text.importPet, "导入宠物");
  assert.equal(text.spritesheet, "动画图集（spritesheet）");
  assert.equal(text.resourceCheck, "文件检查");
  assert.equal(text.coreAnimation, "基础动作");
  assert.equal(text.optionalAnimations, "其他动作");
  assert.match(text.codexFormatDetail, /9 组动作/u);
  assert.doesNotMatch(text.resourceCheck, /资源/u);
  assert.doesNotMatch(text.coreAnimation, /核心动画/u);
  assert.doesNotMatch(text.optionalAnimations, /可选动画/u);
});

test("Manager language table has matching navigation and product keys for English and Chinese", () => {
  for (const key of [
    "settings",
    "help",
    "feedback",
    "importPet",
    "library",
    "pets",
    "fileReady",
    "wrongSize",
    "startHere",
    "releaseInfo",
    "versionLine",
    "importRecoveryTitle",
    "chooseAnotherFile"
  ]) {
    assert.equal(typeof UI_TEXT.en[key], "string");
    assert.equal(typeof UI_TEXT["zh-CN"][key], "string");
    assert.notEqual(UI_TEXT.en[key], "");
    assert.notEqual(UI_TEXT["zh-CN"][key], "");
  }
  assert.deepEqual(Object.keys(UI_TEXT.en.onboardingSteps), Object.keys(UI_TEXT["zh-CN"].onboardingSteps));
});

test("Manager page loads locale view before manager bootstrap", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "src", "manager", "index.html"), "utf8");
  assert.match(html, /<script src="\.\/locale-view\.js"><\/script>[\s\S]*<script src="\.\/manager\.js"><\/script>/u);
  assert.match(html, /<script src="\.\/preview-view\.js"><\/script>[\s\S]*<script src="\.\/manager\.js"><\/script>/u);
});
