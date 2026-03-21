import test from "node:test";
import assert from "node:assert/strict";

import { transitionCompletionState } from "../../src/content/completion-tracker.js";

test("transitionCompletionState emits a completion when generation stops with a new fingerprint", () => {
  const generatingState = transitionCompletionState(
    { wasGenerating: false, lastCompletedFingerprint: null },
    { isGenerating: true, latestFingerprint: "draft" },
  );

  assert.deepEqual(generatingState, {
    wasGenerating: true,
    lastCompletedFingerprint: null,
    shouldNotify: false,
  });

  const completedState = transitionCompletionState(generatingState, {
    isGenerating: false,
    latestFingerprint: "final",
  });

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "final",
    shouldNotify: true,
  });
});

test("transitionCompletionState ignores duplicate completion fingerprints", () => {
  const completedState = transitionCompletionState(
    { wasGenerating: true, lastCompletedFingerprint: "same" },
    { isGenerating: false, latestFingerprint: "same" },
  );

  assert.deepEqual(completedState, {
    wasGenerating: false,
    lastCompletedFingerprint: "same",
    shouldNotify: false,
  });
});

