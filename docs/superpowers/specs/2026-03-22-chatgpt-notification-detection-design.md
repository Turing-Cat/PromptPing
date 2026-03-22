# ChatGPT Notification Detection Design

## Goal
Fix the ChatGPT completion notification flow so browser notifications still fire when the ChatGPT UI is not in English, with the current user-reported failure focused on Chinese UI.

## Problem Summary
The current ChatGPT adapter treats "generation in progress" as an English-only UI text match on the stop button. When the ChatGPT page is localized, the adapter can fail to detect that a response is streaming. That prevents the completion tracker from ever transitioning from generating to completed, so the background worker never receives the completion event and no notification is shown.

## Scope
This design only changes ChatGPT completion detection.

Included:
- make ChatGPT generation detection resilient to localized UI text
- preserve the existing background-tab-only notification behavior
- preserve the existing fingerprint-based deduplication behavior
- add regression tests for English and Chinese detection paths

Excluded:
- changing notification copy or delivery rules
- changing export behavior
- extending support to new sites
- redesigning the completion tracker state machine

## Approach
Use a layered detection strategy in the ChatGPT adapter:

1. Prefer language-agnostic structural signals when identifying an active response.
2. Fall back to localized text matching when structural signals are unavailable.
3. Keep the existing completion state machine unchanged so only the detection input changes.

This avoids coupling notifications to a single translated phrase while keeping a conservative fallback for older or variant DOM shapes.

## Adapter Changes
`src/adapters/chatgpt.js` will be refactored so generation detection is split into small helpers with one purpose each.

Planned helper responsibilities:
- inspect buttons for stable non-language attributes or structural markers associated with the stop action
- inspect accessible labels and visible text using a small localized fallback phrase set
- return `true` as soon as any trusted signal indicates generation is active

The adapter will continue to expose the same public interface:
- `matchesLocation(url)`
- `getSiteName()`
- `extractConversation(snapshot, pageTitle)`
- `isGenerating(snapshot)`
- `getLatestAssistantFingerprint(snapshot, pageTitle)`

No call sites need to change.

## Detection Rules
The new `isGenerating(snapshot)` logic will follow this order:

1. Search interactive controls relevant to the stop action.
2. Check for language-agnostic signals first.
3. If none are present, normalize accessible text and visible button text, then compare against a limited fallback phrase list that includes English and Chinese stop-generation wording.
4. If no trusted signal is found, report `false`.

This keeps behavior biased toward avoiding false positives while restoring support for localized pages.

## Data Flow
The end-to-end notification flow remains:

1. content script snapshots the DOM after mutations
2. ChatGPT adapter reports whether generation is active
3. completion tracker detects the transition from generating to completed
4. content script sends `MODEL_RESPONSE_COMPLETED`
5. background worker applies active-tab and deduplication checks
6. Chrome notification is created

Only step 2 changes in this design.

## Error Handling And Compatibility
- If the preferred structural signal disappears from a future ChatGPT DOM revision, localized text fallback still provides coverage.
- If localized text changes, structural detection still provides coverage.
- If both signals fail, behavior degrades to the current safe failure mode of not notifying rather than producing false notifications.
- Existing English behavior must remain supported.

## Testing
Update `tests/adapters/chatgpt.test.js` to cover:
- English stop-generation text
- Chinese stop-generation text
- a structure-based signal with no readable stop text

Keep existing completion tracker tests unchanged unless a gap is discovered while implementing. The tracker contract itself is not changing.

## Acceptance Criteria
1. On ChatGPT, a response started in one tab and completed while that tab is in the background can trigger a notification on both English and Chinese UI variants.
2. Existing English detection tests continue to pass.
3. Chinese detection is covered by an automated adapter test.
4. A structure-first detection path is covered by an automated adapter test so notification behavior is not solely dependent on translated strings.
