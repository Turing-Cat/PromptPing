import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDownloadFilename,
  buildMarkdownDownloadUrl,
  toMarkdown,
} from "../../src/core/markdown.js";

test("toMarkdown renders title, roles, paragraphs, lists, and code blocks", () => {
  const markdown = toMarkdown({
    site: "ChatGPT",
    title: "Prompt Ping Demo",
    messages: [
      {
        role: "user",
        blocks: [{ type: "paragraph", text: "Build me a Chrome extension." }],
      },
      {
        role: "assistant",
        blocks: [
          { type: "paragraph", text: "Here is the implementation outline:" },
          { type: "list", items: ["Create manifest", "Add content script"] },
          {
            type: "code",
            language: "js",
            text: "console.log('ready');",
          },
        ],
      },
    ],
  });

  assert.match(markdown, /^# Prompt Ping Demo/m);
  assert.match(markdown, /^## User$/m);
  assert.match(markdown, /^## Assistant$/m);
  assert.match(markdown, /- Create manifest/);
  assert.match(markdown, /```js\nconsole\.log\('ready'\);\n```/);
});

test("buildDownloadFilename strips unsafe characters and appends timestamp", () => {
  const filename = buildDownloadFilename({
    site: "ChatGPT",
    title: "Build: Prompt/Ping?",
    timestamp: new Date("2026-03-21T13:24:00Z"),
  });

  assert.equal(filename, "chatgpt-build-prompt-ping-20260321-132400.md");
});

test("buildMarkdownDownloadUrl returns a text markdown data url", () => {
  const url = buildMarkdownDownloadUrl("# Title\n\nHello");

  assert.match(url, /^data:text\/markdown;charset=utf-8,/);
  assert.match(url, /Title/);
  assert.match(url, /Hello/);
});
