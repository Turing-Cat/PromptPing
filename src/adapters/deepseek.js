import {
  findAllElements,
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

const USER_MESSAGE_CLASSES = ["_9663006"];
const USER_CONTENT_CLASSES = ["fbb737a4"];
const ASSISTANT_MESSAGE_CLASSES = ["_4f9bf79"];
const ASSISTANT_CONTENT_CLASSES = ["ds-markdown"];
const BUTTON_CLASS_NAMES = ["ds-icon-button"];

function getClassTokens(node) {
  return [
    ...(node.classList ?? []),
    ...String(getAttribute(node, "class") ?? "")
      .split(/\s+/)
      .filter(Boolean),
  ];
}

function hasClassToken(node, token) {
  return getClassTokens(node).includes(token);
}

function hasRoleToken(value, token) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .includes(token);
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

const STOP_TEXT_FRAGMENTS = [
  "stop generating",
  "stop response",
  "stop responding",
  "停止生成",
  "停止回复",
  "停止回答",
];

function hasStructuralStopSignal(button) {
  const identifiers = [
    getAttribute(button, "data-testid"),
    getAttribute(button, "testid"),
    getAttribute(button, "data-test-id"),
    getAttribute(button, "id"),
  ]
    .map(normalizeText)
    .filter(Boolean);

  return identifiers.some(
    (value) => value.includes("stop") || value.includes("abort") || value.includes("cancel"),
  );
}

function hasStopIconLabel(node) {
  const iconNodes = findAllElements(node, (entry) =>
    ["rect", "path", "svg", "span", "div"].includes(entry.tagName),
  );

  return iconNodes.some((entry) => {
    const iconText = normalizeText(
      [
        getAttribute(entry, "id"),
        getAttribute(entry, "aria-label"),
        getAttribute(entry, "title"),
        getTextContent(entry),
      ]
        .filter(Boolean)
        .join(" "),
    );

    return STOP_TEXT_FRAGMENTS.some((fragment) => iconText.includes(fragment));
  });
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

  if (USER_MESSAGE_CLASSES.some((className) => hasClassToken(node, className))) {
    return "user";
  }

  if (ASSISTANT_MESSAGE_CLASSES.some((className) => hasClassToken(node, className))) {
    return "assistant";
  }

  const classNames = getClassTokens(node).join(" ").toLowerCase();
  if (classNames.includes("assistant")) {
    return "assistant";
  }
  if (classNames.includes("user")) {
    return "user";
  }

  return null;
}

function hasStopControl(snapshot) {
  return findAllElements(
    snapshot,
    (node) =>
      node.tagName === "button" ||
      getAttribute(node, "role") === "button" ||
      BUTTON_CLASS_NAMES.some((className) => hasClassToken(node, className)),
  ).some((button) => {
    if (hasStructuralStopSignal(button) || hasStopIconLabel(button)) {
      return true;
    }

    const text = normalizeText(getAccessibleText(button));
    return STOP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
  });
}

function getHistoryResponse(options) {
  return options?.pageData?.historyResponse ?? null;
}

function normalizeHistoryText(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeHistoryText(entry))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  for (const key of ["content", "text", "markdown", "value"]) {
    const text = normalizeHistoryText(value[key]);
    if (text) {
      return text;
    }
  }

  return "";
}

function collectFragmentText(fragments, allowedTypes) {
  return (fragments ?? [])
    .filter((fragment) => allowedTypes.includes(fragment?.type))
    .map((fragment) => fragment?.content ?? "")
    .join("")
    .trim();
}

function extractHistoryMessageContent(message) {
  const content = normalizeHistoryText(message?.content);
  if (content) {
    return content;
  }

  const role = String(message?.role ?? "").toUpperCase() === "ASSISTANT" ? "assistant" : "user";
  return collectFragmentText(
    message?.fragments,
    role === "assistant" ? ["RESPONSE"] : ["REQUEST", "RESPONSE"],
  );
}

