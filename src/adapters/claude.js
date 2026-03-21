import {
  findAllElements,
  getAttribute,
  getTextContent,
  hasClass,
} from "../core/snapshot.js";
import {
  createConversation,
  findMessages,
  findTitle,
  fingerprintLatestAssistant,
} from "./shared.js";

function resolveRole(node) {
  const testId = getAttribute(node, "data-testid");
  if (testId?.startsWith("user-message")) {
    return "user";
  }

  if (testId?.startsWith("assistant-message") || hasClass(node, "font-claude-response")) {
    return "assistant";
  }

  return null;
}

function hasStopControl(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
    const text = getTextContent(button).toLowerCase();
    return text.includes("stop response") || text.includes("stop responding");
  });
}

export const ClaudeAdapter = {
  matchesLocation(url) {
    return /https:\/\/claude\.ai\//i.test(url);
  },

  getSiteName() {
    return "Claude";
  },

  extractConversation(snapshot, pageTitle = "Claude") {
    return createConversation(
      "Claude",
      findTitle(snapshot, pageTitle),
      findMessages(snapshot, resolveRole),
    );
  },

  isGenerating(snapshot) {
    return hasStopControl(snapshot);
  },

  getLatestAssistantFingerprint(snapshot, pageTitle = "Claude") {
    return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
  },
};

