import test from "node:test";
import assert from "node:assert/strict";

import { DeepSeekAdapter } from "../../src/adapters/deepseek.js";
import { element } from "../helpers/snapshot-builder.js";

function createHistoryResponse(chatMessages, title = "未来编程语言学习建议") {
  return {
    data: {
      biz_data: {
        chat_session: { title },
        chat_messages: chatMessages,
      },
    },
  };
}

test("DeepSeekAdapter extracts ordered conversation blocks", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["DeepSeek Session"]),
    element("div", { attrs: { "data-role": "user" } }, [
      element("p", {}, ["Export this conversation."]),
    ]),
    element("div", { attrs: { "data-role": "assistant" } }, [
      element("p", {}, ["Here is the answer."]),
      element("pre", {}, [
        element("code", { attrs: { class: "language-python" } }, ["print('ok')"]),
      ]),
    ]),
  ]);

  const conversation = DeepSeekAdapter.extractConversation(snapshot, "Fallback");

  assert.equal(conversation.title, "DeepSeek Session");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.deepEqual(conversation.messages[1].blocks[1], {
    type: "code",
    language: "python",
    text: "print('ok')",
  });
});

test("DeepSeekAdapter detects active generation from stop controls", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element("button", { attrs: { "aria-label": "Stop generating" } }, []),
  ]);

  assert.equal(DeepSeekAdapter.isGenerating(snapshot), true);
  assert.match(DeepSeekAdapter.getLatestAssistantFingerprint(snapshot), /^[a-f0-9]+$/);
});

test("DeepSeekAdapter strips the DeepSeek site suffix from titles", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-role": "user" } }, [
      element("p", {}, ["Question"]),
    ]),
  ]);

  const conversation = DeepSeekAdapter.extractConversation(
    snapshot,
    "未来编程语言学习建议 - DeepSeek",
  );

  assert.equal(conversation.title, "未来编程语言学习建议");
});

test("DeepSeekAdapter extracts assistant replies from structured message containers", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["未来编程语言学习建议 - DeepSeek"]),
    element("div", { classList: ["message"], attrs: { "data-testid": "user-message" } }, [
      element("p", {}, ["未来五到十年，最值得学习的编程语言是什么呢？"]),
    ]),
    element(
      "div",
      { classList: ["message"], attrs: { "data-testid": "assistant-message" } },
      [
        element("div", { classList: ["markdown"] }, [
          element("p", {}, ["已深度思考（用时 4 秒）"]),
        ]),
        element("div", { classList: ["markdown"] }, [
          element("p", {}, ["这是一个很有价值的问题。"]),
        ]),
      ],
    ),
  ]);

  const conversation = DeepSeekAdapter.extractConversation(snapshot, "Fallback");

  assert.equal(conversation.title, "未来编程语言学习建议");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.deepEqual(conversation.messages[1].blocks, [
    { type: "paragraph", text: "已深度思考（用时 4 秒）" },
    { type: "paragraph", text: "这是一个很有价值的问题。" },
  ]);
});

test("DeepSeekAdapter fingerprints the latest structured assistant reply", () => {
  const snapshot = element("main", {}, [
    element("div", { classList: ["message"], attrs: { "data-testid": "assistant-message" } }, [
      element("div", { classList: ["markdown"] }, [
        element("p", {}, ["这是一个很有价值的问题。"]),
      ]),
    ]),
  ]);

  assert.match(DeepSeekAdapter.getLatestAssistantFingerprint(snapshot), /^[a-f0-9]+$/);
});

test("DeepSeekAdapter recognizes DeepSeek web app message containers by class structure", () => {
  const snapshot = element("main", {}, [
    element("div", { classList: ["_9663006"] }, [
      element("div", { classList: ["fbb737a4"] }, ["未来五到十年，最值得学习的编程语言是什么呢？"]),
    ]),
    element("div", { classList: ["_4f9bf79", "_43c05b5"] }, [
      element("div", { classList: ["ds-markdown"] }, [
        element("p", {}, ["这是一个很有价值的问题。"]),
        element("ol", {}, [
          element("li", {}, ["Python"]),
          element("li", {}, ["Rust"]),
        ]),
      ]),
    ]),
  ]);

  const conversation = DeepSeekAdapter.extractConversation(snapshot, "未来编程语言学习建议 - DeepSeek");

  assert.equal(conversation.title, "未来编程语言学习建议");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.deepEqual(conversation.messages[1].blocks[1], {
    type: "list",
    items: ["Python", "Rust"],
  });
  assert.match(DeepSeekAdapter.getLatestAssistantFingerprint(snapshot), /^[a-f0-9]+$/);
});

