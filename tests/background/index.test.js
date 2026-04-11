import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

function waitForTurn() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function captureUnhandledRejection(run) {
  return new Promise((resolve) => {
    let settled = false;

    function finish(error) {
      if (settled) {
        return;
      }

      settled = true;
      process.off("unhandledRejection", handleRejection);
      resolve(error);
    }

    function handleRejection(error) {
      finish(error);
    }

    process.on("unhandledRejection", handleRejection);

    void Promise.resolve()
      .then(run)
      .then(waitForTurn)
      .then(() => finish(null))
      .catch(finish);
  });
}

test("background startup injection does not throw for supported open tabs", async () => {
  let installedListener = null;
  let runtimeMessageListener = null;
  const injectedTabs = [];
  let sendMessageCount = 0;

  globalThis.chrome = {
    scripting: {
      executeScript: async ({ target }) => {
        injectedTabs.push(target.tabId);
      },
    },
    tabs: {
      query: async (queryInfo) => {
        if (Object.keys(queryInfo).length === 0) {
          return [{ id: 42, url: "https://gemini.google.com/app/example" }];
        }

        return [];
      },
      get: async (tabId) => ({
        id: tabId,
        url: "https://gemini.google.com/app/example",
      }),
      sendMessage: async () => {
        sendMessageCount += 1;

        if (sendMessageCount === 1) {
          throw new Error("No content script yet");
        }

        return { supported: true };
      },
      onActivated: {
        addListener: () => {},
      },
      onUpdated: {
        addListener: () => {},
      },
    },
    runtime: {
      getURL: (value) => `chrome-extension://test/${value}`,
      onInstalled: {
        addListener: (listener) => {
          installedListener = listener;
        },
      },
      onMessage: {
        addListener: (listener) => {
          runtimeMessageListener = listener;
        },
      },
      onStartup: {
        addListener: () => {},
      },
    },
    notifications: {
      create: async () => "notification-id",
      onClicked: {
        addListener: () => {},
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: () => {},
      },
      onCompleted: {
        addListener: () => {},
      },
      onErrorOccurred: {
        addListener: () => {},
      },
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
    },
    i18n: {
      getMessage: (key) => key,
    },
  };

  await import(
    `${pathToFileURL(path.join(process.cwd(), "src/background/index.js")).href}?test=${Date.now()}`
  );

  assert.equal(typeof installedListener, "function");
  assert.equal(typeof runtimeMessageListener, "function");

  const rejection = await captureUnhandledRejection(async () => {
    installedListener();
  });

  assert.equal(rejection, null);
  assert.deepEqual(injectedTabs, [42]);
  assert.equal(sendMessageCount, 2);
});

test("background forwards Gemini stream activity from webRequest events to the tab", async () => {
  let beforeRequestListener = null;
  let completedListener = null;
  let errorListener = null;
  const sentMessages = [];
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.setTimeout = (callback) => {
    callback();
    return 0;
  };

  globalThis.chrome = {
    scripting: {
      executeScript: async () => {},
    },
    tabs: {
      query: async () => [],
      get: async (tabId) => ({
        id: tabId,
        url: "https://gemini.google.com/app/example",
      }),
      sendMessage: async (tabId, message) => {
        sentMessages.push({ tabId, message });
        return { supported: true };
      },
      onActivated: {
        addListener: () => {},
      },
      onUpdated: {
        addListener: () => {},
      },
    },
    runtime: {
      getURL: (value) => `chrome-extension://test/${value}`,
      onInstalled: {
        addListener: () => {},
      },
      onMessage: {
        addListener: () => {},
      },
      onStartup: {
        addListener: () => {},
      },
    },
    notifications: {
      create: async () => "notification-id",
      onClicked: {
        addListener: () => {},
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: (listener) => {
          beforeRequestListener = listener;
        },
      },
      onCompleted: {
        addListener: (listener) => {
          completedListener = listener;
        },
      },
      onErrorOccurred: {
        addListener: (listener) => {
          errorListener = listener;
        },
      },
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
    },
    i18n: {
      getMessage: (key) => key,
    },
  };

  await import(
    `${pathToFileURL(path.join(process.cwd(), "src/background/index.js")).href}?test=${Date.now()}`
  );

  try {
    assert.equal(typeof beforeRequestListener, "function");
    assert.equal(typeof completedListener, "function");
    assert.equal(typeof errorListener, "function");

    beforeRequestListener({
      requestId: "request-1",
      tabId: 99,
      url: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?_reqid=1",
    });
    await waitForTurn();

    completedListener({
      requestId: "request-1",
      tabId: 99,
      url: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?_reqid=1",
    });
    await waitForTurn();

    beforeRequestListener({
      requestId: "request-2",
      tabId: 99,
      url: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?_reqid=2",
    });
    await waitForTurn();

    errorListener({
      requestId: "request-2",
      tabId: 99,
      url: "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?_reqid=2",
    });
    await waitForTurn();

    assert.deepEqual(sentMessages, [
      {
        tabId: 99,
        message: {
          type: "GEMINI_NETWORK_ACTIVITY",
          phase: "stream-start",
          activeCount: 1,
        },
      },
      {
        tabId: 99,
        message: {
          type: "GEMINI_NETWORK_ACTIVITY",
          phase: "stream-end",
          activeCount: 0,
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "GEMINI_NETWORK_ACTIVITY",
          phase: "stream-start",
          activeCount: 1,
        },
      },
      {
        tabId: 99,
        message: {
          type: "GEMINI_NETWORK_ACTIVITY",
          phase: "stream-end",
          activeCount: 0,
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
      {
        tabId: 99,
        message: {
          type: "FORCE_ANALYZE",
        },
      },
    ]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
