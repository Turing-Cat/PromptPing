function normalizePart(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function getNotificationIconPath() {
  return "assets/icon.png";
}

export function createChromeNotificationOptions({ iconUrl, title, message }) {
  return {
    type: "basic",
    iconUrl,
    title,
    message,
    priority: 2,
    requireInteraction: true,
    silent: false,
  };
}

export function createResponseFingerprint({ site, title, text }) {
  const input = [normalizePart(site), normalizePart(title), normalizePart(text)]
    .filter(Boolean)
    .join("|");

  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function shouldSendCompletionNotification({
  activeTabId,
  senderTabId,
  fingerprint,
  lastFingerprint,
  wasHidden = false,
}) {
  if (!fingerprint) {
    return false;
  }

  if (senderTabId == null) {
    return false;
  }

  if (senderTabId === activeTabId && !wasHidden) {
    return false;
  }

  return fingerprint !== lastFingerprint;
}
