import test from "node:test";
import assert from "node:assert/strict";

import { ChatGPTAdapter } from "../../src/adapters/chatgpt.js";
import { element } from "../helpers/snapshot-builder.js";

test("ChatGPTAdapter extracts ordered conversation blocks", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Prompt Ping Demo"]),
    element("div", { attrs: { "data-message-author-role": "user" } }, [
      element("p", {}, ["Build a plugin."]),
    ]),
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Here is a plan."]),
      element("pre", {}, [
        element("code", { attrs: { "data-language": "js" } }, [
          "console.log('hi');",
        ]),
      ]),
      element("ul", {}, [
        element("li", {}, ["First"]),
        element("li", {}, ["Second"]),
      ]),
    ]),
  ]);

  const conversation = ChatGPTAdapter.extractConversation(snapshot, "Fallback");

  assert.equal(conversation.title, "Prompt Ping Demo");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.deepEqual(conversation.messages[1].blocks[1], {
    type: "code",
    language: "js",
    text: "console.log('hi');",
  });
  assert.deepEqual(conversation.messages[1].blocks[2], {
    type: "list",
    items: ["First", "Second"],
  });
});

test("ChatGPTAdapter detects active generation and latest assistant fingerprint", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming complete"]),
    ]),
    element("button", {}, ["Stop generating"]),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
  assert.match(ChatGPTAdapter.getLatestAssistantFingerprint(snapshot), /^[a-f0-9]+$/);
});

test("ChatGPTAdapter detects active generation from aria-label controls", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element("button", { attrs: { "aria-label": "Stop generating" } }, []),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
});

test("ChatGPTAdapter detects active generation from Chinese stop text", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element("button", {}, ["停止生成"]),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
});

test("ChatGPTAdapter detects active generation from structure-first controls", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element(
      "button",
      { attrs: { "data-testid": "stop-button", "aria-label": "x" } },
      [element("svg", { attrs: { "aria-hidden": "true" } }, [])],
    ),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
});
