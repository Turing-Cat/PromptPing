import test from "node:test";
import assert from "node:assert/strict";

import {
  createChromeNotificationOptions,
  createResponseFingerprint,
  getNotificationIconPath,
  shouldSendCompletionNotification,
} from "../../src/core/notifications.js";

test("createResponseFingerprint is stable for the same payload", () => {
  const first = createResponseFingerprint({
    site: "claude",
    title: "Plan",
    text: "Finished response",
  });
  const second = createResponseFingerprint({
    site: "claude",
    title: "Plan",
    text: "Finished response",
  });

  assert.equal(first, second);
});

test("shouldSendCompletionNotification only notifies background tabs with new fingerprints", () => {
  assert.equal(
    shouldSendCompletionNotification({
      activeTabId: 7,
      senderTabId: 3,
      fingerprint: "abc",
      lastFingerprint: "old",
    }),
    true,
  );
  assert.equal(
    shouldSendCompletionNotification({
      activeTabId: 3,
      senderTabId: 3,
      fingerprint: "abc",
      lastFingerprint: "old",
    }),
    false,
  );
  assert.equal(
    shouldSendCompletionNotification({
      activeTabId: 7,
      senderTabId: 3,
      fingerprint: "abc",
      lastFingerprint: "abc",
    }),
    false,
  );
  assert.equal(
    shouldSendCompletionNotification({
      activeTabId: 3,
      senderTabId: 3,
      fingerprint: "abc",
      lastFingerprint: "old",
      wasHidden: true,
    }),
    true,
  );
});

test("getNotificationIconPath uses a raster icon for Chrome notifications", () => {
  assert.equal(getNotificationIconPath(), "assets/icon.png");
});

test("createChromeNotificationOptions uses a high-visibility configuration", () => {
  assert.deepEqual(
    createChromeNotificationOptions({
      iconUrl: "chrome-extension://id/assets/icon.png",
      title: "PromptPing",
      message: "Gemini · Chats · replied",
    }),
    {
      type: "basic",
      iconUrl: "chrome-extension://id/assets/icon.png",
      title: "PromptPing",
      message: "Gemini · Chats · replied",
      priority: 2,
      requireInteraction: true,
      silent: false,
    },
  );
});
