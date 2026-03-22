import test from "node:test";
import assert from "node:assert/strict";

import {
  DEEPSEEK_GENERATION_POLL_DELAY_MS,
  getAnalyzeRefreshOptions,
  getFollowUpAnalyzeDelay,
} from "../../src/content/runtime.js";

test("getAnalyzeRefreshOptions always forces fresh DeepSeek page data during analyze", () => {
  assert.deepEqual(
    getAnalyzeRefreshOptions({
      hasPageDataProvider: true,
      wasGenerating: true,
    }),
    {
      forceFreshPageData: true,
      maxPageDataAgeMs: 0,
    },
  );
});

test("getAnalyzeRefreshOptions does not reuse cached DeepSeek page data before generation is detected", () => {
  assert.deepEqual(
    getAnalyzeRefreshOptions({
      hasPageDataProvider: true,
      wasGenerating: false,
    }),
    {
      forceFreshPageData: true,
      maxPageDataAgeMs: 0,
    },
  );
});

test("getFollowUpAnalyzeDelay keeps polling while generation is active", () => {
  assert.equal(
    getFollowUpAnalyzeDelay({ wasGenerating: true }),
    DEEPSEEK_GENERATION_POLL_DELAY_MS,
  );
  assert.equal(getFollowUpAnalyzeDelay({ wasGenerating: false }), null);
});
