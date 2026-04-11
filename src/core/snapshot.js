function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const KNOWN_SITE_SUFFIXES = ["ChatGPT", "Claude", "DeepSeek", "Gemini"];

function collectText(node, parts) {
  if (!node) {
    return;
  }

  if (node.type === "text") {
    if (node.text) {
      parts.push(node.text);
    }
    return;
  }

  for (const child of node.children ?? []) {
    collectText(child, parts);
  }
}

export function createDomSnapshot(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType === 3) {
    return {
      type: "text",
      text: node.textContent ?? "",
    };
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  if (["script", "style", "noscript"].includes(tagName)) {
    return null;
  }

  const attrs = {};
  for (const attribute of node.attributes ?? []) {
    attrs[attribute.name] = attribute.value;
  }

  return {
    type: "element",
    tagName,
    attrs,
    classList: Array.from(node.classList ?? []),
    children: Array.from(node.childNodes ?? [])
      .map((child) => createDomSnapshot(child))
      .filter(Boolean),
  };
}

export function findAllElements(node, predicate, options = {}) {
  const matches = [];
  const stopOnMatch = options.stopOnMatch ?? false;

  function visit(current) {
    if (!current || current.type !== "element") {
      return;
    }

    const matched = predicate(current);
    if (matched) {
      matches.push(current);
      if (stopOnMatch) {
        return;
      }
    }

    for (const child of current.children ?? []) {
      visit(child);
    }
  }

  visit(node);
  return matches;
}

export function findFirstElement(node, predicate) {
  return findAllElements(node, predicate, { stopOnMatch: true })[0] ?? null;
}

export function getAttribute(node, name) {
  return node?.attrs?.[name] ?? null;
}

export function hasClass(node, className) {
  return Array.isArray(node?.classList) && node.classList.includes(className);
}

export function getTextContent(node) {
  const parts = [];
  collectText(node, parts);
  return collapseWhitespace(parts.join(" "));
}

export function getAccessibleText(node) {
  return collapseWhitespace(
    [
      getTextContent(node),
      getAttribute(node, "aria-label"),
      getAttribute(node, "title"),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function sanitizeConversationTitle(title) {
  const normalized = collapseWhitespace(title);
  if (!normalized) {
    return "Conversation";
  }

  const sitePattern = KNOWN_SITE_SUFFIXES.join("|");
  return normalized.replace(new RegExp(`\\s*[-|]\\s*(${sitePattern})\\s*$`, "i"), "").trim();
}
