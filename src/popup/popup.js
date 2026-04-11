import {
  buildDownloadFilename,
  buildMarkdownDownloadUrl,
  toMarkdown,
} from "../core/markdown.js";
import { isSupportedUrl } from "../adapters/index.js";
import { ensureTabReady } from "./support.js";

const elements = {
  eyebrow: document.querySelector("#eyebrow"),
  title: document.querySelector("#title"),
  statusText: document.querySelector("#statusText"),
  siteText: document.querySelector("#siteText"),
  exportButton: document.querySelector("#exportButton"),
  refreshButton: document.querySelector("#refreshButton"),
  btnLabel: document.querySelector("#btnLabel"),
  statusCard: document.querySelector("#statusCard"),
  toast: document.querySelector("#toast"),
};

function t(key) {
  return chrome.i18n.getMessage(key);
}

let toastTimer = null;

function showToast(message, duration = 2500) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.setAttribute("data-visible", "");

  toastTimer = setTimeout(() => {
    elements.toast.removeAttribute("data-visible");
  }, duration);
}

function setCardState(state) {
  elements.statusCard.setAttribute("data-state", state);
}

function setSupportedState({
  supported,
  siteName = "",
  conversationTitle = "",
  exportSupported = true,
}) {
  elements.eyebrow.textContent = t("popupEyebrow");

  if (supported) {
    setCardState("supported");
    elements.title.textContent = t("popupSupportedTitle");
    elements.statusText.textContent =
      conversationTitle || t("fallbackConversationTitle");
  } else {
    setCardState("unsupported");
    elements.title.textContent = t("popupUnsupportedTitle");
    elements.statusText.textContent = t("popupUnsupportedDescription");
  }

  elements.siteText.textContent = supported
    ? `${t("popupSiteLabel")}: ${siteName}`
    : "";
  elements.btnLabel.textContent = t("popupExportButton");
  elements.exportButton.disabled = !supported || !exportSupported;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function getSupportStatus(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "PING_SUPPORT_STATUS" });
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content/index.js"],
  });
}

async function checkStatus() {
  try {
    // Show initial loading state
    elements.eyebrow.textContent = t("popupEyebrow");
    setCardState("loading");
    elements.title.textContent = t("popupLoadingTitle") || "Checking status...";
    elements.exportButton.disabled = true;
    elements.refreshButton.setAttribute("data-loading", "");

    const tab = await getCurrentTab();
    if (!tab?.id) {
      setSupportedState({ supported: false });
      return;
    }

    const status = await ensureTabReady(tab, {
      isSupportedUrl,
      getSupportStatus,
      injectContentScript,
      attempts: 8,
      delayMs: 100,
    });

    if (!status) {
      setSupportedState({ supported: false });
      return;
    }

    setSupportedState({
      supported: Boolean(status?.supported),
      siteName: status?.siteName,
      conversationTitle: status?.conversationTitle,
      exportSupported: status?.exportSupported,
    });
  } catch (_error) {
    setSupportedState({ supported: false });
  } finally {
    elements.refreshButton.removeAttribute("data-loading");
  }
}

async function exportConversation(tabId) {
  setCardState("loading");
  elements.exportButton.setAttribute("data-loading", "");
  elements.btnLabel.textContent = t("popupExporting");

  try {
    const conversation = await chrome.tabs.sendMessage(tabId, {
      type: "EXPORT_CURRENT_CONVERSATION",
    });

    const markdown = toMarkdown(conversation);
    const downloadUrl = buildMarkdownDownloadUrl(markdown);
    const filename = buildDownloadFilename({
      site: conversation.site,
      title: conversation.title,
    });

    await chrome.downloads.download({
      url: downloadUrl,
      filename,
      saveAs: true,
    });

    setCardState("success");
    elements.statusText.textContent = t("popupDownloadStarted");
    showToast(t("popupDownloadStarted"));
  } catch (_error) {
    setCardState("error");
    elements.statusText.textContent = t("popupDownloadError");
    showToast(t("popupDownloadError"));
  } finally {
    elements.exportButton.removeAttribute("data-loading");
    elements.btnLabel.textContent = t("popupExportButton");
  }
}

async function init() {
  // Clear toolbar badge when popup opens
  chrome.action.setBadgeText({ text: "" });

  elements.exportButton.addEventListener("click", async () => {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      return;
    }

    await exportConversation(tab.id);
  });

  elements.refreshButton.addEventListener("click", () => {
    checkStatus();
  });

  checkStatus();
}

init();
