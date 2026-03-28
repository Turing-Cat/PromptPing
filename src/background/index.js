import {
  getNotificationIconPath,
  shouldSendCompletionNotification,
} from "../core/notifications.js";

const lastFingerprintByTabId = new Map();
let unreadCount = 0;
const SUPPORTED_HOST_PATTERN =
  /^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|chat\.deepseek\.com|www\.deepseek\.com)\//i;

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

async function ensureSupportedTabInjected(tabId) {
  if (!tabId) {
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (isSupportedUrl(tab?.url)) {
      await ensureContentScriptInjected(tabId);
    }
  } catch (_error) {
    // Ignore tabs that disappear during async activation/update handling.
  }
}

async function injectSupportedOpenTabs() {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.id && isSupportedUrl(tab.url)) {
      await ensureContentScriptInjected(tab.id);
    }
  }
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  return tabs[0]?.id ?? null;
}

async function notifyCompletion({ senderTabId, fingerprint, site, conversationTitle }) {
  const lastFingerprint = lastFingerprintByTabId.get(senderTabId) ?? null;
  const activeTabId = await getActiveTabId();
  const shouldNotify = shouldSendCompletionNotification({
    activeTabId,
    senderTabId,
    fingerprint,
    lastFingerprint,
  });

  if (!shouldNotify) {
    return;
  }

  lastFingerprintByTabId.set(senderTabId, fingerprint);

  const suffix = chrome.i18n.getMessage("notificationMessageSuffix");
  const fallbackTitle = chrome.i18n.getMessage("fallbackConversationTitle");
  const message = [site, conversationTitle || fallbackTitle, suffix]
    .filter(Boolean)
    .join(" · ");

  await chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL(getNotificationIconPath()),
    title: chrome.i18n.getMessage("notificationTitle"),
    message,
  });

  unreadCount += 1;
  await chrome.action.setBadgeText({ text: String(unreadCount) });
  await chrome.action.setBadgeBackgroundColor({ color: "#c44b2d" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "MODEL_RESPONSE_COMPLETED") {
    void notifyCompletion({
      senderTabId: sender.tab?.id ?? null,
      fingerprint: message.fingerprint,
      site: message.site,
      conversationTitle: message.conversationTitle,
    }).then(() => sendResponse({ ok: true }));
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
