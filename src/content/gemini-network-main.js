(function installPromptPingGeminiNetworkBridge() {
  const bridgeFlag = "__PROMPT_PING_GEMINI_NETWORK_BRIDGE__";
  const source = "PromptPingGeminiNetwork";

  if (window[bridgeFlag]) {
    return;
  }

  window[bridgeFlag] = true;

  let activeCount = 0;

  function isStreamGenerateUrl(url) {
    return /\/BardFrontendService\/StreamGenerate\b/i.test(String(url ?? ""));
  }

  function post(type) {
    window.postMessage(
      {
        source,
        type,
        activeCount,
      },
      "*",
    );
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__promptPingGeminiStreamGenerate = isStreamGenerateUrl(url);
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    if (this.__promptPingGeminiStreamGenerate) {
      activeCount += 1;
      post("stream-start");

      const request = this;
      const finalize = () => {
        if (request.__promptPingGeminiStreamFinalized) {
          return;
        }

        request.__promptPingGeminiStreamFinalized = true;
        activeCount = Math.max(0, activeCount - 1);
        post("stream-end");
      };

      request.addEventListener("loadend", finalize, { once: true });
      request.addEventListener("abort", finalize, { once: true });
      request.addEventListener("error", finalize, { once: true });
      request.addEventListener("timeout", finalize, { once: true });
    }

    return originalSend.apply(this, args);
  };
})();
