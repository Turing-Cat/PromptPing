import test from "node:test";
import assert from "node:assert/strict";

import { replaceContentScriptInstance } from "../../src/content/boot-instance.js";

test("replaceContentScriptInstance disposes the previous content-script instance before rebooting", () => {
  const events = [];
  const globalObject = {
    __promptPingContentScriptInstance__: {
      dispose() {
        events.push("dispose-old");
      },
    },
  };

  const instance = replaceContentScriptInstance({
    globalObject,
    bootContentScript() {
      events.push("boot-new");
      return {
        dispose() {
          events.push("dispose-new");
        },
      };
    },
  });

  assert.deepEqual(events, ["dispose-old", "boot-new"]);
  assert.equal(globalObject.__promptPingContentScriptInstance__, instance);
});

test("replaceContentScriptInstance clears the stored instance when boot returns nothing", () => {
  const globalObject = {
    __promptPingContentScriptInstance__: {
      dispose() {},
    },
  };

  const instance = replaceContentScriptInstance({
    globalObject,
    bootContentScript() {
      return null;
    },
  });

  assert.equal(instance, null);
  assert.equal("__promptPingContentScriptInstance__" in globalObject, false);
});
