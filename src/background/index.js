import { shouldSendCompletionNotification } from "../core/notifications.js";

const lastFingerprintByTabId = new Map();
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

  if (
    !shouldSendCompletionNotification({
      activeTabId,
      senderTabId,
      fingerprint,
      lastFingerprint,
    })
  ) {
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
    iconUrl: chrome.runtime.getURL("assets/icon.svg"),
    title: chrome.i18n.getMessage("notificationTitle"),
    message,
  });
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
