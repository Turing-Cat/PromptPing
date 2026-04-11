import { getAdapterForUrl } from "../adapters/index.js";
import { createDomSnapshot } from "../core/snapshot.js";
import { createDeepSeekHistoryProvider } from "./deepseek-history.js";
import { transitionCompletionState } from "./completion-tracker.js";

export const DEEPSEEK_GENERATION_POLL_DELAY_MS = 1000;
export const GEMINI_NETWORK_END_ANALYZE_DELAY_MS = 75;
export const GEMINI_NETWORK_IDLE_OVERRIDE_MS = 10000;
const DEBUG_PREFIX = "[PromptPing]";

function debugLog(message, payload) {
  if (payload === undefined) {
    console.debug(DEBUG_PREFIX, message);
    return;
  }

  console.debug(DEBUG_PREFIX, message, payload);
}

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
  if (typeof state?.followUpDelayMs === "number") {
    return state.followUpDelayMs;
  }

  return state?.wasGenerating ? DEEPSEEK_GENERATION_POLL_DELAY_MS : null;
}

export function getResumeAnalyzeDelay(visibilityState) {
  return visibilityState === "visible" ? 0 : null;
}

export function getMutationObserverOptions() {
  return {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "aria-label",
      "title",
      "class",
      "data-testid",
      "data-test-id",
      "testid",
      "id",
      "role",
      "data-role",
      "data-message-role",
      "data-response-role",
    ],
  };
}

export function getNextGenerationHiddenState({
  wasHiddenDuringGeneration,
  visibilityState,
  nextWasGenerating,
  shouldNotify,
}) {
  const isCurrentlyHidden = visibilityState !== "visible";

  if (shouldNotify || !nextWasGenerating) {
    return isCurrentlyHidden;
  }

  return wasHiddenDuringGeneration || isCurrentlyHidden;
}

export function getHiddenStateAfterVisibilityChange({
  wasHiddenDuringGeneration,
  visibilityState,
  wasGenerating,
}) {
  if (visibilityState !== "visible") {
    return true;
  }

  return wasGenerating ? wasHiddenDuringGeneration : false;
}

function sendRuntimeMessage(message) {
  try {
    return Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => null);
  } catch (_error) {
    return Promise.resolve(null);
  }
}

export function isGeminiNetworkActivityMessage(message) {
  return (
    message?.type === "GEMINI_NETWORK_ACTIVITY" &&
    (message.phase === "stream-start" || message.phase === "stream-end")
  );
}

export function getGeminiNetworkAnalyzeDelay(phase) {
  return phase === "stream-end" ? GEMINI_NETWORK_END_ANALYZE_DELAY_MS : 0;
}

