import { getAdapterForUrl } from "../adapters/index.js";
import { createDomSnapshot } from "../core/snapshot.js";
import { createDeepSeekHistoryProvider } from "./deepseek-history.js";
import { transitionCompletionState } from "./completion-tracker.js";

export const DEEPSEEK_GENERATION_POLL_DELAY_MS = 1000;

export function getAnalyzeRefreshOptions({
  hasPageDataProvider,
  wasGenerating: _wasGenerating,
}) {
  return {
    forceFreshPageData: Boolean(hasPageDataProvider),
    maxPageDataAgeMs: 0,
  };
}

export function getFollowUpAnalyzeDelay(state) {
  return state?.wasGenerating ? DEEPSEEK_GENERATION_POLL_DELAY_MS : null;
}

function sendRuntimeMessage(message) {
  try {
    return Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => null);
  } catch (_error) {
    return Promise.resolve(null);
  }
}

export function bootContentScript() {
  const adapter = getAdapterForUrl(window.location.href);
  if (!adapter || !document.body) {
    return null;
  }

  const pageDataProvider =
    adapter.getSiteName() === "DeepSeek" ? createDeepSeekHistoryProvider() : null;

  let state = {
    wasGenerating: false,
    lastCompletedFingerprint: null,
    lastCompletedMarker: null,
    lastObservedMarker: null,
  };

  let timerId = null;
  let disposed = false;

  function buildSnapshot() {
    return createDomSnapshot(document.body);
  }

  async function getAdapterOptions({
    forceFreshPageData = false,
    maxPageDataAgeMs = 0,
  } = {}) {
    if (!pageDataProvider) {
      return {};
    }

    let pageData = pageDataProvider.getCachedData();
    const cachedAge = Date.now() - Number(pageData?.receivedAt ?? 0);
    const shouldRefresh =
      !pageData ||
      forceFreshPageData ||
      (maxPageDataAgeMs > 0 && cachedAge > maxPageDataAgeMs);

    if (shouldRefresh) {
      try {
        pageData = await pageDataProvider.request({
          forceRefresh: forceFreshPageData || maxPageDataAgeMs > 0,
        });
      } catch (_error) {
        pageData = pageDataProvider.getCachedData();
      }
    }

    return pageData ? { pageData } : {};
  }

  async function getConversation({ forceFreshPageData = false } = {}) {
    if (disposed) {
      return adapter.extractConversation(null, document.title, {});
    }

    const snapshot = buildSnapshot();
    const adapterOptions = await getAdapterOptions({ forceFreshPageData });
    return adapter.extractConversation(snapshot, document.title, adapterOptions);
  }

  async function analyze() {
    if (disposed) {
      return;
    }

    const snapshot = buildSnapshot();
    const adapterOptions = await getAdapterOptions(
      getAnalyzeRefreshOptions({
        hasPageDataProvider: Boolean(pageDataProvider),
        wasGenerating: state.wasGenerating,
      }),
    );

    if (disposed) {
      return;
    }

    const isGenerating = adapter.isGenerating(snapshot, adapterOptions);
    const latestFingerprint = adapter.getLatestAssistantFingerprint(
      snapshot,
      document.title,
      adapterOptions,
    );
    const latestMarker =
      typeof adapter.getLatestAssistantMarker === "function"
        ? adapter.getLatestAssistantMarker(snapshot, document.title, adapterOptions)
        : null;
    const nextState = transitionCompletionState(state, {
      isGenerating,
      latestFingerprint,
      latestMarker,
    });

    if (nextState.shouldNotify) {
      const conversation = adapter.extractConversation(snapshot, document.title, adapterOptions);
      await sendRuntimeMessage({
        type: "MODEL_RESPONSE_COMPLETED",
        site: adapter.getSiteName(),
        conversationTitle: conversation.title,
        fingerprint: nextState.lastCompletedFingerprint,
      });
    }

    state = nextState;

    const followUpDelay = getFollowUpAnalyzeDelay(state);
    if (followUpDelay != null) {
      scheduleAnalyze(followUpDelay);
    }
  }

  function scheduleAnalyze(delayMs = 400) {
    if (disposed) {
      return;
    }

    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = window.setTimeout(() => {
      timerId = null;
      void analyze();
    }, delayMs);
  }

  const observer = new MutationObserver(() => {
    scheduleAnalyze();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const handleRuntimeMessage = (message, _sender, sendResponse) => {
    if (disposed) {
      return false;
    }

    if (message?.type === "PING_SUPPORT_STATUS") {
      void getConversation()
        .then((conversation) => {
          sendResponse({
            supported: true,
            siteName: adapter.getSiteName(),
            conversationTitle: conversation.title,
          });
        })
        .catch(() => {
          sendResponse({
            supported: true,
            siteName: adapter.getSiteName(),
            conversationTitle: document.title,
          });
        });
      return true;
    }

    if (message?.type === "EXPORT_CURRENT_CONVERSATION") {
      void getConversation({ forceFreshPageData: true })
        .then((conversation) => {
          sendResponse(conversation);
        })
        .catch(() => {
          sendResponse(null);
        });
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  void analyze();

  return {
    dispose() {
      disposed = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      observer.disconnect();
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    },
  };
}
