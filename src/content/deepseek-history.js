function hasChatMessages(historyResponse) {
  return Array.isArray(historyResponse?.data?.biz_data?.chat_messages);
}

function buildHistoryUrl(location, now) {
  const pathParts = String(location?.pathname ?? "")
    .split("/")
    .filter(Boolean);
  const sessionId = pathParts[pathParts.length - 1] ?? "";
  if (!sessionId) {
    throw new Error("Missing DeepSeek session id");
  }

  const url = new URL("/api/v0/chat/history_messages", location.origin);
  url.searchParams.set("chat_session_id", sessionId);
  url.searchParams.set("v", String(now()));
  return url.toString();
}

function getAuthorizationHeaders(storage) {
  try {
    const tokenData = JSON.parse(storage.getItem("userToken") || "null");
    const token = tokenData?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (_error) {
    return {};
  }
}

export function createDeepSeekHistoryProvider({
  fetchImpl = window.fetch.bind(window),
  storage = window.localStorage,
  location = window.location,
  now = Date.now,
} = {}) {
  let cachedData = null;

  return {
    getCachedData() {
      return cachedData;
    },

    async request({ forceRefresh = false } = {}) {
      if (!forceRefresh && cachedData) {
        return cachedData;
      }

      const response = await fetchImpl(buildHistoryUrl(location, now), {
        credentials: "include",
        cache: "no-store",
        headers: getAuthorizationHeaders(storage),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek history request failed (${response.status})`);
      }

      const historyResponse = await response.json();
      if (!hasChatMessages(historyResponse)) {
        throw new Error(historyResponse?.msg || "DeepSeek history payload missing messages");
      }

      cachedData = {
        historyResponse,
        receivedAt: now(),
      };

      return cachedData;
    },
  };
}
