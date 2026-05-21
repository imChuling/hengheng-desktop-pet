(function attachAppError(globalScope) {
  const ERROR_PREFIX = "DESKTOP_PET_ERROR:";

  function normalizeDetails(details) {
    return details && typeof details === "object" && !Array.isArray(details) ? details : {};
  }

  function encodeAppError(code, details = {}) {
    return `${ERROR_PREFIX}${JSON.stringify({ code, details: normalizeDetails(details) })}`;
  }

  function createAppError(code, details = {}) {
    const error = new Error(encodeAppError(code, details));
    error.code = code;
    error.details = normalizeDetails(details);
    return error;
  }

  function parseAppError(error) {
    if (!error) return null;
    const message = typeof error === "string" ? error : error.message;
    if (typeof message !== "string" || !message.startsWith(ERROR_PREFIX)) {
      return null;
    }

    try {
      const payload = JSON.parse(message.slice(ERROR_PREFIX.length));
      if (!payload || typeof payload.code !== "string" || !payload.code) {
        return null;
      }
      return {
        code: payload.code,
        details: normalizeDetails(payload.details)
      };
    } catch (_error) {
      return null;
    }
  }

  const api = {
    ERROR_PREFIX,
    createAppError,
    encodeAppError,
    parseAppError
  };

  globalScope.DesktopPetErrors = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
