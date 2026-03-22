(() => {
  // src/content/boot-instance.js
  var INSTANCE_KEY = "__promptPingContentScriptInstance__";
  function replaceContentScriptInstance({
    globalObject = globalThis,
    bootContentScript: bootContentScript2
  }) {
    globalObject[INSTANCE_KEY]?.dispose?.();
    const instance = bootContentScript2?.() ?? null;
    if (instance) {
      globalObject[INSTANCE_KEY] = instance;
      return instance;
    }
    delete globalObject[INSTANCE_KEY];
    return null;
  }

  // src/core/snapshot.js
  function collapseWhitespace(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }
  var KNOWN_SITE_SUFFIXES = ["ChatGPT", "Claude", "DeepSeek"];
  function collectText(node, parts) {
    if (!node) {
      return;
    }
    if (node.type === "text") {
      if (node.text) {
        parts.push(node.text);
      }
      return;
    }
    for (const child of node.children ?? []) {
      collectText(child, parts);
    }
  }
  function createDomSnapshot(node) {
    if (!node) {
      return null;
    }
    if (node.nodeType === 3) {
      return {
        type: "text",
        text: node.textContent ?? ""
      };
    }
    if (node.nodeType !== 1) {
      return null;
    }
    const tagName = node.tagName.toLowerCase();
    if (["script", "style", "noscript"].includes(tagName)) {
      return null;
    }
    const attrs = {};
    for (const attribute of node.attributes ?? []) {
      attrs[attribute.name] = attribute.value;
    }
    return {
      type: "element",
      tagName,
      attrs,
      classList: Array.from(node.classList ?? []),
      children: Array.from(node.childNodes ?? []).map((child) => createDomSnapshot(child)).filter(Boolean)
    };
  }
  function findAllElements(node, predicate, options = {}) {
    const matches = [];
    const stopOnMatch = options.stopOnMatch ?? false;
    function visit(current) {
      if (!current || current.type !== "element") {
        return;
      }
      const matched = predicate(current);
      if (matched) {
        matches.push(current);
        if (stopOnMatch) {
          return;
        }
      }
      for (const child of current.children ?? []) {
        visit(child);
      }
    }
    visit(node);
    return matches;
  }
  function findFirstElement(node, predicate) {
    return findAllElements(node, predicate, { stopOnMatch: true })[0] ?? null;
  }
  function getAttribute(node, name) {
    return node?.attrs?.[name] ?? null;
  }
  function hasClass(node, className) {
    return Array.isArray(node?.classList) && node.classList.includes(className);
  }
  function getTextContent(node) {
    const parts = [];
    collectText(node, parts);
    return collapseWhitespace(parts.join(" "));
  }
  function getAccessibleText(node) {
    return collapseWhitespace(
      [
        getTextContent(node),
        getAttribute(node, "aria-label"),
        getAttribute(node, "title")
      ].filter(Boolean).join(" ")
    );
  }
  function sanitizeConversationTitle(title) {
    const normalized = collapseWhitespace(title);
    if (!normalized) {
      return "Conversation";
    }
    const sitePattern = KNOWN_SITE_SUFFIXES.join("|");
    return normalized.replace(new RegExp(`\\s*[-|]\\s*(${sitePattern})\\s*$`, "i"), "").trim();
  }

  // src/core/notifications.js
  function normalizePart(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  function createResponseFingerprint({ site, title, text }) {
    const input = [normalizePart(site), normalizePart(title), normalizePart(text)].filter(Boolean).join("|");
    let hash = 2166136261;
    for (const char of input) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  // src/adapters/shared.js
  function extractLanguage(node) {
    const attrLanguage = getAttribute(node, "data-language") || getAttribute(node, "data-code-language");
    if (attrLanguage) {
      return attrLanguage;
    }
    const classNames = [
      ...node.classList ?? [],
      ...String(getAttribute(node, "class") ?? "").split(/\s+/).filter(Boolean)
    ];
    for (const className of classNames) {
      if (className.startsWith("language-")) {
        return className.slice("language-".length);
      }
    }
    return "";
  }
  function directChildren(node, tagName) {
    return (node.children ?? []).filter(
      (child) => child.type === "element" && child.tagName === tagName
    );
  }
  function collectBlocks(node, blocks) {
    for (const child of node.children ?? []) {
      if (child.type !== "element") {
        continue;
      }
      if (child.tagName === "pre") {
        const codeNode = findFirstElement(child, (entry) => entry.tagName === "code") ?? child;
        blocks.push({
          type: "code",
          language: extractLanguage(codeNode),
          text: getTextContent(codeNode)
        });
        continue;
      }
      if (child.tagName === "ul" || child.tagName === "ol") {
        const items = directChildren(child, "li").map((entry) => getTextContent(entry)).filter(Boolean);
        if (items.length) {
          blocks.push({
            type: "list",
            items
          });
        }
        continue;
      }
      if (["p", "blockquote", "h1", "h2", "h3", "h4"].includes(child.tagName)) {
        const text = getTextContent(child);
        if (text) {
          blocks.push({
            type: "paragraph",
            text
          });
        }
        continue;
      }
      collectBlocks(child, blocks);
    }
  }
  function extractBlocks(node) {
    const blocks = [];
    collectBlocks(node, blocks);
    if (!blocks.length) {
      const text = getTextContent(node);
      if (text) {
        blocks.push({
          type: "paragraph",
          text
        });
      }
    }
    return blocks;
  }
  function createConversation(siteName, title, messages) {
    return {
      site: siteName,
      title: sanitizeConversationTitle(title),
      messages: messages.filter(
        (message) => Array.isArray(message.blocks) && message.blocks.some((block) => {
          if (block.type === "list") {
            return (block.items ?? []).length > 0;
          }
          return Boolean(block.text);
        })
      )
    };
  }
  function findTitle(snapshot, pageTitle) {
    const heading = findFirstElement(snapshot, (node) => node.tagName === "h1");
    return sanitizeConversationTitle(getTextContent(heading) || pageTitle);
  }
  function fingerprintLatestAssistant(conversation) {
    const message = [...conversation.messages ?? []].reverse().find((entry) => entry.role === "assistant");
    if (!message) {
      return null;
    }
    const text = message.blocks.map(
      (block) => block.type === "list" ? (block.items ?? []).join(" ") : block.text ?? ""
    ).join(" ").trim();
    if (!text) {
      return null;
    }
    return createResponseFingerprint({
      site: conversation.site,
      title: conversation.title,
      text
    });
  }
  function findMessages(snapshot, roleResolver) {
    return findAllElements(
      snapshot,
      (node) => roleResolver(node) !== null,
      { stopOnMatch: true }
    ).map((node) => ({
      role: roleResolver(node),
      blocks: extractBlocks(node)
    }));
  }

  // src/adapters/chatgpt.js
  function resolveRole(node) {
    const role = getAttribute(node, "data-message-author-role");
    return role === "user" || role === "assistant" ? role : null;
  }
  var STOP_TEXT_FRAGMENTS = [
    "stop generating",
    "stop responding",
    "\u505C\u6B62\u751F\u6210",
    "\u505C\u6B62\u56DE\u5E94",
    "\u505C\u6B62\u56DE\u590D"
  ];
  function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  function hasStructuralStopSignal(button) {
    const identifiers = [
      getAttribute(button, "data-testid"),
      getAttribute(button, "testid"),
      getAttribute(button, "data-test-id")
    ].map(normalizeText).filter(Boolean);
    return identifiers.some((value) => value.includes("stop"));
  }
  function hasLocalizedStopText(button) {
    const text = normalizeText(getAccessibleText(button));
    return STOP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
  }
  function hasStopControl(snapshot) {
    return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
      if (hasStructuralStopSignal(button)) {
        return true;
      }
      return hasLocalizedStopText(button);
    });
  }
  var ChatGPTAdapter = {
    matchesLocation(url) {
      return /https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(url);
    },
    getSiteName() {
      return "ChatGPT";
    },
    extractConversation(snapshot, pageTitle = "ChatGPT") {
      return createConversation(
        "ChatGPT",
        findTitle(snapshot, pageTitle),
        findMessages(snapshot, resolveRole)
      );
    },
    isGenerating(snapshot) {
      return hasStopControl(snapshot);
    },
    getLatestAssistantFingerprint(snapshot, pageTitle = "ChatGPT") {
      return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
    }
  };

  // src/adapters/claude.js
  function resolveRole2(node) {
    const testId = getAttribute(node, "data-testid");
    if (testId?.startsWith("user-message")) {
      return "user";
    }
    if (testId?.startsWith("assistant-message") || hasClass(node, "font-claude-response")) {
      return "assistant";
    }
    return null;
  }
  function hasStopControl2(snapshot) {
    return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
      const text = getTextContent(button).toLowerCase();
      return text.includes("stop response") || text.includes("stop responding");
    });
  }
  var ClaudeAdapter = {
    matchesLocation(url) {
      return /https:\/\/claude\.ai\//i.test(url);
    },
    getSiteName() {
      return "Claude";
    },
    extractConversation(snapshot, pageTitle = "Claude") {
      return createConversation(
        "Claude",
        findTitle(snapshot, pageTitle),
        findMessages(snapshot, resolveRole2)
      );
    },
    isGenerating(snapshot) {
      return hasStopControl2(snapshot);
    },
    getLatestAssistantFingerprint(snapshot, pageTitle = "Claude") {
      return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle));
    }
  };

  // src/adapters/deepseek.js
  var USER_MESSAGE_CLASSES = ["_9663006"];
  var USER_CONTENT_CLASSES = ["fbb737a4"];
  var ASSISTANT_MESSAGE_CLASSES = ["_4f9bf79"];
  var ASSISTANT_CONTENT_CLASSES = ["ds-markdown"];
  var BUTTON_CLASS_NAMES = ["ds-icon-button"];
  function getClassTokens(node) {
    return [
      ...node.classList ?? [],
      ...String(getAttribute(node, "class") ?? "").split(/\s+/).filter(Boolean)
    ];
  }
  function hasClassToken(node, token) {
    return getClassTokens(node).includes(token);
  }
  function hasRoleToken(value, token) {
    return String(value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).includes(token);
  }
  function normalizeText2(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  var STOP_TEXT_FRAGMENTS2 = [
    "stop generating",
    "stop response",
    "stop responding",
    "\u505C\u6B62\u751F\u6210",
    "\u505C\u6B62\u56DE\u590D",
    "\u505C\u6B62\u56DE\u7B54"
  ];
  function hasStructuralStopSignal2(button) {
    const identifiers = [
      getAttribute(button, "data-testid"),
      getAttribute(button, "testid"),
      getAttribute(button, "data-test-id"),
      getAttribute(button, "id")
    ].map(normalizeText2).filter(Boolean);
    return identifiers.some(
      (value) => value.includes("stop") || value.includes("abort") || value.includes("cancel")
    );
  }
  function hasStopIconLabel(node) {
    const iconNodes = findAllElements(
      node,
      (entry) => ["rect", "path", "svg", "span", "div"].includes(entry.tagName)
    );
    return iconNodes.some((entry) => {
      const iconText = normalizeText2(
        [
          getAttribute(entry, "id"),
          getAttribute(entry, "aria-label"),
          getAttribute(entry, "title"),
          getTextContent(entry)
        ].filter(Boolean).join(" ")
      );
      return STOP_TEXT_FRAGMENTS2.some((fragment) => iconText.includes(fragment));
    });
  }
  function resolveRole3(node) {
    const attrCandidates = [
      getAttribute(node, "data-role"),
      getAttribute(node, "data-message-role"),
      getAttribute(node, "role"),
      getAttribute(node, "data-testid")
    ];
    for (const candidate of attrCandidates) {
      if (hasRoleToken(candidate, "user")) {
        return "user";
      }
      if (hasRoleToken(candidate, "assistant")) {
        return "assistant";
      }
    }
    if (USER_MESSAGE_CLASSES.some((className) => hasClassToken(node, className))) {
      return "user";
    }
    if (ASSISTANT_MESSAGE_CLASSES.some((className) => hasClassToken(node, className))) {
      return "assistant";
    }
    const classNames = getClassTokens(node).join(" ").toLowerCase();
    if (classNames.includes("assistant")) {
      return "assistant";
    }
    if (classNames.includes("user")) {
      return "user";
    }
    return null;
  }
  function hasStopControl3(snapshot) {
    return findAllElements(
      snapshot,
      (node) => node.tagName === "button" || getAttribute(node, "role") === "button" || BUTTON_CLASS_NAMES.some((className) => hasClassToken(node, className))
    ).some((button) => {
      if (hasStructuralStopSignal2(button) || hasStopIconLabel(button)) {
        return true;
      }
      const text = normalizeText2(getAccessibleText(button));
      return STOP_TEXT_FRAGMENTS2.some((fragment) => text.includes(fragment));
    });
  }
  function getHistoryResponse(options) {
    return options?.pageData?.historyResponse ?? null;
  }
  function normalizeHistoryText(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeHistoryText(entry)).filter(Boolean).join("\n\n").trim();
    }
    if (!value || typeof value !== "object") {
      return "";
    }
    for (const key of ["content", "text", "markdown", "value"]) {
      const text = normalizeHistoryText(value[key]);
      if (text) {
        return text;
      }
    }
    return "";
  }
  function collectFragmentText(fragments, allowedTypes) {
    return (fragments ?? []).filter((fragment) => allowedTypes.includes(fragment?.type)).map((fragment) => fragment?.content ?? "").join("").trim();
  }
  function extractHistoryMessageContent(message) {
    const content = normalizeHistoryText(message?.content);
    if (content) {
      return content;
    }
    const role = String(message?.role ?? "").toUpperCase() === "ASSISTANT" ? "assistant" : "user";
    return collectFragmentText(
      message?.fragments,
      role === "assistant" ? ["RESPONSE"] : ["REQUEST", "RESPONSE"]
    );
  }
  function createBlocksFromHistoryMessage(message) {
    const content = extractHistoryMessageContent(message);
    if (!content) {
      return [];
    }
    return [{ type: "paragraph", text: content }];
  }
  function getHistoryMessages(historyResponse) {
    const chatMessages = historyResponse?.data?.biz_data?.chat_messages;
    if (!Array.isArray(chatMessages)) {
      return [];
    }
    return [...chatMessages].sort((left, right) => {
      const leftOrder = Number(left?.message_id ?? left?.inserted_at ?? 0);
      const rightOrder = Number(right?.message_id ?? right?.inserted_at ?? 0);
      return leftOrder - rightOrder;
    });
  }
  function getLatestAssistantHistoryMessage(historyResponse) {
    return [...getHistoryMessages(historyResponse)].reverse().find((message) => String(message?.role ?? "").toUpperCase() === "ASSISTANT");
  }
  function isHistoryGenerating(historyResponse) {
    const latestMessage = [...getHistoryMessages(historyResponse)].reverse().find((message) => message?.role);
    const status = normalizeText2(latestMessage?.status);
    if (!status) {
      return false;
    }
    return !["finished", "completed", "done", "success"].includes(status);
  }
  function extractConversationFromHistoryResponse(historyResponse, pageTitle) {
    const bizData = historyResponse?.data?.biz_data;
    const chatMessages = getHistoryMessages(historyResponse);
    if (chatMessages.length === 0) {
      return null;
    }
    return createConversation(
      "DeepSeek",
      bizData?.chat_session?.title || pageTitle,
      chatMessages.map((message) => ({
        role: String(message?.role ?? "").toUpperCase() === "ASSISTANT" ? "assistant" : "user",
        blocks: createBlocksFromHistoryMessage(message)
      }))
    );
  }
  function findContentNode(node, classNames) {
    for (const className of classNames) {
      const match = findAllElements(node, (entry) => hasClassToken(entry, className), {
        stopOnMatch: true
      })[0] ?? null;
      if (match) {
        return match;
      }
    }
    return node;
  }
  function extractStructuredMessages(snapshot) {
    return findAllElements(
      snapshot,
      (node) => resolveRole3(node) !== null,
      { stopOnMatch: true }
    ).map((node) => {
      const role = resolveRole3(node);
      const contentNode = role === "assistant" ? findContentNode(node, ASSISTANT_CONTENT_CLASSES) : findContentNode(node, USER_CONTENT_CLASSES);
      return {
        role,
        blocks: extractBlocks(contentNode)
      };
    });
  }
  var DeepSeekAdapter = {
    matchesLocation(url) {
      return /https:\/\/(chat\.deepseek\.com|www\.deepseek\.com)\//i.test(url);
    },
    getSiteName() {
      return "DeepSeek";
    },
    extractConversation(snapshot, pageTitle = "DeepSeek", options = {}) {
      const historyConversation = extractConversationFromHistoryResponse(
        getHistoryResponse(options),
        pageTitle
      );
      if (historyConversation) {
        return historyConversation;
      }
      const conversation = createConversation(
        "DeepSeek",
        findTitle(snapshot, pageTitle),
        extractStructuredMessages(snapshot)
      );
      if (conversation.messages.length > 0) {
        return conversation;
      }
      const messageNodes = findAllElements(snapshot, (node) => {
        const classNames = (node.classList ?? []).join(" ").toLowerCase();
        return classNames.includes("message") || classNames.includes("markdown");
      });
      const messages = messageNodes.map((node) => {
        const text = getTextContent(node).toLowerCase();
        if (!text) {
          return null;
        }
        return {
          role: text.includes("assistant") ? "assistant" : "user",
          blocks: [{ type: "paragraph", text: getTextContent(node) }]
        };
      }).filter(Boolean);
      return createConversation("DeepSeek", findTitle(snapshot, pageTitle), messages);
    },
    isGenerating(snapshot, options = {}) {
      return hasStopControl3(snapshot) || isHistoryGenerating(getHistoryResponse(options));
    },
    getLatestAssistantFingerprint(snapshot, pageTitle = "DeepSeek", options = {}) {
      return fingerprintLatestAssistant(this.extractConversation(snapshot, pageTitle, options));
    },
    getLatestAssistantMarker(_snapshot, _pageTitle = "DeepSeek", options = {}) {
      const latestAssistantMessage = getLatestAssistantHistoryMessage(getHistoryResponse(options));
      if (!latestAssistantMessage) {
        return null;
      }
      return String(
        latestAssistantMessage.message_id ?? latestAssistantMessage.inserted_at ?? latestAssistantMessage.id ?? ""
      );
    }
  };

  // src/adapters/index.js
  var ADAPTERS = [ChatGPTAdapter, ClaudeAdapter, DeepSeekAdapter];
  function getAdapterForUrl(url) {
    return ADAPTERS.find((adapter) => adapter.matchesLocation(url)) ?? null;
  }

  // src/content/deepseek-history.js
  function hasChatMessages(historyResponse) {
    return Array.isArray(historyResponse?.data?.biz_data?.chat_messages);
  }
  function buildHistoryUrl(location, now) {
    const pathParts = String(location?.pathname ?? "").split("/").filter(Boolean);
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
  function createDeepSeekHistoryProvider({
    fetchImpl = window.fetch.bind(window),
    storage = window.localStorage,
    location = window.location,
    now = Date.now
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
          headers: getAuthorizationHeaders(storage)
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
          receivedAt: now()
        };
        return cachedData;
      }
    };
  }

  // src/content/completion-tracker.js
  function transitionCompletionState(previousState, currentState) {
    const previousCompletedFingerprint = previousState.lastCompletedFingerprint ?? null;
    const previousCompletedMarker = previousState.lastCompletedMarker ?? null;
    const previousObservedMarker = previousState.lastObservedMarker ?? null;
    const latestFingerprint = currentState.latestFingerprint ?? null;
    const latestMarker = currentState.latestMarker ?? null;
    if (currentState.isGenerating) {
      return {
        wasGenerating: true,
        lastCompletedFingerprint: previousCompletedFingerprint,
        lastCompletedMarker: previousCompletedMarker,
        lastObservedMarker: latestMarker ?? previousObservedMarker,
        shouldNotify: false
      };
    }
    if (latestMarker) {
      if (!previousCompletedMarker) {
        return {
          wasGenerating: false,
          lastCompletedFingerprint: latestFingerprint,
          lastCompletedMarker: latestMarker,
          lastObservedMarker: latestMarker,
          shouldNotify: false
        };
      }
      const shouldNotify2 = latestMarker !== previousCompletedMarker && (previousState.wasGenerating || latestMarker !== previousObservedMarker);
      return {
        wasGenerating: false,
        lastCompletedFingerprint: latestMarker !== previousCompletedMarker ? latestFingerprint : previousCompletedFingerprint,
        lastCompletedMarker: latestMarker !== previousCompletedMarker ? latestMarker : previousCompletedMarker,
        lastObservedMarker: latestMarker,
        shouldNotify: shouldNotify2
      };
    }
    const shouldNotify = previousState.wasGenerating && Boolean(latestFingerprint) && latestFingerprint !== previousCompletedFingerprint;
    return {
      wasGenerating: false,
      lastCompletedFingerprint: shouldNotify ? latestFingerprint : previousCompletedFingerprint,
      lastCompletedMarker: previousCompletedMarker,
      lastObservedMarker: previousObservedMarker,
      shouldNotify
    };
  }

  // src/content/runtime.js
  var DEEPSEEK_GENERATION_POLL_DELAY_MS = 1e3;
  function getAnalyzeRefreshOptions({
    hasPageDataProvider,
    wasGenerating: _wasGenerating
  }) {
    return {
      forceFreshPageData: Boolean(hasPageDataProvider),
      maxPageDataAgeMs: 0
    };
  }
  function getFollowUpAnalyzeDelay(state) {
    return state?.wasGenerating ? DEEPSEEK_GENERATION_POLL_DELAY_MS : null;
  }
  function sendRuntimeMessage(message) {
    try {
      return Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => null);
    } catch (_error) {
      return Promise.resolve(null);
    }
  }
  function bootContentScript() {
    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter || !document.body) {
      return null;
    }
    const pageDataProvider = adapter.getSiteName() === "DeepSeek" ? createDeepSeekHistoryProvider() : null;
    let state = {
      wasGenerating: false,
      lastCompletedFingerprint: null,
      lastCompletedMarker: null,
      lastObservedMarker: null
    };
    let timerId = null;
    let disposed = false;
    function buildSnapshot() {
      return createDomSnapshot(document.body);
    }
    async function getAdapterOptions({
      forceFreshPageData = false,
      maxPageDataAgeMs = 0
    } = {}) {
      if (!pageDataProvider) {
        return {};
      }
      let pageData = pageDataProvider.getCachedData();
      const cachedAge = Date.now() - Number(pageData?.receivedAt ?? 0);
      const shouldRefresh = !pageData || forceFreshPageData || maxPageDataAgeMs > 0 && cachedAge > maxPageDataAgeMs;
      if (shouldRefresh) {
        try {
          pageData = await pageDataProvider.request({
            forceRefresh: forceFreshPageData || maxPageDataAgeMs > 0
          });
        } catch (_error) {
          pageData = pageDataProvider.getCachedData();
        }
      }
      return pageData ? { pageData } : {};
    }
    async function getConversation({ forceFreshPageData = false } = {}) {
      if (disposed) {
        return adapter.extractConversation(null, document.title, {});
      }
      const snapshot = buildSnapshot();
      const adapterOptions = await getAdapterOptions({ forceFreshPageData });
      return adapter.extractConversation(snapshot, document.title, adapterOptions);
    }
    async function analyze() {
      if (disposed) {
        return;
      }
      const snapshot = buildSnapshot();
      const adapterOptions = await getAdapterOptions(
        getAnalyzeRefreshOptions({
          hasPageDataProvider: Boolean(pageDataProvider),
          wasGenerating: state.wasGenerating
        })
      );
      if (disposed) {
        return;
      }
      const isGenerating = adapter.isGenerating(snapshot, adapterOptions);
      const latestFingerprint = adapter.getLatestAssistantFingerprint(
        snapshot,
        document.title,
        adapterOptions
      );
      const latestMarker = typeof adapter.getLatestAssistantMarker === "function" ? adapter.getLatestAssistantMarker(snapshot, document.title, adapterOptions) : null;
      const nextState = transitionCompletionState(state, {
        isGenerating,
        latestFingerprint,
        latestMarker
      });
      if (nextState.shouldNotify) {
        const conversation = adapter.extractConversation(snapshot, document.title, adapterOptions);
        await sendRuntimeMessage({
          type: "MODEL_RESPONSE_COMPLETED",
          site: adapter.getSiteName(),
          conversationTitle: conversation.title,
          fingerprint: nextState.lastCompletedFingerprint
        });
      }
      state = nextState;
      const followUpDelay = getFollowUpAnalyzeDelay(state);
      if (followUpDelay != null) {
        scheduleAnalyze(followUpDelay);
      }
    }
    function scheduleAnalyze(delayMs = 400) {
      if (disposed) {
        return;
      }
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        timerId = null;
        void analyze();
      }, delayMs);
    }
    const observer = new MutationObserver(() => {
      scheduleAnalyze();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    const handleRuntimeMessage = (message, _sender, sendResponse) => {
      if (disposed) {
        return false;
      }
      if (message?.type === "PING_SUPPORT_STATUS") {
        void getConversation().then((conversation) => {
          sendResponse({
            supported: true,
            siteName: adapter.getSiteName(),
            conversationTitle: conversation.title
          });
        }).catch(() => {
          sendResponse({
            supported: true,
            siteName: adapter.getSiteName(),
            conversationTitle: document.title
          });
        });
        return true;
      }
      if (message?.type === "EXPORT_CURRENT_CONVERSATION") {
        void getConversation({ forceFreshPageData: true }).then((conversation) => {
          sendResponse(conversation);
        }).catch(() => {
          sendResponse(null);
        });
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    void analyze();
    return {
      dispose() {
        disposed = true;
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        observer.disconnect();
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }

  // src/content/bootstrap.js
  replaceContentScriptInstance({ bootContentScript });
})();
