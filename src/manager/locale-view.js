(function attachLocaleView(globalScope) {
  const CODE_TAG_PATTERN = /<code>(.*?)<\/code>/giu;
  const HTML_ENTITIES = {
    amp: "&",
    gt: ">",
    lt: "<",
    quot: '"',
    "#39": "'"
  };

  function decodeHtmlEntities(value) {
    return value.replace(/&([a-zA-Z0-9#]+);/gu, (match, entity) => HTML_ENTITIES[entity] ?? match);
  }

  function appendTextNode(document, nodes, value) {
    if (!value) return;
    nodes.push(document.createTextNode(decodeHtmlEntities(value)));
  }

  function createCodeNode(document, value) {
    const code = document.createElement("code");
    code.textContent = decodeHtmlEntities(value);
    return code;
  }

  function renderWhitelistedHtml(element, html) {
    const document = element.ownerDocument;
    const nodes = [];
    let cursor = 0;

    for (const match of html.matchAll(CODE_TAG_PATTERN)) {
      appendTextNode(document, nodes, html.slice(cursor, match.index));
      nodes.push(createCodeNode(document, match[1]));
      cursor = match.index + match[0].length;
    }

    appendTextNode(document, nodes, html.slice(cursor));
    element.replaceChildren(...nodes);
  }

  function applyTextBindings(root, text) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (typeof text[key] === "string") {
        element.textContent = text[key];
      }
    });

    root.querySelectorAll("[data-i18n-html]").forEach((element) => {
      const key = element.dataset.i18nHtml;
      if (typeof text[key] === "string") {
        renderWhitelistedHtml(element, text[key]);
      }
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      if (typeof text[key] === "string") {
        element.placeholder = text[key];
      }
    });

    root.querySelectorAll("[data-i18n-option]").forEach((element) => {
      const key = element.dataset.i18nOption;
      if (typeof text[key] === "string") {
        element.textContent = text[key];
      }
    });
  }

  function createLocaleView({ document, getText, onApplyDynamicLanguage }) {
    function applyLanguage(language) {
      const text = getText();
      document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
      document.title = text.appTitle;
      applyTextBindings(document, text);
      onApplyDynamicLanguage?.(text);
    }

    return {
      applyLanguage
    };
  }

  const api = { applyTextBindings, createLocaleView, renderWhitelistedHtml };
  globalScope.ManagerLocaleView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
