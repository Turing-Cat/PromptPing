import test from "node:test";
import assert from "node:assert/strict";

import { resolveLocale } from "../../src/core/i18n.js";

test("resolveLocale uses Chinese bundle for zh locales", () => {
  assert.equal(resolveLocale("zh-CN"), "zh_CN");
  assert.equal(resolveLocale("zh-TW"), "zh_CN");
});

test("resolveLocale falls back to English", () => {
  assert.equal(resolveLocale("en-US"), "en");
  assert.equal(resolveLocale("fr-FR"), "en");
  assert.equal(resolveLocale(""), "en");
});

