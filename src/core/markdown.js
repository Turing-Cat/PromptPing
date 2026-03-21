function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function blockToMarkdown(block) {
  if (!block) {
    return "";
  }

  if (block.type === "paragraph") {
    return block.text ?? "";
  }

  if (block.type === "list") {
    return (block.items ?? []).map((item) => `- ${item}`).join("\n");
  }

  if (block.type === "code") {
    const language = block.language ?? "";
    return `\`\`\`${language}\n${block.text ?? ""}\n\`\`\``;
  }

  return "";
}

export function toMarkdown(conversation) {
  const title = conversation?.title?.trim() || "Conversation";
  const sections = [`# ${title}`];

  for (const message of conversation?.messages ?? []) {
    sections.push(`## ${message.role === "assistant" ? "Assistant" : "User"}`);

    const blocks = message.blocks?.length
      ? message.blocks
      : [{ type: "paragraph", text: message.text ?? "" }];
    sections.push(
      blocks
        .map((block) => blockToMarkdown(block))
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return sections.filter(Boolean).join("\n\n").trimEnd() + "\n";
}

export function buildDownloadFilename({ site, title, timestamp = new Date() }) {
  const sitePart = slugify(site) || "chat";
  const titlePart = slugify(title) || "conversation";
  return `${sitePart}-${titlePart}-${formatTimestamp(timestamp)}.md`;
}

export function buildMarkdownDownloadUrl(markdown) {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
}
