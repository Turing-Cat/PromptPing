import {
  findAllElements,
  findFirstElement,
  getAttribute,
  getTextContent,
  sanitizeConversationTitle,
} from "../core/snapshot.js";
import { createResponseFingerprint } from "../core/notifications.js";

function extractLanguage(node) {
  const attrLanguage =
    getAttribute(node, "data-language") || getAttribute(node, "data-code-language");
  if (attrLanguage) {
    return attrLanguage;
  }

  const classNames = [
    ...(node.classList ?? []),
    ...String(getAttribute(node, "class") ?? "")
      .split(/\s+/)
      .filter(Boolean),
  ];

  for (const className of classNames) {
    if (className.startsWith("language-")) {
      return className.slice("language-".length);
    }
  }

  return "";
}

function directChildren(node, tagName) {
  return (node.children ?? []).filter(
    (child) => child.type === "element" && child.tagName === tagName,
  );
}

function collectBlocks(node, blocks) {
  for (const child of node.children ?? []) {
    if (child.type !== "element") {
      continue;
    }

    if (child.tagName === "pre") {
      const codeNode =
        findFirstElement(child, (entry) => entry.tagName === "code") ?? child;
      blocks.push({
        type: "code",
        language: extractLanguage(codeNode),
        text: getTextContent(codeNode),
      });
      continue;
    }

    if (child.tagName === "ul" || child.tagName === "ol") {
      const items = directChildren(child, "li")
        .map((entry) => getTextContent(entry))
        .filter(Boolean);
      if (items.length) {
        blocks.push({
          type: "list",
          items,
        });
      }
      continue;
    }

    if (["p", "blockquote", "h1", "h2", "h3", "h4"].includes(child.tagName)) {
      const text = getTextContent(child);
      if (text) {
        blocks.push({
          type: "paragraph",
          text,
        });
      }
      continue;
    }

    collectBlocks(child, blocks);
  }
}

export function extractBlocks(node) {
  const blocks = [];
  collectBlocks(node, blocks);

  if (!blocks.length) {
    const text = getTextContent(node);
    if (text) {
      blocks.push({
        type: "paragraph",
        text,
      });
    }
  }

  return blocks;
}

export function createConversation(siteName, title, messages) {
  return {
    site: siteName,
    title: sanitizeConversationTitle(title),
    messages: messages.filter(
      (message) =>
        Array.isArray(message.blocks) &&
        message.blocks.some((block) => {
          if (block.type === "list") {
            return (block.items ?? []).length > 0;
          }

          return Boolean(block.text);
        }),
    ),
  };
}

export function findTitle(snapshot, pageTitle) {
  const heading = findFirstElement(snapshot, (node) => node.tagName === "h1");
  return sanitizeConversationTitle(getTextContent(heading) || pageTitle);
}

export function fingerprintLatestAssistant(conversation) {
  const message = [...(conversation.messages ?? [])]
    .reverse()
    .find((entry) => entry.role === "assistant");

  if (!message) {
    return null;
  }

  const text = message.blocks
    .map((block) =>
      block.type === "list" ? (block.items ?? []).join(" ") : block.text ?? "",
    )
    .join(" ")
    .trim();

  if (!text) {
    return null;
  }

  return createResponseFingerprint({
    site: conversation.site,
    title: conversation.title,
    text,
  });
}

export function findMessages(snapshot, roleResolver) {
  return findAllElements(
    snapshot,
    (node) => roleResolver(node) !== null,
    { stopOnMatch: true },
  ).map((node) => ({
    role: roleResolver(node),
    blocks: extractBlocks(node),
  }));
}
