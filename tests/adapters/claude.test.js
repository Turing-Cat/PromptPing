import test from "node:test";
import assert from "node:assert/strict";

import { ClaudeAdapter } from "../../src/adapters/claude.js";
import { element } from "../helpers/snapshot-builder.js";

test("ClaudeAdapter extracts user and assistant messages", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Extension Plan"]),
    element("div", { attrs: { "data-testid": "user-message" } }, [
      element("p", {}, ["Add export support."]),
    ]),
    element("div", { classList: ["font-claude-response"] }, [
      element("p", {}, ["Export is supported."]),
      element("ol", {}, [
        element("li", {}, ["Detect page"]),
        element("li", {}, ["Serialize messages"]),
      ]),
    ]),
  ]);

  const conversation = ClaudeAdapter.extractConversation(snapshot, "Fallback");

  assert.equal(conversation.title, "Extension Plan");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].role, "user");
  assert.equal(conversation.messages[1].role, "assistant");
  assert.deepEqual(conversation.messages[1].blocks[1], {
    type: "list",
    items: ["Detect page", "Serialize messages"],
  });
});

test("ClaudeAdapter detects active generation with stop response controls", () => {
  const snapshot = element("main", {}, [
    element("div", { classList: ["font-claude-response"] }, [
      element("p", {}, ["Almost done"]),
    ]),
    element("button", {}, ["Stop response"]),
  ]);

  assert.equal(ClaudeAdapter.isGenerating(snapshot), true);
  assert.match(ClaudeAdapter.getLatestAssistantFingerprint(snapshot), /^[a-f0-9]+$/);
});

