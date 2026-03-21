import {
  findAllElements,
  getAccessibleText,
  getAttribute,
  getTextContent,
} from "../core/snapshot.js";
import {
  createConversation,
  findMessages,
  findTitle,
  fingerprintLatestAssistant,
} from "./shared.js";

function hasRoleToken(value, token) {
  return String(value ?? "")
    .toLowerCase()
    .split(/\s+/)
    .includes(token);
}

function resolveRole(node) {
  const attrCandidates = [
    getAttribute(node, "data-role"),
    getAttribute(node, "data-message-role"),
    getAttribute(node, "role"),
    getAttribute(node, "data-testid"),
  ];

  for (const candidate of attrCandidates) {
    if (hasRoleToken(candidate, "user")) {
      return "user";
    }
    if (hasRoleToken(candidate, "assistant")) {
      return "assistant";
    }
  }

  const classNames = (node.classList ?? []).join(" ").toLowerCase();
  if (classNames.includes("assistant")) {
    return "assistant";
  }
  if (classNames.includes("user")) {
    return "user";
  }

  return null;
}

function hasStopControl(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
    const text = getAccessibleText(button).toLowerCase();
    return text.includes("stop generating") || text.includes("stop response");
  });
}

export const DeepSeekAdapter = {
  matchesLocation(url) {
    return /https:\/\/(chat\.deepseek\.com|www\.deepseek\.com)\//i.test(url);
  },

  getSiteName() {
    return "DeepSeek";
  },

  extractConversation(snapshot, pageTitle = "DeepSeek") {
    const conversation = createConversation(
      "DeepSeek",
      findTitle(snapshot, pageTitle),
      findMessages(snapshot, resolveRole),
    );

    if (conversation.messages.length > 0) {
      return conversation;
    }

    const messageNodes = findAllElements(snapshot, (node) => {
      const classNames = (node.classList ?? []).join(" ").toLowerCase();
      return classNames.includes("message") || classNames.includes("markdown");
    });

    const messages = messageNodes
      .map((node) => {
        const text = getTextContent(node).toLowerCase();
        if (!text) {
          return null;
        }

        return {
          role: text.includes("assistant") ? "assistant" : "user",
          blocks: [{ type: "paragraph", text: getTextContent(node) }],
        };
      })
      .filter(Boolean);

    return createConversation("DeepSeek", findTitle(snapshot, pageTitle), messages);
  },

  isGenerating(snapshot) {
    return hasStopControl(snapshot);
  },

  getLatestAssistantFingerprint(snapshot, pageTitle = "DeepSeek") {
    return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
  },
};

