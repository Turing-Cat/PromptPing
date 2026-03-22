import test from "node:test";
import assert from "node:assert/strict";

import { createDeepSeekHistoryProvider } from "../../src/content/deepseek-history.js";

function createHistoryResponse(count = 2) {
  return {
    data: {
      biz_data: {
        chat_session: { title: "DeepSeek Session" },
        chat_messages: Array.from({ length: count }, (_, index) => ({
          message_id: index + 1,
          role: index % 2 === 0 ? "USER" : "ASSISTANT",
          status: "FINISHED",
          content: `message-${index + 1}`,
        })),
      },
    },
  };
}

test("createDeepSeekHistoryProvider fetches history with the DeepSeek bearer token", async () => {
  const requests = [];
  const provider = createDeepSeekHistoryProvider({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        status: 200,
        async json() {
          return createHistoryResponse(4);
        },
      };
    },
    storage: {
      getItem(key) {
        return key === "userToken" ? JSON.stringify({ value: "secret-token" }) : null;
      },
    },
    location: {
      origin: "https://chat.deepseek.com",
      pathname: "/a/chat/s/session-123",
    },
    now: () => 1234567890,
  });

  const pageData = await provider.request({ forceRefresh: true });

  assert.equal(pageData.historyResponse.data.biz_data.chat_messages.length, 4);
  assert.equal(pageData.receivedAt, 1234567890);
  assert.equal(requests.length, 1);
  assert.match(
    requests[0].url,
    /https:\/\/chat\.deepseek\.com\/api\/v0\/chat\/history_messages\?chat_session_id=session-123&v=1234567890/,
  );
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.cache, "no-store");
  assert.equal(requests[0].init.headers.Authorization, "Bearer secret-token");
});

test("createDeepSeekHistoryProvider reuses cached history unless forced fresh", async () => {
  let count = 0;
  const provider = createDeepSeekHistoryProvider({
    fetchImpl: async () => {
      count += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return createHistoryResponse(count);
        },
      };
    },
    storage: {
      getItem() {
        return null;
      },
    },
    location: {
      origin: "https://chat.deepseek.com",
      pathname: "/a/chat/s/session-123",
    },
    now: () => 42,
  });

  const first = await provider.request({ forceRefresh: true });
  const second = await provider.request();
  const third = await provider.request({ forceRefresh: true });

  assert.equal(first.historyResponse.data.biz_data.chat_messages.length, 1);
  assert.equal(second.historyResponse.data.biz_data.chat_messages.length, 1);
  assert.equal(third.historyResponse.data.biz_data.chat_messages.length, 2);
  assert.equal(count, 2);
});

test("createDeepSeekHistoryProvider rejects malformed history payloads", async () => {
  const provider = createDeepSeekHistoryProvider({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { data: { biz_data: { chat_messages: null } } };
      },
    }),
    storage: {
      getItem() {
        return null;
      },
    },
    location: {
      origin: "https://chat.deepseek.com",
      pathname: "/a/chat/s/session-123",
    },
  });

  await assert.rejects(
    provider.request({ forceRefresh: true }),
    /payload missing messages/,
  );
});
