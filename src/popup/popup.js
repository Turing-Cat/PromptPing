import {
  buildDownloadFilename,
  buildMarkdownDownloadUrl,
  toMarkdown,
} from "../core/markdown.js";
import { isSupportedUrl } from "../adapters/index.js";

const elements = {
  eyebrow: document.querySelector("#eyebrow"),
  title: document.querySelector("#title"),
  statusText: document.querySelector("#statusText"),
  siteText: document.querySelector("#siteText"),
  exportButton: document.querySelector("#exportButton"),
};

function t(key) {
  return chrome.i18n.getMessage(key);
}

function setSupportedState({ supported, siteName = "", conversationTitle = "" }) {
  elements.eyebrow.textContent = t("popupEyebrow");
  elements.title.textContent = supported ? t("popupSupportedTitle") : t("popupUnsupportedTitle");
  elements.statusText.textContent = supported
    ? conversationTitle || t("fallbackConversationTitle")
    : t("popupUnsupportedDescription");
  elements.siteText.textContent = supported ? `${t("popupSiteLabel")}: ${siteName}` : "";
  elements.exportButton.textContent = t("popupExportButton");
  elements.exportButton.disabled = !supported;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function getSupportStatus(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "PING_SUPPORT_STATUS" });
}

async function ensureTabReady(tab) {
  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return false;
  }

  try {
    await getSupportStatus(tab.id);
    return true;
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content/index.js"],
    });
    return true;
  }
}

async function exportConversation(tabId) {
  elements.statusText.textContent = t("popupExporting");

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

  elements.statusText.textContent = t("popupDownloadStarted");
}

async function init() {
  elements.exportButton.addEventListener("click", async () => {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      return;
    }

    try {
      await exportConversation(tab.id);
    } catch (_error) {
      elements.statusText.textContent = t("popupDownloadError");
    }
  });

  try {
    const tab = await getCurrentTab();
    if (!tab?.id || !(await ensureTabReady(tab))) {
      setSupportedState({ supported: false });
      return;
    }

    const status = await getSupportStatus(tab.id);
    setSupportedState({
      supported: Boolean(status?.supported),
      siteName: status?.siteName,
      conversationTitle: status?.conversationTitle,
    });
  } catch (_error) {
    setSupportedState({ supported: false });
  }
}

init();
