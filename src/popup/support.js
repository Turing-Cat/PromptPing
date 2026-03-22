function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForSupportStatus(
  tabId,
  getSupportStatus,
  { attempts = 10, delayMs = 50 } = {},
) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await getSupportStatus(tabId);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1 && delayMs > 0) {
        await delay(delayMs);
      }
    }
  }

  throw lastError ?? new Error("Failed to read support status");
}

export async function ensureTabReady(
  tab,
  {
    isSupportedUrl,
    getSupportStatus,
    injectContentScript,
    attempts = 10,
    delayMs = 50,
  },
) {
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
