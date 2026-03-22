const bootFlag = "__promptPingBooted__";

if (!globalThis[bootFlag]) {
  globalThis[bootFlag] = true;

  (async () => {
    const runtimeUrl = chrome.runtime.getURL("src/content/runtime.js");
    const { bootContentScript } = await import(runtimeUrl);
    bootContentScript();
  })();
}
