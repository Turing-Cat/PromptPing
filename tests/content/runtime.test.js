import test from "node:test";
import assert from "node:assert/strict";

import {
  DEEPSEEK_GENERATION_POLL_DELAY_MS,
  getAnalyzeRefreshOptions,
  getFollowUpAnalyzeDelay,
  getGeminiNetworkAnalyzeDelay,
  getHiddenStateAfterVisibilityChange,
  getMutationObserverOptions,
  getNextGenerationHiddenState,
  getResumeAnalyzeDelay,
  isGeminiNetworkActivityMessage,
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

test("getFollowUpAnalyzeDelay honors adapter-specific follow-up delays", () => {
  assert.equal(getFollowUpAnalyzeDelay({ followUpDelayMs: 750 }), 750);
});

test("Gemini network runtime messages use immediate start analysis and delayed end analysis", () => {
  assert.equal(
    isGeminiNetworkActivityMessage({
      type: "GEMINI_NETWORK_ACTIVITY",
      phase: "stream-start",
      activeCount: 1,
    }),
    true,
  );
  assert.equal(getGeminiNetworkAnalyzeDelay("stream-start"), 0);
  assert.equal(getGeminiNetworkAnalyzeDelay("stream-end"), 75);
  assert.equal(isGeminiNetworkActivityMessage({ type: "MODEL_RESPONSE_COMPLETED" }), false);
});

test("getResumeAnalyzeDelay schedules an immediate analyze when the page becomes visible again", () => {
  assert.equal(getResumeAnalyzeDelay("visible"), 0);
  assert.equal(getResumeAnalyzeDelay("hidden"), null);
});

test("hidden generation state survives returning to a visible tab until completion", () => {
  let wasHiddenDuringGeneration = false;

  wasHiddenDuringGeneration = getHiddenStateAfterVisibilityChange({
    wasHiddenDuringGeneration,
    visibilityState: "hidden",
    wasGenerating: true,
  });
  assert.equal(wasHiddenDuringGeneration, true);

  wasHiddenDuringGeneration = getHiddenStateAfterVisibilityChange({
    wasHiddenDuringGeneration,
    visibilityState: "visible",
    wasGenerating: true,
  });
  assert.equal(wasHiddenDuringGeneration, true);

  wasHiddenDuringGeneration = getNextGenerationHiddenState({
    wasHiddenDuringGeneration,
    visibilityState: "visible",
    nextWasGenerating: true,
    shouldNotify: false,
  });
  assert.equal(wasHiddenDuringGeneration, true);
});

test("hidden generation state resets after completion or while idle", () => {
  assert.equal(
    getNextGenerationHiddenState({
      wasHiddenDuringGeneration: true,
      visibilityState: "visible",
      nextWasGenerating: false,
      shouldNotify: true,
    }),
    false,
  );

  assert.equal(
    getHiddenStateAfterVisibilityChange({
      wasHiddenDuringGeneration: true,
      visibilityState: "visible",
      wasGenerating: false,
    }),
    false,
  );
});

test("content observer watches attribute changes that can flip completion state", () => {
  assert.deepEqual(getMutationObserverOptions(), {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "aria-label",
      "title",
      "class",
      "data-testid",
      "data-test-id",
      "testid",
      "id",
      "role",
      "data-role",
      "data-message-role",
      "data-response-role",
    ],
  });
});