test("DeepSeekAdapter prefers full history payloads over virtualized DOM snapshots", () => {
  const historyResponse = createHistoryResponse([
    {
      role: "USER",
      message_id: 1,
      inserted_at: 1,
      status: "FINISHED",
      content: "未来五到十年，最值得学习的编程语言是什么呢？",
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      inserted_at: 2,
      status: "FINISHED",
      content: "这是一个很有价值的问题。\n\n1. Python\n2. Rust",
      thinking_content: "这段思考不应该默认导出。",
    },
    {
      role: "USER",
      message_id: 3,
      inserted_at: 3,
      status: "FINISHED",
      content: "为什么是rust呢？",
    },
    {
      role: "ASSISTANT",
      message_id: 4,
      inserted_at: 4,
      status: "FINISHED",
      content: "因为它解决了系统编程里的内存安全问题。",
    },
  ]);

  const snapshot = element("main", {}, [
    element("div", { classList: ["_9663006"] }, [
      element("div", { classList: ["fbb737a4"] }, ["为什么是rust呢？"]),
    ]),
  ]);

  const conversation = DeepSeekAdapter.extractConversation(snapshot, "Fallback", {
    pageData: { historyResponse },
  });

  assert.equal(conversation.title, "未来编程语言学习建议");
  assert.equal(conversation.messages.length, 4);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.match(conversation.messages[1].blocks[0].text, /这是一个很有价值的问题/);
  assert.doesNotMatch(conversation.messages[1].blocks[0].text, /思考不应该默认导出/);
  assert.equal(conversation.messages[2].blocks[0].text, "为什么是rust呢？");
  assert.equal(conversation.messages[3].blocks[0].text, "因为它解决了系统编程里的内存安全问题。");
});

test("DeepSeekAdapter fingerprints the latest assistant reply from full history payloads", () => {
  const historyResponse = createHistoryResponse([
    {
      role: "USER",
      message_id: 1,
      inserted_at: 1,
      status: "FINISHED",
      content: "问题",
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      inserted_at: 2,
      status: "FINISHED",
      content: "最终回答",
    },
  ]);

  assert.match(
    DeepSeekAdapter.getLatestAssistantFingerprint(null, "Fallback", {
      pageData: { historyResponse },
    }),
    /^[a-f0-9]+$/,
  );
});

test("DeepSeekAdapter exposes the latest assistant history marker", () => {
  const historyResponse = createHistoryResponse([
    {
      role: "USER",
      message_id: 1,
      inserted_at: 1,
      status: "FINISHED",
      content: "问题",
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      inserted_at: 2,
      status: "FINISHED",
      content: "回答 A",
    },
    {
      role: "USER",
      message_id: 3,
      inserted_at: 3,
      status: "FINISHED",
      content: "问题 B",
    },
    {
      role: "ASSISTANT",
      message_id: 4,
      inserted_at: 4,
      status: "FINISHED",
      content: "回答 B",
    },
  ]);

  assert.equal(
    DeepSeekAdapter.getLatestAssistantMarker(null, "Fallback", {
      pageData: { historyResponse },
    }),
    "4",
  );
});

test("DeepSeekAdapter falls back to fragment payloads when content is unavailable", () => {
  const historyResponse = createHistoryResponse([
    {
      role: "USER",
      message_id: 1,
      inserted_at: 1,
      status: "FINISHED",
      fragments: [{ type: "REQUEST", content: "问题" }],
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      inserted_at: 2,
      status: "FINISHED",
      fragments: [{ type: "RESPONSE", content: "最终回答" }],
    },
  ]);

  const conversation = DeepSeekAdapter.extractConversation(null, "Fallback", {
    pageData: { historyResponse },
  });

  assert.equal(conversation.messages[0].blocks[0].text, "问题");
  assert.equal(conversation.messages[1].blocks[0].text, "最终回答");
});

test("DeepSeekAdapter detects active generation from history payload status", () => {
  const historyResponse = createHistoryResponse([
    {
      role: "USER",
      message_id: 1,
      inserted_at: 1,
      status: "FINISHED",
      content: "问题",
    },
    {
      role: "ASSISTANT",
      message_id: 2,
      inserted_at: 2,
      status: "IN_PROGRESS",
      content: "正在生成",
    },
  ]);

  assert.equal(
    DeepSeekAdapter.isGenerating(null, {
      pageData: { historyResponse },
    }),
    true,
  );
});

test("DeepSeekAdapter detects active generation from localized structural controls", () => {
  const snapshot = element("main", {}, [
    element("div", { classList: ["message"], attrs: { "data-testid": "assistant-message" } }, [
      element("div", { classList: ["markdown"] }, [
        element("p", {}, ["Streaming"]),
      ]),
    ]),
    element(
      "button",
      {
        attrs: {
          "data-testid": "chat-input-stop-response",
          "aria-label": "停止回答",
        },
      },
      [],
    ),
  ]);

  assert.equal(DeepSeekAdapter.isGenerating(snapshot), true);
});

test("DeepSeekAdapter detects active generation from DeepSeek icon-button controls", () => {
  const snapshot = element("main", {}, [
    element("div", { classList: ["ds-icon-button"], attrs: { role: "button" } }, [
      element("svg", {}, [element("rect", { attrs: { id: "停止回答" } }, [])]),
    ]),
  ]);

  assert.equal(DeepSeekAdapter.isGenerating(snapshot), true);
});
