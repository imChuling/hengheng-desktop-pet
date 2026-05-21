const assert = require("node:assert/strict");
const test = require("node:test");

const { applyTextBindings, renderWhitelistedHtml } = require("../src/manager/locale-view");

function serializeNode(node) {
  if (node.nodeType === "text") return node.textContent;
  return `<${node.tagName}>${node.textContent}</${node.tagName}>`;
}

function createDocument() {
  return {
    createElement(tagName) {
      return {
        nodeType: "element",
        tagName,
        textContent: ""
      };
    },
    createTextNode(textContent) {
      return {
        nodeType: "text",
        textContent
      };
    }
  };
}

function createElement(dataset = {}) {
  const ownerDocument = createDocument();
  return {
    dataset,
    childNodes: [],
    placeholder: "",
    textContent: "",
    ownerDocument,
    replaceChildren(...nodes) {
      this.childNodes = nodes;
    }
  };
}

test("locale view applies text, html, placeholder, and option bindings declaratively", () => {
  const textElement = createElement({ i18n: "appTitle" });
  const htmlElement = createElement({ i18nHtml: "codexFormatDetail" });
  const placeholderElement = createElement({ i18nPlaceholder: "noWebp" });
  const optionElement = createElement({ i18nOption: "englishOption" });
  const root = {
    querySelectorAll(selector) {
      return {
        "[data-i18n]": [textElement],
        "[data-i18n-html]": [htmlElement],
        "[data-i18n-placeholder]": [placeholderElement],
        "[data-i18n-option]": [optionElement]
      }[selector] ?? [];
    }
  };

  applyTextBindings(root, {
    appTitle: "Desktop Pet",
    codexFormatDetail: "Use <code>spritesheet.webp</code>.",
    englishOption: "English",
    noWebp: "No .webp selected"
  });

  assert.equal(textElement.textContent, "Desktop Pet");
  assert.equal(htmlElement.childNodes.map(serializeNode).join(""), "Use <code>spritesheet.webp</code>.");
  assert.equal(placeholderElement.placeholder, "No .webp selected");
  assert.equal(optionElement.textContent, "English");
});

test("locale html binding only renders whitelisted code tags", () => {
  const element = createElement();

  renderWhitelistedHtml(
    element,
    'Use <code>spritesheet.webp</code> and ignore <img src=x onerror=alert(1)> &lt;pet&gt;.'
  );

  assert.equal(
    element.childNodes.map(serializeNode).join(""),
    "Use <code>spritesheet.webp</code> and ignore <img src=x onerror=alert(1)> <pet>."
  );
});
