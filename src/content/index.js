const bootFlag = "__promptPingBooted__";

if (!window[bootFlag]) {
  window[bootFlag] = true;

  (async () => {
    const runtimeUrl = chrome.runtime.getURL("src/content/runtime.js");
    const { bootContentScript } = await import(runtimeUrl);
    bootContentScript();
  })();
}
