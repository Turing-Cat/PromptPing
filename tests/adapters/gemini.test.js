import test from "node:test";
import assert from "node:assert/strict";

import { GeminiAdapter } from "../../src/adapters/gemini.js";
import { element } from "../helpers/snapshot-builder.js";

test("GeminiAdapter detects active generation from stop controls", () => {
  const snapshot = element("main", {}, [
    element("model-response", {}, [
      element("message-content", {}, [
        element("p", {}, ["Streaming"]),
      ]),
    ]),
    element("button", { attrs: { "aria-label": "Stop generating" } }, []),
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot), true);
});

test("GeminiAdapter fingerprints the latest assistant reply", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Trip Plan - Gemini"]),
    element("model-response", {}, [
      element("message-content", {}, [
        element("p", {}, ["Here is a two-day itinerary."]),
      ]),
    ]),
  ]);

  assert.match(
    GeminiAdapter.getLatestAssistantFingerprint(snapshot, "Fallback"),
    /^[a-f0-9]+$/,
  );
});

test("GeminiAdapter strips the Gemini site suffix from titles", () => {
  const snapshot = element("main", {}, [
    element("model-response", {}, [
      element("message-content", {}, [
        element("p", {}, ["Answer"]),
      ]),
    ]),
  ]);

  const conversation = GeminiAdapter.extractConversation(snapshot, "Trip Plan - Gemini");

  assert.equal(conversation.title, "Trip Plan");
});

test("GeminiAdapter marks export as unsupported", () => {
  assert.equal(GeminiAdapter.supportsExport(), false);
});

test("GeminiAdapter detects active generation from modern Gemini stop state", () => {
  const snapshot = element("main", {}, [
    element("user-query", {}, [
      element("h2", {}, ["你说"]),
      element("p", {}, ["再用十个字介绍自己"]),
    ]),
    element(
      "button",
      { classList: ["send-button", "stop", "mat-mdc-icon-button"] },
      [],
    ),
    "Gemini 正在输入",
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot), true);
});

test("GeminiAdapter treats the injected network signal as active generation", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Conversation with Gemini"]),
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot, { networkGenerationActive: true }), true);
});

test("GeminiAdapter trusts a recent Gemini network-end signal over stale stop controls", () => {
  const snapshot = element("main", {}, [
    element("button", { attrs: { "aria-label": "Stop generating" } }, []),
    "Gemini 正在输入",
  ]);

  assert.equal(
    GeminiAdapter.isGenerating(snapshot, {
      networkGenerationActive: false,
      networkGenerationIdleOverrideActive: true,
    }),
    false,
  );
});

test("GeminiAdapter does not treat the idle send button as active generation", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Chats"]),
    element(
      "button",
      {
        attrs: { "aria-label": "Send message" },
        classList: ["send-button", "submit", "mat-mdc-icon-button"],
      },
      [],
    ),
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot), false);
});

test("GeminiAdapter ignores unrelated buttons whose labels contain aborted", () => {
  const snapshot = element("main", {}, [
    element("button", { attrs: { "aria-label": "More options for Copilot Aborted Error Troubleshooting" } }, []),
    element("user-query", {}, [
      element("h2", {}, ["You said"]),
      element("p", {}, ["Please reply ok"]),
    ]),
    element("model-response", {}, [
      element("message-content", {}, [
        element("p", {}, ["ok"]),
      ]),
    ]),
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot), false);
});

test("GeminiAdapter fingerprints assistant-messages-primary content from modern Gemini", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Conversation with Gemini"]),
    element("assistant-messages-primary", {}, [
      element("div", { classList: ["assistant-messages-primary-container", "open"] }, [
        element("span", { classList: ["message-text"] }, [
          "Meet Gemini, your personal AI assistant",
        ]),
      ]),
    ]),
  ]);

  const conversation = GeminiAdapter.extractConversation(snapshot, "Google Gemini");

  assert.equal(conversation.messages.length, 1);
  assert.equal(
    conversation.messages[0].blocks[0].text,
    "Meet Gemini, your personal AI assistant",
  );
  assert.match(
    GeminiAdapter.getLatestAssistantFingerprint(snapshot, "Google Gemini"),
    /^[a-f0-9]+$/,
  );
});

test("GeminiAdapter uses the latest user prompt as the title when the page title is generic", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["与 Gemini 对话"]),
    element("user-query", {}, [
      element("h2", {}, ["你说"]),
      element("p", {}, ["用一句话介绍你自己"]),
    ]),
    element("model-response", {}, [
      element("div", { classList: ["response-content"] }, [
        element("structured-content-container", { classList: ["model-response-text"] }, [
          element("message-content", {}, [
            element("p", {}, ["我是由 Google 训练的大型语言模型。"]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const conversation = GeminiAdapter.extractConversation(snapshot, "Google Gemini");

  assert.equal(conversation.title, "用一句话介绍你自己");
});

test("GeminiAdapter exposes a stable marker for the latest live Gemini turn", () => {
  const snapshot = element("main", {}, [
    element("user-query", {}, [
      element("h2", {}, ["你说"]),
      element("p", {}, ["用一句话介绍你自己"]),
    ]),
    element("model-response", {}, [
      element("message-content", {}, [
        element("p", {}, ["我是由 Google 训练的大型语言模型。"]),
      ]),
    ]),
    element("user-query", {}, [
      element("h2", {}, ["你说"]),
      element("p", {}, ["再用十个字介绍自己"]),
    ]),
  ]);

  assert.equal(
    GeminiAdapter.getLatestAssistantMarker(snapshot, "Google Gemini"),
    "2:再用十个字介绍自己",
  );
});
