import { getAdapterForUrl } from "../adapters/index.js";
import { createDomSnapshot } from "../core/snapshot.js";
import { transitionCompletionState } from "./completion-tracker.js";

function sendRuntimeMessage(message) {
  return chrome.runtime.sendMessage(message).catch(() => null);
}

export function bootContentScript() {
  const adapter = getAdapterForUrl(window.location.href);
  if (!adapter || !document.body) {
    return;
  }

  let state = {
    wasGenerating: false,
    lastCompletedFingerprint: null,
  };

  let timerId = null;

  function buildSnapshot() {
    return createDomSnapshot(document.body);
  }

  function getConversation() {
    return adapter.extractConversation(buildSnapshot(), document.title);
  }

  async function analyze() {
    const snapshot = buildSnapshot();
    const nextState = transitionCompletionState(state, {
      isGenerating: adapter.isGenerating(snapshot),
      latestFingerprint: adapter.getLatestAssistantFingerprint(snapshot, document.title),
    });

    if (nextState.shouldNotify) {
      const conversation = adapter.extractConversation(snapshot, document.title);
      await sendRuntimeMessage({
        type: "MODEL_RESPONSE_COMPLETED",
        site: adapter.getSiteName(),
        conversationTitle: conversation.title,
        fingerprint: nextState.lastCompletedFingerprint,
      });
    }

    state = nextState;
  }

  function scheduleAnalyze() {
    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = window.setTimeout(() => {
      timerId = null;
      void analyze();
    }, 400);
  }

  const observer = new MutationObserver(() => {
    scheduleAnalyze();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING_SUPPORT_STATUS") {
      const conversation = getConversation();
      sendResponse({
        supported: true,
        siteName: adapter.getSiteName(),
        conversationTitle: conversation.title,
      });
      return false;
    }

    if (message?.type === "EXPORT_CURRENT_CONVERSATION") {
      sendResponse(getConversation());
      return false;
    }

    return false;
  });

  void analyze();
}

