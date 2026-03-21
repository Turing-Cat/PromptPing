import test from "node:test";
import assert from "node:assert/strict";

import { DeepSeekAdapter } from "../../src/adapters/deepseek.js";
import { element } from "../helpers/snapshot-builder.js";

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

