import test from "node:test";
import assert from "node:assert/strict";

import { transitionCompletionState } from "../../src/content/completion-tracker.js";

test("transitionCompletionState emits a completion when generation stops with a new fingerprint", () => {
  const generatingState = transitionCompletionState(
    {
      wasGenerating: false,
      lastCompletedFingerprint: null,
      lastCompletedMarker: null,
      lastObservedMarker: null,
    },
    { isGenerating: true, latestFingerprint: "draft", latestMarker: null },
  );

  assert.deepEqual(generatingState, {
    wasGenerating: true,
    lastCompletedFingerprint: null,
    lastCompletedMarker: null,
    lastObservedMarker: null,
    shouldNotify: false,
  });

  const completedState = transitionCompletionState(generatingState, {
    isGenerating: false,
    latestFingerprint: "final",
    latestMarker: null,
  });

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "final",
    lastCompletedMarker: null,
    lastObservedMarker: null,
    shouldNotify: true,
  });
});

test("transitionCompletionState ignores duplicate completion fingerprints", () => {
  const completedState = transitionCompletionState(
    {
      wasGenerating: true,
      lastCompletedFingerprint: "same",
      lastCompletedMarker: null,
      lastObservedMarker: null,
    },
    { isGenerating: false, latestFingerprint: "same", latestMarker: null },
  );

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "same",
    lastCompletedMarker: null,
    lastObservedMarker: null,
    shouldNotify: false,
  });
});

test("transitionCompletionState emits a completion for a new finished assistant marker even if generation was not observed", () => {
  const baselineState = transitionCompletionState(
    {
      wasGenerating: false,
      lastCompletedFingerprint: null,
      lastCompletedMarker: null,
      lastObservedMarker: null,
    },
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestMarker: "assistant-1",
    },
  );

  assert.deepEqual(baselineState, {
    wasGenerating: false,
    lastCompletedFingerprint: "old-fingerprint",
    lastCompletedMarker: "assistant-1",
    lastObservedMarker: "assistant-1",
    shouldNotify: false,
  });

  const completedState = transitionCompletionState(baselineState, {
    isGenerating: false,
    latestFingerprint: "new-fingerprint",
    latestMarker: "assistant-2",
  });

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "new-fingerprint",
    lastCompletedMarker: "assistant-2",
    lastObservedMarker: "assistant-2",
    shouldNotify: true,
  });
});

test("transitionCompletionState does not emit a completion when only the user-turn marker advances", () => {
  const state = transitionCompletionState(
    {
      wasGenerating: false,
      lastCompletedFingerprint: "same-fingerprint",
      lastCompletedMarker: "assistant-1",
      lastObservedMarker: "assistant-1",
    },
    {
      isGenerating: false,
      latestFingerprint: "same-fingerprint",
      latestMarker: "assistant-2",
    },
  );

  assert.deepEqual(state, {
    wasGenerating: false,
    lastCompletedFingerprint: "same-fingerprint",
    lastCompletedMarker: "assistant-1",
    lastObservedMarker: "assistant-2",
    shouldNotify: false,
  });
});

test("transitionCompletionState emits a completion when the same marker later gets a new fingerprint", () => {
  const pendingTurnState = transitionCompletionState(
    {
      wasGenerating: false,
      lastCompletedFingerprint: "old-fingerprint",
      lastCompletedMarker: "assistant-1",
      lastObservedMarker: "assistant-1",
    },
    {
      isGenerating: false,
      latestFingerprint: "old-fingerprint",
      latestMarker: "assistant-2",
    },
  );

  assert.deepEqual(pendingTurnState, {
    wasGenerating: false,
    lastCompletedFingerprint: "old-fingerprint",
    lastCompletedMarker: "assistant-1",
    lastObservedMarker: "assistant-2",
    shouldNotify: false,
  });

  const completedState = transitionCompletionState(pendingTurnState, {
    isGenerating: false,
    latestFingerprint: "new-fingerprint",
    latestMarker: "assistant-2",
  });

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "new-fingerprint",
    lastCompletedMarker: "assistant-2",
    lastObservedMarker: "assistant-2",
    shouldNotify: true,
  });
});

test("transitionCompletionState still emits when generation was observed even if the fingerprint repeats", () => {
  const state = transitionCompletionState(
    {
      wasGenerating: true,
      lastCompletedFingerprint: "same-fingerprint",
      lastCompletedMarker: "assistant-1",
      lastObservedMarker: "assistant-2",
    },
    {
      isGenerating: false,
      latestFingerprint: "same-fingerprint",
      latestMarker: "assistant-2",
    },
  );

  assert.deepEqual(state, {
    wasGenerating: false,
    lastCompletedFingerprint: "same-fingerprint",
    lastCompletedMarker: "assistant-2",
    lastObservedMarker: "assistant-2",
    shouldNotify: true,
  });
});
