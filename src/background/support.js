import { waitForSupportStatus } from "../popup/support.js";

export async function ensureBackgroundTabReady(
  tabId,
  {
    getTab,
    isSupportedUrl,
    getSupportStatus,
    injectContentScript,
    attempts = 10,
    delayMs = 50,
  },
) {
  if (!tabId) {
    return null;
  }

  let tab = null;
  try {
    tab = await getTab(tabId);
  } catch (_error) {
    return null;
  }

  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return null;
  }

  try {
    return await getSupportStatus(tab.id);
  } catch (_error) {
    await injectContentScript(tab.id);
    return waitForSupportStatus(tab.id, getSupportStatus, {
      attempts,
      delayMs,
    });
  }
}