export function bootContentScript() {
  const adapter = getAdapterForUrl(window.location.href);
  if (!adapter || !document.body) {
    return null;
  }

  const instanceId = Math.random().toString(36).slice(2, 8);

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
  let wasHiddenDuringGeneration = document.visibilityState !== "visible";
  let geminiNetworkGenerationCount = 0;
  let geminiNetworkIdleOverrideUntil = 0;

  debugLog("boot", {
    instanceId,
    site: adapter.getSiteName(),
    visibilityState: document.visibilityState,
  });

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
      return null;
    }

    const analyzeObservedHidden =
      wasHiddenDuringGeneration || document.visibilityState !== "visible";

    const snapshot = buildSnapshot();
    const adapterOptions = await getAdapterOptions(
      getAnalyzeRefreshOptions({
        hasPageDataProvider: Boolean(pageDataProvider),
        wasGenerating: state.wasGenerating,
      }),
    );
    const runtimeAdapterOptions = {
      ...adapterOptions,
      networkGenerationActive: geminiNetworkGenerationCount > 0,
      networkGenerationIdleOverrideActive:
        Date.now() < geminiNetworkIdleOverrideUntil,
    };

    if (disposed) {
      return null;
    }

    const completionInput =
      typeof adapter.getCompletionStateInput === "function"
        ? adapter.getCompletionStateInput(snapshot, document.title, runtimeAdapterOptions)
        : {
            isGenerating: adapter.isGenerating(snapshot, runtimeAdapterOptions),
            latestFingerprint: adapter.getLatestAssistantFingerprint(
              snapshot,
              document.title,
              runtimeAdapterOptions,
            ),
            latestMarker:
              typeof adapter.getLatestAssistantMarker === "function"
                ? adapter.getLatestAssistantMarker(
                    snapshot,
                    document.title,
                    runtimeAdapterOptions,
                  )
                : null,
          };
    const nextState =
      typeof adapter.transitionCompletionState === "function"
        ? adapter.transitionCompletionState(state, completionInput)
        : transitionCompletionState(state, completionInput);
    const latestFingerprint = completionInput.latestFingerprint ?? null;
    const latestMarker =
      completionInput.latestMarker ?? completionInput.latestUserTurnMarker ?? null;
    const isGenerating = Boolean(completionInput.isGenerating);

    if (
      nextState.shouldNotify ||
      state.wasGenerating !== nextState.wasGenerating ||
      state.lastCompletedMarker !== nextState.lastCompletedMarker
    ) {
      debugLog("analyze", {
        instanceId,
        site: adapter.getSiteName(),
        isGenerating,
        latestFingerprint,
        latestMarker,
        previousWasGenerating: state.wasGenerating,
        previousCompletedFingerprint: state.lastCompletedFingerprint,
        previousCompletedMarker: state.lastCompletedMarker,
        previousObservedMarker: state.lastObservedMarker,
        nextWasGenerating: nextState.wasGenerating,
        nextCompletedFingerprint: nextState.lastCompletedFingerprint,
        nextCompletedMarker: nextState.lastCompletedMarker,
        nextObservedMarker: nextState.lastObservedMarker,
        nextShouldNotify: nextState.shouldNotify,
        analyzeObservedHidden,
      });
    }

    if (nextState.shouldNotify) {
      const conversation = adapter.extractConversation(
        snapshot,
        document.title,
        runtimeAdapterOptions,
      );
      const response = await sendRuntimeMessage({
        type: "MODEL_RESPONSE_COMPLETED",
        site: adapter.getSiteName(),
        conversationTitle: conversation.title,
        fingerprint: nextState.lastCompletedFingerprint,
        wasHidden: analyzeObservedHidden,
      });
      debugLog("MODEL_RESPONSE_COMPLETED", {
        instanceId,
        site: adapter.getSiteName(),
        conversationTitle: conversation.title,
        fingerprint: nextState.lastCompletedFingerprint,
        wasHidden: analyzeObservedHidden,
        response,
      });
      debugLog(
        "MODEL_RESPONSE_COMPLETED_JSON",
        JSON.stringify({
          instanceId,
          site: adapter.getSiteName(),
          conversationTitle: conversation.title,
          fingerprint: nextState.lastCompletedFingerprint,
          wasHidden: analyzeObservedHidden,
          response,
        }),
      );
    }

    state = nextState;
    wasHiddenDuringGeneration = getNextGenerationHiddenState({
      wasHiddenDuringGeneration,
      visibilityState: document.visibilityState,
      nextWasGenerating: nextState.wasGenerating,
      shouldNotify: nextState.shouldNotify,
    });

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

  function handleGeminiNetworkActivity(message) {
    if (!isGeminiNetworkActivityMessage(message)) {
      return;
    }

    geminiNetworkGenerationCount = Math.max(0, Number(message.activeCount ?? 0));
    if (message.phase === "stream-start") {
      geminiNetworkIdleOverrideUntil = 0;
    } else if (geminiNetworkGenerationCount === 0) {
      geminiNetworkIdleOverrideUntil = Date.now() + GEMINI_NETWORK_IDLE_OVERRIDE_MS;
    }
    debugLog("gemini-network", {
      instanceId,
      phase: message.phase,
      activeCount: geminiNetworkGenerationCount,
      idleOverrideActive: Date.now() < geminiNetworkIdleOverrideUntil,
      visibilityState: document.visibilityState,
    });
    scheduleAnalyze(getGeminiNetworkAnalyzeDelay(message.phase));
  }

  function scheduleResumeAnalyze() {
    const delay = getResumeAnalyzeDelay(document.visibilityState);
    if (delay != null) {
      scheduleAnalyze(delay);
    }
  }

  function handleVisibilityChange() {
    wasHiddenDuringGeneration = getHiddenStateAfterVisibilityChange({
      wasHiddenDuringGeneration,
      visibilityState: document.visibilityState,
      wasGenerating: state.wasGenerating,
    });

    debugLog("visibilitychange", {
      instanceId,
      visibilityState: document.visibilityState,
      wasHiddenDuringGeneration,
      wasGenerating: state.wasGenerating,
    });

    if (document.visibilityState !== "visible") {
      return;
    }

    scheduleResumeAnalyze();
  }

  observer.observe(document.body, getMutationObserverOptions());

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", scheduleResumeAnalyze);
  window.addEventListener("pageshow", scheduleResumeAnalyze);

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
            exportSupported: adapter.supportsExport?.() ?? true,
          });
        })
        .catch(() => {
          sendResponse({
            supported: true,
            siteName: adapter.getSiteName(),
            conversationTitle: document.title,
            exportSupported: adapter.supportsExport?.() ?? true,
          });
        });
      return true;
    }

    if (message?.type === "EXPORT_CURRENT_CONVERSATION") {
      if (adapter.supportsExport?.() === false) {
        sendResponse(null);
        return false;
      }

      void getConversation({ forceFreshPageData: true })
        .then((conversation) => {
          sendResponse(conversation);
        })
        .catch(() => {
          sendResponse(null);
        });
      return true;
    }

    if (message?.type === "FORCE_ANALYZE") {
      void analyze().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (isGeminiNetworkActivityMessage(message)) {
      handleGeminiNetworkActivity(message);
      return false;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  void analyze();

  return {
    dispose() {
      debugLog("dispose", { instanceId, site: adapter.getSiteName() });
      disposed = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", scheduleResumeAnalyze);
      window.removeEventListener("pageshow", scheduleResumeAnalyze);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    },
  };
}
