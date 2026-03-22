const INSTANCE_KEY = "__promptPingContentScriptInstance__";

export function replaceContentScriptInstance({
  globalObject = globalThis,
  bootContentScript,
}) {
  globalObject[INSTANCE_KEY]?.dispose?.();

  const instance = bootContentScript?.() ?? null;
  if (instance) {
    globalObject[INSTANCE_KEY] = instance;
    return instance;
  }

  delete globalObject[INSTANCE_KEY];
  return null;
}
