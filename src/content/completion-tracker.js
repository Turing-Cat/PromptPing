export function transitionCompletionState(previousState, currentState) {
  const previousCompletedFingerprint = previousState.lastCompletedFingerprint ?? null;
  const previousCompletedMarker = previousState.lastCompletedMarker ?? null;
  const previousObservedMarker = previousState.lastObservedMarker ?? null;
  const latestFingerprint = currentState.latestFingerprint ?? null;
  const latestMarker = currentState.latestMarker ?? null;

  if (currentState.isGenerating) {
    return {
      wasGenerating: true,
      lastCompletedFingerprint: previousCompletedFingerprint,
      lastCompletedMarker: previousCompletedMarker,
      lastObservedMarker: latestMarker ?? previousObservedMarker,
      shouldNotify: false,
    };
  }

  if (latestMarker) {
    if (!previousCompletedMarker) {
      return {
        wasGenerating: false,
        lastCompletedFingerprint: latestFingerprint,
        lastCompletedMarker: latestMarker,
        lastObservedMarker: latestMarker,
        shouldNotify: false,
      };
    }

    const shouldNotify =
      latestMarker !== previousCompletedMarker &&
      (previousState.wasGenerating || latestMarker !== previousObservedMarker);

    return {
      wasGenerating: false,
      lastCompletedFingerprint: latestMarker !== previousCompletedMarker
        ? latestFingerprint
        : previousCompletedFingerprint,
      lastCompletedMarker: latestMarker !== previousCompletedMarker
        ? latestMarker
        : previousCompletedMarker,
      lastObservedMarker: latestMarker,
      shouldNotify,
    };
  }

  const shouldNotify =
    previousState.wasGenerating &&
    Boolean(latestFingerprint) &&
    latestFingerprint !== previousCompletedFingerprint;

  return {
    wasGenerating: false,
    lastCompletedFingerprint: shouldNotify ? latestFingerprint : previousCompletedFingerprint,
    lastCompletedMarker: previousCompletedMarker,
    lastObservedMarker: previousObservedMarker,
    shouldNotify,
  };
}
