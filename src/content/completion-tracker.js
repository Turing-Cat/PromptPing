export function transitionCompletionState(previousState, currentState) {
  if (currentState.isGenerating) {
    return {
      wasGenerating: true,
      lastCompletedFingerprint: previousState.lastCompletedFingerprint,
      shouldNotify: false,
    };
  }

  const shouldNotify =
    previousState.wasGenerating &&
    Boolean(currentState.latestFingerprint) &&
    currentState.latestFingerprint !== previousState.lastCompletedFingerprint;

  return {
    wasGenerating: false,
    lastCompletedFingerprint: shouldNotify
      ? currentState.latestFingerprint
      : previousState.lastCompletedFingerprint,
    shouldNotify,
  };
}

