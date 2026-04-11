# Gemini Notification Support Design

## Goal
Add browser notification support for response completion on the Gemini web app at `https://gemini.google.com/` using the existing DOM-based completion tracking pipeline.

## Scope
Included:
- support Gemini page detection and content-script injection
- detect active Gemini response generation from DOM signals
- generate stable fingerprints for the latest Gemini assistant reply
- trigger the existing background-tab-only completion notifications for Gemini

Excluded:
- conversation export support for Gemini
- support for Google AI Studio or any non-`gemini.google.com` host
- network-layer monitoring such as WebSocket, SSE, or debugger-based inspection
- changes to the completion tracker state machine or notification delivery rules

## Approach
Add a dedicated `GeminiAdapter` and wire it into the same adapter registry used by ChatGPT, Claude, and DeepSeek. The adapter will only implement the minimum behavior needed for notifications:
- detect Gemini URLs
- expose the site name
- determine whether Gemini is still generating
- fingerprint the latest assistant response
- return a minimal conversation object so the background notification can show a reasonable title

Generation detection will follow the same conservative strategy used elsewhere in the codebase:
1. Prefer stable structural signals from Gemini stop-generation controls.
2. Fall back to normalized accessible text and visible button text.
3. Avoid broad heuristics that could create false positives.

## Adapter Design
`src/adapters/gemini.js` will:
- inspect Gemini message containers and identify assistant content with Gemini-specific DOM markers
- extract paragraph-style text blocks from the latest assistant reply for fingerprinting
- inspect button-like controls for stop-generation signals using attributes first and text second

The adapter does not need to reconstruct a complete exportable conversation. It only needs enough data for a stable latest-assistant fingerprint and a notification title. If no Gemini-specific heading is found, it can safely fall back to `document.title`.

## Integration Points
- `manifest.json`: add Gemini host permissions and content script match patterns
- `src/background/index.js`: include Gemini in supported URL matching so open tabs get injected on install, startup, activation, and navigation
- `src/adapters/index.js`: register `GeminiAdapter`
- `src/content/runtime.js`: no logic changes expected because the existing adapter contract is sufficient

## Error Handling And Compatibility
- If Gemini changes button text but preserves structural stop markers, notifications should continue working.
- If structural markers change, localized text fallback still provides coverage.
- If both fail, the extension should degrade safely by missing a notification rather than producing false notifications.
- Existing supported sites must remain unchanged.

## Testing
Add automated tests that cover:
- adapter registry matching for `https://gemini.google.com/`
- Gemini generation detection from a stop control
- Gemini latest assistant fingerprint generation from a minimal Gemini-like snapshot
- supported-host integration in background logic

## Acceptance Criteria
1. A Gemini tab at `https://gemini.google.com/` is treated as supported by the extension.
2. When a Gemini response completes in a background tab, the existing notification pipeline can emit a notification.
3. Gemini support does not imply or advertise conversation export support.
4. Existing automated tests continue to pass.
