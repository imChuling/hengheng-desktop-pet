#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_FONT = path.join(ROOT, "assets", "fonts", "LXGWWenKai-Regular.ttf");
const OUTPUT_FONT = path.join(ROOT, "assets", "fonts", "LXGWWenKai-UI-Subset.woff2");
const I18N_FILE = path.join(ROOT, "src", "manager", "i18n.js");

const COMMON_SIMPLIFIED_CHINESE =
  "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候亲毛快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严龙飞";
const PUNCTUATION_AND_ASCII =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,:;!?+-_/\\'\"()[]{}<>%&@#~`|=*$，。！？：；、“”‘’（）《》【】·…";

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

function loadChineseUiText() {
  const { UI_TEXT } = require(I18N_FILE);
  return collectStrings(UI_TEXT["zh-CN"]).join("");
}

function uniqueCharacters(text) {
  return Array.from(new Set([...text])).join("");
}

function runSubset(inputFile) {
  const result = spawnSync(
    "pyftsubset",
    [
      SOURCE_FONT,
      `--text-file=${inputFile}`,
      `--output-file=${OUTPUT_FONT}`,
      "--flavor=woff2",
      "--layout-features=*",
      "--glyph-names",
      "--symbol-cmap",
      "--legacy-cmap",
      "--notdef-glyph",
      "--notdef-outline",
      "--recommended-glyphs",
      "--name-IDs=*",
      "--name-legacy",
      "--name-languages=*",
      "--drop-tables+=DSIG"
    ],
    {
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "pyftsubset failed.\n");
    process.exit(result.status || 1);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  if (!fs.existsSync(SOURCE_FONT)) {
    console.error(`Missing source font: ${path.relative(ROOT, SOURCE_FONT)}`);
    process.exit(1);
  }

  const text = uniqueCharacters(loadChineseUiText() + COMMON_SIMPLIFIED_CHINESE + PUNCTUATION_AND_ASCII);
  const tempFile = path.join(os.tmpdir(), `desktop-pet-font-subset-${process.pid}.txt`);
  fs.writeFileSync(tempFile, text, "utf8");
  try {
    runSubset(tempFile);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }

  const sourceSize = fs.statSync(SOURCE_FONT).size;
  const outputSize = fs.statSync(OUTPUT_FONT).size;
  console.log(
    `[font-subset] Wrote ${path.relative(ROOT, OUTPUT_FONT)} (${formatBytes(outputSize)} from ${formatBytes(sourceSize)}, ${text.length} chars).`
  );
}

main();
