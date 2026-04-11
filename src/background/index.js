import {
  createChromeNotificationOptions,
  getNotificationIconPath,
  shouldSendCompletionNotification,
} from "../core/notifications.js";
import { ensureBackgroundTabReady } from "./support.js";

const lastFingerprintByTabId = new Map();
const geminiActiveStreamCountByTabId = new Map();
const geminiRequestTabIdByRequestId = new Map();
let unreadCount = 0;
const SUPPORTED_HOST_PATTERN =
  /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|chat\.deepseek\.com|www\.deepseek\.com|gemini\.google\.com)\//i;
const GEMINI_STREAM_GENERATE_URL_FILTER = {
  urls: [
    "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate*",
  ],
};
const GEMINI_FORCE_ANALYZE_DELAYS_MS = [150, 1000, 2500, 5000];

function isSupportedUrl(url) {
  return SUPPORTED_HOST_PATTERN.test(url ?? "");
}

async function ensureContentScriptInjected(tabId) {
  if (!tabId) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content/index.js"],
  });
}

function getSupportStatus(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "PING_SUPPORT_STATUS" });
}

async function ensureSupportedTabInjected(tabId) {
  await ensureBackgroundTabReady(tabId, {
    getTab: (id) => chrome.tabs.get(id),
    isSupportedUrl,
    getSupportStatus,
    injectContentScript: ensureContentScriptInjected,
    attempts: 3,
    delayMs: 50,
  });
}

async function injectSupportedOpenTabs() {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    await ensureSupportedTabInjected(tab.id);
  }
}

function setGeminiActiveStreamCount(tabId, nextCount) {
  const normalizedCount = Math.max(0, Number(nextCount ?? 0));

  if (normalizedCount === 0) {
    geminiActiveStreamCountByTabId.delete(tabId);
    return 0;
  }

  geminiActiveStreamCountByTabId.set(tabId, normalizedCount);
  return normalizedCount;
}

function adjustGeminiActiveStreamCount(tabId, delta) {
  const currentCount = geminiActiveStreamCountByTabId.get(tabId) ?? 0;
  return setGeminiActiveStreamCount(tabId, currentCount + delta);
}

async function forwardGeminiNetworkActivity(tabId, phase, activeCount) {
  if (!tabId || tabId < 0) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "GEMINI_NETWORK_ACTIVITY",
      phase,
      activeCount,
    });
  } catch (_error) {
    // If the content script is unavailable, this transient Gemini network edge can be ignored.
  }
}

async function requestTabAnalyze(tabId) {
  if (!tabId || tabId < 0) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "FORCE_ANALYZE" });
  } catch (_error) {
    // Ignore tabs that no longer have a live content script listener.
  }
}

function scheduleGeminiForceAnalyze(tabId) {
  if (!tabId || tabId < 0) {
    return;
  }

  for (const delayMs of GEMINI_FORCE_ANALYZE_DELAYS_MS) {
    setTimeout(() => {
      void requestTabAnalyze(tabId);
    }, delayMs);
  }
}

function handleGeminiStreamStart(details) {
  if (!details?.requestId || !details?.tabId || details.tabId < 0) {
    return;
  }
  geminiRequestTabIdByRequestId.set(details.requestId, details.tabId);
  const activeCount = adjustGeminiActiveStreamCount(details.tabId, 1);
  void forwardGeminiNetworkActivity(details.tabId, "stream-start", activeCount);
}

function finalizeGeminiStream(details) {
  const requestId = details?.requestId ?? null;
  const tabId = geminiRequestTabIdByRequestId.get(requestId) ?? details?.tabId ?? null;

  if (requestId) {
    geminiRequestTabIdByRequestId.delete(requestId);
  }

  if (!tabId || tabId < 0) {
    return;
  }
  const activeCount = adjustGeminiActiveStreamCount(tabId, -1);
  void forwardGeminiNetworkActivity(tabId, "stream-end", activeCount);
  scheduleGeminiForceAnalyze(tabId);
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  return tabs[0]?.id ?? null;
}

async function notifyCompletion({
  senderTabId,
  fingerprint,
  site,
  conversationTitle,
  wasHidden = false,
}) {
  const lastFingerprint = lastFingerprintByTabId.get(senderTabId) ?? null;
  const activeTabId = await getActiveTabId();
  const shouldNotify = shouldSendCompletionNotification({
    activeTabId,
    senderTabId,
    fingerprint,
    lastFingerprint,
    wasHidden,
  });
  const debug = {
    activeTabId,
    senderTabId,
    fingerprint,
    lastFingerprint,
    wasHidden,
    shouldNotify,
    site,
    conversationTitle,
  };

  console.debug("[PromptPing:bg] notifyCompletion", debug);

  if (!shouldNotify) {
    return { notified: false, debug };
  }

  lastFingerprintByTabId.set(senderTabId, fingerprint);

  const suffix = chrome.i18n.getMessage("notificationMessageSuffix");
  const fallbackTitle = chrome.i18n.getMessage("fallbackConversationTitle");
  const message = [site, conversationTitle || fallbackTitle, suffix]
    .filter(Boolean)
    .join(" · ");

  await chrome.notifications.create(
    createChromeNotificationOptions({
      iconUrl: chrome.runtime.getURL(getNotificationIconPath()),
      title: chrome.i18n.getMessage("notificationTitle"),
      message,
    }),
  );

  unreadCount += 1;
  await chrome.action.setBadgeText({ text: String(unreadCount) });
  await chrome.action.setBadgeBackgroundColor({ color: "#0ea5e9" });

  return { notified: true, debug };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "MODEL_RESPONSE_COMPLETED") {
    void notifyCompletion({
      senderTabId: sender.tab?.id ?? null,
      fingerprint: message.fingerprint,
      site: message.site,
      conversationTitle: message.conversationTitle,
      wasHidden: message.wasHidden,
    }).then((result) => sendResponse({ ok: true, ...result }));
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  void injectSupportedOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void injectSupportedOpenTabs();
});

// Clear badge when notification is clicked
chrome.notifications.onClicked.addListener(() => {
  unreadCount = 0;
  chrome.action.setBadgeText({ text: "" });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void ensureSupportedTabInjected(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isSupportedUrl(tab?.url)) {
    void ensureContentScriptInjected(tabId);
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  handleGeminiStreamStart,
  GEMINI_STREAM_GENERATE_URL_FILTER,
);
chrome.webRequest.onCompleted.addListener(
  finalizeGeminiStream,
  GEMINI_STREAM_GENERATE_URL_FILTER,
);
chrome.webRequest.onErrorOccurred.addListener(
  finalizeGeminiStream,
  GEMINI_STREAM_GENERATE_URL_FILTER,
);
