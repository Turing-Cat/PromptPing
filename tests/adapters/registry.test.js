import test from "node:test";
import assert from "node:assert/strict";

import { getAdapterForUrl } from "../../src/adapters/index.js";

test("getAdapterForUrl returns the matching adapter", () => {
  assert.equal(getAdapterForUrl("https://chatgpt.com/c/123").getSiteName(), "ChatGPT");
  assert.equal(getAdapterForUrl("https://claude.ai/chat/123").getSiteName(), "Claude");
  assert.equal(
    getAdapterForUrl("https://chat.deepseek.com/a/chat/s/123").getSiteName(),
    "DeepSeek",
  );
  assert.equal(getAdapterForUrl("https://example.com"), null);
});
