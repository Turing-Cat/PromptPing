import {
  findAllElements,
  getAccessibleText,
  getAttribute,
} from "../core/snapshot.js";
import {
  createConversation,
  findMessages,
  findTitle,
  fingerprintLatestAssistant,
} from "./shared.js";

function resolveRole(node) {
  const role = getAttribute(node, "data-message-author-role");
  return role === "user" || role === "assistant" ? role : null;
}

function hasStopControl(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
    const text = getAccessibleText(button).toLowerCase();
    return text.includes("stop generating") || text.includes("stop responding");
  });
}

export const ChatGPTAdapter = {
  matchesLocation(url) {
    return /https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(url);
  },

  getSiteName() {
    return "ChatGPT";
  },

  extractConversation(snapshot, pageTitle = "ChatGPT") {
    return createConversation(
      "ChatGPT",
      findTitle(snapshot, pageTitle),
      findMessages(snapshot, resolveRole),
    );
  },

  isGenerating(snapshot) {
    return hasStopControl(snapshot);
  },

  getLatestAssistantFingerprint(snapshot, pageTitle = "ChatGPT") {
    return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
  },
};
