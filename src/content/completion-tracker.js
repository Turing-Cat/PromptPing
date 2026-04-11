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

    const markerChanged = latestMarker !== previousCompletedMarker;
    const fingerprintChanged =
      Boolean(latestFingerprint) && latestFingerprint !== previousCompletedFingerprint;
    const shouldNotify =
      markerChanged && (previousState.wasGenerating || fingerprintChanged);

    return {
      wasGenerating: false,
      lastCompletedFingerprint: shouldNotify
        ? latestFingerprint
        : previousCompletedFingerprint,
      lastCompletedMarker: shouldNotify
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
