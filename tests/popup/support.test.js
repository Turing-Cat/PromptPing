import test from "node:test";
import assert from "node:assert/strict";

import { ensureTabReady, waitForSupportStatus } from "../../src/popup/support.js";

test("waitForSupportStatus retries until the content script is ready", async () => {
  const calls = [];
  const status = await waitForSupportStatus(
    7,
    async (tabId) => {
      calls.push(tabId);
      if (calls.length < 3) {
        throw new Error("Receiving end does not exist.");
      }

      return { supported: true, siteName: "DeepSeek" };
    },
    { attempts: 5, delayMs: 0 },
  );

  assert.deepEqual(status, { supported: true, siteName: "DeepSeek" });
  assert.equal(calls.length, 3);
});

test("ensureTabReady skips unsupported tabs", async () => {
  const result = await ensureTabReady(
    { id: 7, url: "https://example.com/" },
    {
      isSupportedUrl: () => false,
      getSupportStatus: async () => ({ supported: true }),
      injectContentScript: async () => {
        throw new Error("should not inject");
      },
      attempts: 1,
      delayMs: 0,
    },
  );

  assert.equal(result, null);
});

test("ensureTabReady injects and waits when the first ping fails", async () => {
  const sequence = [];
  const result = await ensureTabReady(
    { id: 7, url: "https://chat.deepseek.com/a/chat/s/123" },
    {
      isSupportedUrl: () => true,
      getSupportStatus: async () => {
        sequence.push("ping");
        if (sequence.length < 3) {
          throw new Error("Receiving end does not exist.");
        }

        return { supported: true, conversationTitle: "Future Languages" };
      },
      injectContentScript: async () => {
        sequence.push("inject");
      },
      attempts: 3,
      delayMs: 0,
    },
  );

  assert.deepEqual(result, {
    supported: true,
    conversationTitle: "Future Languages",
  });
  assert.deepEqual(sequence, ["ping", "inject", "ping"]);
});
