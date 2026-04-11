import {
  findAllElements,
  findFirstElement,
  getAccessibleText,
  getAttribute,
  getTextContent,
} from "../core/snapshot.js";
import {
  createConversation,
  extractBlocks,
  findTitle,
  fingerprintLatestAssistant,
} from "./shared.js";
import { transitionGeminiCompletionState } from "../content/gemini-completion-tracker.js";

const STOP_TEXT_FRAGMENTS = [
  "stop generating",
  "stop response",
  "stop responding",
  "停止生成",
  "停止回复",
  "停止回答",
];

const TYPING_TEXT_FRAGMENTS = [
  "gemini is typing",
  "gemini 正在输入",
];

const GENERIC_TITLES = new Set([
  "gemini",
  "google gemini",
  "chat with gemini",
  "与 gemini 对话",
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasKeywordToken(value, keywords) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((token) => keywords.includes(token));
}

function getClassTokens(node) {
  return [
    ...(node.classList ?? []),
    ...String(getAttribute(node, "class") ?? "")
      .split(/\s+/)
      .filter(Boolean),
  ];
}

function hasClassToken(node, token) {
  return getClassTokens(node)
    .map((entry) => entry.toLowerCase())
    .includes(token.toLowerCase());
}

function hasAssistantRole(node) {
  const roleCandidates = [
    getAttribute(node, "data-response-role"),
    getAttribute(node, "data-message-role"),
    getAttribute(node, "data-role"),
    getAttribute(node, "role"),
    getAttribute(node, "aria-label"),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return roleCandidates.some(
    (value) =>
      value.includes("model") ||
      value.includes("assistant") ||
      value.includes("response"),
  );
}

function isAssistantContainer(node) {
  return (
    node?.tagName === "model-response" ||
    node?.tagName === "assistant-messages-primary" ||
    hasClassToken(node, "model-response") ||
    hasClassToken(node, "assistant-messages-primary-container") ||
    hasAssistantRole(node)
  );
}

function findMessageContentNode(node) {
  return (
    findFirstElement(
      node,
      (entry) =>
        entry.tagName === "message-content" ||
        entry.tagName === "assistant-messages-primary" ||
        hasClassToken(entry, "response-content") ||
        hasClassToken(entry, "model-response-text") ||
        hasClassToken(entry, "message-text"),
    ) ?? node
  );
}

function findGeminiMessages(snapshot) {
  const assistantNodes = findGeminiAssistantNodes(snapshot);

  const messages = assistantNodes.map((node) => ({
    role: "assistant",
    blocks: extractBlocks(findMessageContentNode(node)),
  }));

  if (messages.length > 0) {
    return messages;
  }

  return findAllElements(
    snapshot,
    (node) =>
      node.tagName === "message-content" ||
      node.tagName === "assistant-messages-primary" ||
      hasClassToken(node, "response-content") ||
      hasClassToken(node, "model-response-text") ||
      hasClassToken(node, "message-text") ||
      hasClassToken(node, "assistant-messages-primary-container"),
    { stopOnMatch: true },
  ).map((node) => ({
    role: "assistant",
    blocks: extractBlocks(node),
  }));
}

function findGeminiAssistantNodes(snapshot) {
  const assistantNodes = findAllElements(snapshot, (node) => isAssistantContainer(node), {
    stopOnMatch: true,
  });

  if (assistantNodes.length > 0) {
    return assistantNodes;
  }

  return findAllElements(
    snapshot,
    (node) =>
      node.tagName === "message-content" ||
      node.tagName === "assistant-messages-primary" ||
      hasClassToken(node, "response-content") ||
      hasClassToken(node, "model-response-text") ||
      hasClassToken(node, "message-text") ||
      hasClassToken(node, "assistant-messages-primary-container"),
    { stopOnMatch: true },
  );
}

function hasStructuralStopSignal(button) {
  const identifiers = [
    getAttribute(button, "data-testid"),
    getAttribute(button, "testid"),
    getAttribute(button, "data-test-id"),
    getAttribute(button, "id"),
  ].filter(Boolean);

  return identifiers.some((value) => hasKeywordToken(value, ["stop", "abort", "cancel"]));
}

function hasLocalizedStopText(button) {
  const text = normalizeText(getAccessibleText(button));
  return STOP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
}

function hasLiveStopButtonState(button) {
  return hasClassToken(button, "send-button") && hasClassToken(button, "stop");
}

function hasTypingStatus(snapshot) {
  const text = normalizeText(getTextContent(snapshot));
  return TYPING_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
}

function hasStopControl(snapshot) {
  return findAllElements(
    snapshot,
    (node) => node.tagName === "button" || getAttribute(node, "role") === "button",
  ).some(
    (button) =>
      hasStructuralStopSignal(button) ||
      hasLocalizedStopText(button) ||
      hasLiveStopButtonState(button),
  );
}

function findUserQueryNodes(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "user-query", {
    stopOnMatch: true,
  });
}

function extractUserPromptText(node) {
  const paragraphTexts = findAllElements(node, (entry) => entry.tagName === "p", {
    stopOnMatch: true,
  })
    .map((entry) => getTextContent(entry))
    .filter(Boolean);

  if (paragraphTexts.length > 0) {
    return paragraphTexts[paragraphTexts.length - 1];
  }

  return getTextContent(node).replace(/^(你说|you said)\s*/i, "").trim();
}

function findLatestUserPrompt(snapshot) {
  const userQueries = findUserQueryNodes(snapshot);
  if (userQueries.length === 0) {
    return null;
  }

  return extractUserPromptText(userQueries[userQueries.length - 1]);
}

function findGeminiTitle(snapshot, pageTitle) {
  const title = findTitle(snapshot, pageTitle);
  const normalizedTitle = normalizeText(title);
  const latestPrompt = findLatestUserPrompt(snapshot);

  if (latestPrompt && GENERIC_TITLES.has(normalizedTitle)) {
    return latestPrompt;
  }

  return title;
}

export const GeminiAdapter = {
  matchesLocation(url) {
    return /https:\/\/gemini\.google\.com\//i.test(url);
  },

  getSiteName() {
    return "Gemini";
  },

  supportsExport() {
    return false;
  },

  extractConversation(snapshot, pageTitle = "Gemini") {
    return createConversation("Gemini", findGeminiTitle(snapshot, pageTitle), findGeminiMessages(snapshot));
  },

  isGenerating(snapshot, options = {}) {
    if (options.networkGenerationActive) {
      return true;
    }

    if (options.networkGenerationIdleOverrideActive) {
      return false;
    }

    return (
      hasStopControl(snapshot) ||
      hasTypingStatus(snapshot)
    );
  },

  getLatestAssistantFingerprint(snapshot, pageTitle = "Gemini") {
    return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
  },

  getCompletionStateInput(snapshot, pageTitle = "Gemini", options = {}) {
    return {
      isGenerating: this.isGenerating(snapshot, options),
      latestFingerprint: this.getLatestAssistantFingerprint(snapshot, pageTitle, options),
      latestUserTurnMarker: this.getLatestAssistantMarker(snapshot, pageTitle, options),
      userTurnCount: findUserQueryNodes(snapshot).length,
      assistantTurnCount: findGeminiAssistantNodes(snapshot).length,
    };
  },

  transitionCompletionState(previousState, currentState) {
    return transitionGeminiCompletionState(previousState, currentState);
  },

  getLatestAssistantMarker(snapshot) {
    const latestPrompt = findLatestUserPrompt(snapshot);
    if (!latestPrompt) {
      return null;
    }

    return `${findUserQueryNodes(snapshot).length}:${latestPrompt}`;
  },
};
