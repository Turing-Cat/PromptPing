import test from "node:test";
import assert from "node:assert/strict";

import {
  GEMINI_IDLE_STABILITY_DELAY_MS,
  transitionGeminiCompletionState,
} from "../../src/content/gemini-completion-tracker.js";

test("transitionGeminiCompletionState initializes an existing completed turn without notifying", () => {
  const state = transitionGeminiCompletionState(
    {},
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestUserTurnMarker: "1:介绍一下你自己",
      userTurnCount: 1,
      assistantTurnCount: 1,
    },
  );

  assert.equal(state.shouldNotify, false);
  assert.equal(state.lastCompletedMarker, "1:介绍一下你自己");
  assert.equal(state.lastCompletedFingerprint, "1:介绍一下你自己|old-fingerprint");
});

test("transitionGeminiCompletionState does not emit a completion when a new user turn starts", () => {
  const baselineState = transitionGeminiCompletionState(
    {},
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestUserTurnMarker: "1:介绍一下你自己",
      userTurnCount: 1,
      assistantTurnCount: 1,
    },
  );

  const state = transitionGeminiCompletionState(baselineState, {
    isGenerating: false,
    latestFingerprint: "old-fingerprint",
    latestUserTurnMarker: "2:再简短一点",
    userTurnCount: 2,
    assistantTurnCount: 1,
  });

  assert.equal(state.shouldNotify, false);
  assert.equal(state.lastCompletedMarker, "1:介绍一下你自己");
  assert.equal(state.followUpDelayMs, null);
});

test("transitionGeminiCompletionState emits a completion when Gemini stops generating", () => {
  const baselineState = transitionGeminiCompletionState(
    {},
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestUserTurnMarker: "1:介绍一下你自己",
      userTurnCount: 1,
      assistantTurnCount: 1,
    },
  );

  const generatingState = transitionGeminiCompletionState(baselineState, {
    isGenerating: true,
    latestFingerprint: "draft-fingerprint",
    latestUserTurnMarker: "2:再简短一点",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  const completedState = transitionGeminiCompletionState(generatingState, {
    isGenerating: false,
    latestFingerprint: "final-fingerprint",
    latestUserTurnMarker: "2:再简短一点",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  assert.equal(completedState.shouldNotify, true);
  assert.equal(completedState.lastCompletedMarker, "2:再简短一点");
  assert.equal(
    completedState.lastCompletedFingerprint,
    "2:再简短一点|final-fingerprint",
  );
});

test("transitionGeminiCompletionState waits for stability when generation was not observed", () => {
  const baselineState = transitionGeminiCompletionState(
    {},
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestUserTurnMarker: "1:介绍一下你自己",
      userTurnCount: 1,
      assistantTurnCount: 1,
    },
  );

  const firstIdleState = transitionGeminiCompletionState(baselineState, {
    isGenerating: false,
    latestFingerprint: "new-fingerprint",
    latestUserTurnMarker: "2:再简短一点",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  assert.equal(firstIdleState.shouldNotify, false);
  assert.equal(firstIdleState.followUpDelayMs, GEMINI_IDLE_STABILITY_DELAY_MS);

  const completedState = transitionGeminiCompletionState(firstIdleState, {
    isGenerating: false,
    latestFingerprint: "new-fingerprint",
    latestUserTurnMarker: "2:再简短一点",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  assert.equal(completedState.shouldNotify, true);
  assert.equal(completedState.lastCompletedMarker, "2:再简短一点");
});

test("transitionGeminiCompletionState still emits when two Gemini turns end with the same text", () => {
  const baselineState = transitionGeminiCompletionState(
    {},
    {
      isGenerating: false,
      latestFingerprint: "same-fingerprint",
      latestUserTurnMarker: "1:回复 ok",
      userTurnCount: 1,
      assistantTurnCount: 1,
    },
  );

  const generatingState = transitionGeminiCompletionState(baselineState, {
    isGenerating: true,
    latestFingerprint: "same-fingerprint",
    latestUserTurnMarker: "2:再回复 ok",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  const completedState = transitionGeminiCompletionState(generatingState, {
    isGenerating: false,
    latestFingerprint: "same-fingerprint",
    latestUserTurnMarker: "2:再回复 ok",
    userTurnCount: 2,
    assistantTurnCount: 2,
  });

  assert.equal(completedState.shouldNotify, true);
  assert.equal(completedState.lastCompletedMarker, "2:再回复 ok");
  assert.equal(
    completedState.lastCompletedFingerprint,
    "2:再回复 ok|same-fingerprint",
  );
});
