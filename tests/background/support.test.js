import test from "node:test";
import assert from "node:assert/strict";

import { ensureBackgroundTabReady } from "../../src/background/support.js";

test("ensureBackgroundTabReady does not inject when the content script already responds", async () => {
  const calls = [];

  const status = await ensureBackgroundTabReady(7, {
    getTab: async (tabId) => ({ id: tabId, url: "https://gemini.google.com/app" }),
    isSupportedUrl: (url) => url.startsWith("https://gemini.google.com/"),
    getSupportStatus: async (tabId) => {
      calls.push(["ping", tabId]);
      return { supported: true, siteName: "Gemini" };
    },
    injectContentScript: async (tabId) => {
      calls.push(["inject", tabId]);
    },
    attempts: 2,
    delayMs: 0,
  });

  assert.deepEqual(status, { supported: true, siteName: "Gemini" });
  assert.deepEqual(calls, [["ping", 7]]);
});

test("ensureBackgroundTabReady injects and waits when the content script is missing", async () => {
  const calls = [];

  const status = await ensureBackgroundTabReady(7, {
    getTab: async (tabId) => ({ id: tabId, url: "https://gemini.google.com/app" }),
    isSupportedUrl: (url) => url.startsWith("https://gemini.google.com/"),
    getSupportStatus: async (tabId) => {
      calls.push(["ping", tabId]);
      if (calls.length < 3) {
        throw new Error("Receiving end does not exist.");
      }

      return { supported: true, siteName: "Gemini" };
    },
    injectContentScript: async (tabId) => {
      calls.push(["inject", tabId]);
    },
    attempts: 3,
    delayMs: 0,
  });

  assert.deepEqual(status, { supported: true, siteName: "Gemini" });
  assert.deepEqual(calls, [["ping", 7], ["inject", 7], ["ping", 7]]);
});
