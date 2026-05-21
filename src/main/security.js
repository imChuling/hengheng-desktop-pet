const { pathToFileURL } = require("node:url");

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' file: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "media-src 'none'",
  "worker-src 'none'"
].join("; ");

function filePathToUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function normalizeUrlForNavigation(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.href;
  } catch (_error) {
    return "";
  }
}

function isAllowedAppUrl(rawUrl, allowedUrls) {
  const normalizedUrl = normalizeUrlForNavigation(rawUrl);
  return Boolean(normalizedUrl && allowedUrls.has(normalizedUrl));
}

function configureSessionSecurity(electronSession) {
  electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  electronSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP_POLICY]
      }
    });
  });
}

module.exports = {
  CSP_POLICY,
  configureSessionSecurity,
  filePathToUrl,
  isAllowedAppUrl
};
