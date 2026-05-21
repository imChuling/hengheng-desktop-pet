const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { CSP_POLICY, isAllowedAppUrl } = require("../src/main/security");

const ROOT = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("renderer and manager pages declare a restrictive local CSP", () => {
  for (const htmlPath of ["src/renderer/index.html", "src/manager/index.html"]) {
    const html = readProjectFile(htmlPath);
    assert.match(html, /http-equiv="Content-Security-Policy"/u);
    assert.match(html, /default-src 'self'/u);
    assert.match(html, /script-src 'self'/u);
    assert.match(html, /connect-src 'none'/u);
    assert.match(html, /object-src 'none'/u);
    assert.match(html, /frame-src 'none'/u);
    assert.match(html, /worker-src 'none'/u);
  }
});

test("browser windows block external navigation and new windows", () => {
  const windowServiceSource = readProjectFile("src/main/window-service.js");
  assert.match(windowServiceSource, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/u);
  assert.match(windowServiceSource, /will-navigate/u);
  assert.match(windowServiceSource, /will-frame-navigate/u);
  assert.match(windowServiceSource, /will-redirect/u);
  assert.match(windowServiceSource, /isAllowedAppUrl/u);
  assert.match(windowServiceSource, /event\.preventDefault\(\)/u);
});

test("main process installs session-level CSP and denies permission prompts", () => {
  const mainSource = readProjectFile("src/main.js");
  const securitySource = readProjectFile("src/main/security.js");
  assert.match(mainSource, /configureSessionSecurity\(session\.defaultSession\)/u);
  assert.match(securitySource, /setPermissionRequestHandler/u);
  assert.match(securitySource, /callback\(false\)/u);
  assert.match(securitySource, /onHeadersReceived/u);
  assert.match(securitySource, /Content-Security-Policy/u);
  assert.match(CSP_POLICY, /connect-src 'none'/u);
  assert.match(CSP_POLICY, /frame-src 'none'/u);
});

test("main process IPC handlers require trusted window senders", () => {
  const controllerSource = readProjectFile("src/main/app-controller.js");
  const windowServiceSource = readProjectFile("src/main/window-service.js");
  assert.match(controllerSource, /function assertTrustedIpcSender/u);
  assert.match(controllerSource, /windowService\.isTrustedSender\(\{ webContents: event\.sender, frameUrl: event\.senderFrame\?\.url \}\)/u);
  assert.match(controllerSource, /trustedIpcHandler/u);
  assert.match(controllerSource, /trustedIpcListener/u);
  assert.match(windowServiceSource, /allowedUrlsByWebContents/u);
  assert.match(windowServiceSource, /isKnownWindowWebContents/u);
  assert.match(windowServiceSource, /isAllowedAppUrl\(frameUrl/u);
});

test("navigation allowlist accepts only registered local app pages", () => {
  const allowedUrls = new Set(["file:///Applications/DesktopPet/src/renderer/index.html"]);

  assert.equal(isAllowedAppUrl("file:///Applications/DesktopPet/src/renderer/index.html", allowedUrls), true);
  assert.equal(isAllowedAppUrl("file:///Applications/DesktopPet/src/renderer/index.html#state", allowedUrls), true);
  assert.equal(isAllowedAppUrl("https://example.com", allowedUrls), false);
  assert.equal(isAllowedAppUrl("file:///Applications/DesktopPet/src/manager/index.html", allowedUrls), false);
  assert.equal(isAllowedAppUrl("not a url", allowedUrls), false);
});
