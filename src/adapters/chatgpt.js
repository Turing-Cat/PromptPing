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

const STOP_TEXT_FRAGMENTS = [
  "stop generating",
  "stop responding",
  "停止生成",
  "停止回应",
  "停止回复",
];

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasStructuralStopSignal(button) {
  const identifiers = [
    getAttribute(button, "data-testid"),
    getAttribute(button, "testid"),
    getAttribute(button, "data-test-id"),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return identifiers.some((value) => value.includes("stop"));
}

function hasLocalizedStopText(button) {
  const text = normalizeText(getAccessibleText(button));
  return STOP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
}

function hasStopControl(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
    // Prefer stable structure markers so localized UI text does not break notifications.
    if (hasStructuralStopSignal(button)) {
      return true;
    }

    return hasLocalizedStopText(button);
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
