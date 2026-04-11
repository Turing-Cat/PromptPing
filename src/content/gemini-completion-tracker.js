export const GEMINI_IDLE_STABILITY_DELAY_MS = 750;

function normalizeGeminiState(previousState) {
  return {
    initialized: Boolean(previousState?.initialized),
    wasGenerating: Boolean(previousState?.wasGenerating),
    lastCompletedFingerprint: previousState?.lastCompletedFingerprint ?? null,
    lastCompletedMarker: previousState?.lastCompletedMarker ?? null,
    lastObservedMarker: previousState?.lastObservedMarker ?? null,
    lastObservedAssistantCount: Number(previousState?.lastObservedAssistantCount ?? 0),
    turnStartAssistantCount: Number(previousState?.turnStartAssistantCount ?? 0),
    lastSeenFingerprint: previousState?.lastSeenFingerprint ?? null,
    sawTurnActivity: Boolean(previousState?.sawTurnActivity),
    idleStableFingerprint: previousState?.idleStableFingerprint ?? null,
    idleStablePassCount: Number(previousState?.idleStablePassCount ?? 0),
    followUpDelayMs: previousState?.followUpDelayMs ?? null,
  };
}

function createCompletionFingerprint(userTurnMarker, latestFingerprint) {
  if (!userTurnMarker || !latestFingerprint) {
    return null;
  }

  return `${userTurnMarker}|${latestFingerprint}`;
}

export function transitionGeminiCompletionState(previousState, currentState) {
  const state = normalizeGeminiState(previousState);
  const latestUserTurnMarker = currentState.latestUserTurnMarker ?? null;
  const userTurnCount = Number(currentState.userTurnCount ?? 0);
  const assistantTurnCount = Number(currentState.assistantTurnCount ?? 0);
  const latestFingerprint = currentState.latestFingerprint ?? null;
  const isGenerating = Boolean(currentState.isGenerating);
  const assistantAligned = userTurnCount > 0 && assistantTurnCount >= userTurnCount;
  const completionFingerprint = createCompletionFingerprint(
    latestUserTurnMarker,
    latestFingerprint,
  );

  if (!latestUserTurnMarker) {
    return {
      ...state,
      initialized: true,
      wasGenerating: isGenerating,
      lastObservedAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint,
      followUpDelayMs: null,
      shouldNotify: false,
    };
  }

  if (!state.initialized) {
    const looksComplete = !isGenerating && assistantAligned && completionFingerprint;

    return {
      ...state,
      initialized: true,
      wasGenerating: isGenerating,
      lastCompletedFingerprint: looksComplete ? completionFingerprint : null,
      lastCompletedMarker: looksComplete ? latestUserTurnMarker : null,
      lastObservedMarker: latestUserTurnMarker,
      lastObservedAssistantCount: assistantTurnCount,
      turnStartAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint,
      sawTurnActivity: false,
      idleStableFingerprint: null,
      idleStablePassCount: 0,
      followUpDelayMs: null,
      shouldNotify: false,
    };
  }

  const isNewTurn = latestUserTurnMarker !== state.lastObservedMarker;

  if (isNewTurn) {
    const assistantAlreadyAdvanced = assistantTurnCount > state.lastObservedAssistantCount;
    const fingerprintAlreadyAdvanced =
      Boolean(latestFingerprint) && latestFingerprint !== state.lastSeenFingerprint;
    const startedWithCompletedAssistant =
      !isGenerating &&
      assistantAligned &&
      completionFingerprint &&
      (assistantAlreadyAdvanced || fingerprintAlreadyAdvanced);

    return {
      ...state,
      wasGenerating: isGenerating,
      lastObservedMarker: latestUserTurnMarker,
      lastObservedAssistantCount: assistantTurnCount,
      turnStartAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint,
      sawTurnActivity: Boolean(isGenerating || startedWithCompletedAssistant),
      idleStableFingerprint: startedWithCompletedAssistant ? completionFingerprint : null,
      idleStablePassCount: startedWithCompletedAssistant ? 1 : 0,
      followUpDelayMs: startedWithCompletedAssistant
        ? GEMINI_IDLE_STABILITY_DELAY_MS
        : null,
      shouldNotify: false,
    };
  }

  const fingerprintChanged =
    Boolean(latestFingerprint) && latestFingerprint !== state.lastSeenFingerprint;
  const assistantAdvanced = assistantTurnCount > state.turnStartAssistantCount;
  const sawTurnActivity =
    state.sawTurnActivity || isGenerating || fingerprintChanged || assistantAdvanced;

  if (isGenerating) {
    return {
      ...state,
      wasGenerating: true,
      lastObservedAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint ?? state.lastSeenFingerprint,
      sawTurnActivity,
      idleStableFingerprint: null,
      idleStablePassCount: 0,
      followUpDelayMs: null,
      shouldNotify: false,
    };
  }

  const canConsiderCompletion =
    assistantAligned &&
    Boolean(completionFingerprint) &&
    sawTurnActivity &&
    latestUserTurnMarker !== state.lastCompletedMarker;

  if (!canConsiderCompletion) {
    return {
      ...state,
      wasGenerating: false,
      lastObservedAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint ?? state.lastSeenFingerprint,
      sawTurnActivity,
      idleStableFingerprint: null,
      idleStablePassCount: 0,
      followUpDelayMs: null,
      shouldNotify: false,
    };
  }

  const idleStablePassCount =
    completionFingerprint === state.idleStableFingerprint
      ? state.idleStablePassCount + 1
      : 1;
  const shouldNotify = state.wasGenerating || idleStablePassCount >= 2;

  if (shouldNotify) {
    return {
      ...state,
      wasGenerating: false,
      lastCompletedFingerprint: completionFingerprint,
      lastCompletedMarker: latestUserTurnMarker,
      lastObservedAssistantCount: assistantTurnCount,
      lastSeenFingerprint: latestFingerprint,
      sawTurnActivity: false,
      idleStableFingerprint: null,
      idleStablePassCount: 0,
      followUpDelayMs: null,
      shouldNotify: true,
    };
  }

  return {
    ...state,
    wasGenerating: false,
    lastObservedAssistantCount: assistantTurnCount,
    lastSeenFingerprint: latestFingerprint,
    sawTurnActivity,
    idleStableFingerprint: completionFingerprint,
    idleStablePassCount,
    followUpDelayMs: GEMINI_IDLE_STABILITY_DELAY_MS,
    shouldNotify: false,
  };
}