function createBlocksFromHistoryMessage(message) {
  const content = extractHistoryMessageContent(message);

  if (!content) {
    return [];
  }

  return [{ type: "paragraph", text: content }];
}

function getHistoryMessages(historyResponse) {
  const chatMessages = historyResponse?.data?.biz_data?.chat_messages;
  if (!Array.isArray(chatMessages)) {
    return [];
  }

  return [...chatMessages].sort((left, right) => {
    const leftOrder = Number(left?.message_id ?? left?.inserted_at ?? 0);
    const rightOrder = Number(right?.message_id ?? right?.inserted_at ?? 0);
    return leftOrder - rightOrder;
  });
}

function getLatestAssistantHistoryMessage(historyResponse) {
  return [...getHistoryMessages(historyResponse)]
    .reverse()
    .find((message) => String(message?.role ?? "").toUpperCase() === "ASSISTANT");
}

function isHistoryGenerating(historyResponse) {
  const latestMessage = [...getHistoryMessages(historyResponse)].reverse().find((message) => message?.role);

  const status = normalizeText(latestMessage?.status);
  if (!status) {
    return false;
  }

  return !["finished", "completed", "done", "success"].includes(status);
}

function extractConversationFromHistoryResponse(historyResponse, pageTitle) {
  const bizData = historyResponse?.data?.biz_data;
  const chatMessages = getHistoryMessages(historyResponse);

  if (chatMessages.length === 0) {
    return null;
  }

  return createConversation(
    "DeepSeek",
    bizData?.chat_session?.title || pageTitle,
    chatMessages.map((message) => ({
      role: String(message?.role ?? "").toUpperCase() === "ASSISTANT" ? "assistant" : "user",
      blocks: createBlocksFromHistoryMessage(message),
    })),
  );
}

function findContentNode(node, classNames) {
  for (const className of classNames) {
    const match =
      findAllElements(node, (entry) => hasClassToken(entry, className), {
        stopOnMatch: true,
      })[0] ?? null;

    if (match) {
      return match;
    }
  }

  return node;
}

function extractStructuredMessages(snapshot) {
  return findAllElements(
    snapshot,
    (node) => resolveRole(node) !== null,
    { stopOnMatch: true },
  ).map((node) => {
    const role = resolveRole(node);
    const contentNode =
      role === "assistant"
        ? findContentNode(node, ASSISTANT_CONTENT_CLASSES)
        : findContentNode(node, USER_CONTENT_CLASSES);

    return {
      role,
      blocks: extractBlocks(contentNode),
    };
  });
}

export const DeepSeekAdapter = {
  matchesLocation(url) {
    return /https:\/\/(chat\.deepseek\.com|www\.deepseek\.com)\//i.test(url);
  },

  getSiteName() {
    return "DeepSeek";
  },

  extractConversation(snapshot, pageTitle = "DeepSeek", options = {}) {
    const historyConversation = extractConversationFromHistoryResponse(
      getHistoryResponse(options),
      pageTitle,
    );

    if (historyConversation) {
      return historyConversation;
    }

    const conversation = createConversation(
      "DeepSeek",
      findTitle(snapshot, pageTitle),
      extractStructuredMessages(snapshot),
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

  isGenerating(snapshot, options = {}) {
    return hasStopControl(snapshot) || isHistoryGenerating(getHistoryResponse(options));
  },

  getLatestAssistantFingerprint(snapshot, pageTitle = "DeepSeek", options = {}) {
    return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle, options));
  },

  getLatestAssistantMarker(_snapshot, _pageTitle = "DeepSeek", options = {}) {
    const latestAssistantMessage = getLatestAssistantHistoryMessage(getHistoryResponse(options));
    if (!latestAssistantMessage) {
      return null;
    }

    return String(
      latestAssistantMessage.message_id ??
        latestAssistantMessage.inserted_at ??
        latestAssistantMessage.id ??
        "",
    );
  },
};
