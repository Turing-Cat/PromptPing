# Gemini Notification Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DOM-based completion notification support for `gemini.google.com` without implementing Gemini conversation export.

**Architecture:** Introduce a notify-only `GeminiAdapter`, register it with the adapter registry, and extend the manifest/background supported-host lists. Reuse the existing completion tracker and background notification flow unchanged, with adapter tests locking in Gemini DOM detection before implementation.

**Tech Stack:** JavaScript, Node test runner, Chrome extension MV3

---

### Task 1: Lock Gemini support requirements with failing tests

**Files:**
- Modify: `tests/adapters/registry.test.js`
- Create: `tests/adapters/gemini.test.js`
- Reference: `src/adapters/gemini.js`
- Reference: `src/adapters/index.js`

- [ ] **Step 1: Add a failing registry test for Gemini URL matching**

```js
assert.equal(getAdapterForUrl("https://gemini.google.com/app").getSiteName(), "Gemini");
```

- [ ] **Step 2: Add a failing adapter test for generation detection**

```js
test("GeminiAdapter detects active generation from stop controls", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-response-role": "model" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element("button", { attrs: { "aria-label": "Stop generating" } }, []),
  ]);

  assert.equal(GeminiAdapter.isGenerating(snapshot), true);
});
```

- [ ] **Step 3: Add a failing adapter test for latest assistant fingerprint generation**

```js
test("GeminiAdapter fingerprints the latest assistant reply", () => {
  const snapshot = element("main", {}, [
    element("h1", {}, ["Trip Plan"]),
    element("message-content", {}, [
      element("p", {}, ["Here is a two-day itinerary."]),
    ]),
  ]);

  assert.match(GeminiAdapter.getLatestAssistantFingerprint(snapshot, "Fallback"), /^[a-f0-9]+$/);
});
```

- [ ] **Step 4: Run the focused test files to verify the new Gemini coverage fails**

Run: `node --test tests/adapters/registry.test.js tests/adapters/gemini.test.js`
Expected: FAIL because Gemini is not yet registered and the adapter does not exist.

### Task 2: Implement the notify-only Gemini adapter

**Files:**
- Create: `src/adapters/gemini.js`
- Modify: `src/adapters/index.js`
- Test: `tests/adapters/gemini.test.js`
- Test: `tests/adapters/registry.test.js`

- [ ] **Step 1: Create the minimal Gemini adapter surface**

```js
export const GeminiAdapter = {
  matchesLocation(url) {
    return /https:\/\/gemini\.google\.com\//i.test(url);
  },

  getSiteName() {
    return "Gemini";
  },
};
```

- [ ] **Step 2: Implement structure-first generation detection and latest assistant fingerprinting**

```js
function hasStopControl(snapshot) {
  return findAllElements(snapshot, (node) => node.tagName === "button").some((button) => {
    if (hasStructuralStopSignal(button)) {
      return true;
    }

    return hasLocalizedStopText(button);
  });
}
```

- [ ] **Step 3: Implement minimal conversation extraction for notification titles**

```js
extractConversation(snapshot, pageTitle = "Gemini") {
  return createConversation(
    "Gemini",
    findTitle(snapshot, pageTitle),
    findGeminiMessages(snapshot),
  );
}
```

- [ ] **Step 4: Run the focused Gemini adapter tests and verify they pass**

Run: `node --test tests/adapters/registry.test.js tests/adapters/gemini.test.js`
Expected: PASS with Gemini registry and adapter tests green.

### Task 3: Wire Gemini into extension integration points

**Files:**
- Modify: `manifest.json`
- Modify: `src/background/index.js`
- Verify: `tests/adapters/registry.test.js`

- [ ] **Step 1: Add Gemini host permissions and content script match patterns**

```json
"https://gemini.google.com/*"
```

- [ ] **Step 2: Extend the background supported-host pattern to include Gemini**

```js
/^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|chat\.deepseek\.com|www\.deepseek\.com|gemini\.google\.com)\//i
```

- [ ] **Step 3: Add or extend a regression test that proves Gemini is considered supported**

Run: `node --test tests/adapters/registry.test.js tests/popup/support.test.js`
Expected: PASS, with existing support behavior unchanged for other sites.

### Task 4: Verify the full notification-focused suite

**Files:**
- Verify: `tests/adapters/gemini.test.js`
- Verify: `tests/adapters/registry.test.js`
- Verify: `tests/content/completion-tracker.test.js`
- Verify: `tests/core/notifications.test.js`

- [ ] **Step 1: Run the targeted notification-related suite**

Run: `node --test tests/adapters/gemini.test.js tests/adapters/registry.test.js tests/content/completion-tracker.test.js tests/core/notifications.test.js`
Expected: PASS with zero failures.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`
Expected: PASS with zero failures.
