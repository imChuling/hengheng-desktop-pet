(function attachPetListView(globalScope) {
  function createPetListView({ formatText, getText, stateLabel }) {
    function sourceLabel(source) {
      return getText().source[source] ?? source;
    }

    function friendlyIssue(issue) {
      const text = getText();
      if (issue === "Missing manifest.json") return text.issueMissingManifest;
      if (issue.startsWith("Invalid manifest.json")) {
        return `${text.issueInvalidManifest}: ${issue.split(":").slice(1).join(":").trim()}`;
      }
      if (issue === "Missing icon.png") return text.issueMissingIcon;
      if (issue === "Missing frames/idle PNG frames") return text.issueMissingIdle;

      const fallbackMatch = /^(.+) falls back to idle$/u.exec(issue);
      if (fallbackMatch) {
        return formatText(text.issueFallback, { state: stateLabel(fallbackMatch[1]) });
      }

      return issue;
    }

    function healthSummary(character) {
      const text = getText();
      if (!character.valid) {
        const issue = character.issues.find((candidate) => candidate.includes("idle")) ?? character.issues[0];
        return {
          label: text.needsAttention,
          detail: issue ? friendlyIssue(issue) : text.requiredFilesMissing
        };
      }

      const fallbackCount = character.states.filter((state) => state.status === "fallback").length;
      if (fallbackCount > 0) {
        return {
          label: text.ready,
          detail: formatText(text.fallbackDetail, {
            count: fallbackCount,
            plural: fallbackCount === 1 ? "" : "s"
          })
        };
      }

      if (!character.icon) {
        return {
          label: text.ready,
          detail: text.iconMissing
        };
      }

      return {
        label: text.ready,
        detail: text.allCoreReady
      };
    }

    return {
      friendlyIssue,
      healthSummary,
      sourceLabel
    };
  }

  const api = { createPetListView };
  globalScope.ManagerPetListView = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
