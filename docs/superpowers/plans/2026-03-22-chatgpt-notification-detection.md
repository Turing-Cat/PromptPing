# ChatGPT Notification Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ChatGPT completion notifications work on localized UI variants by replacing English-only generation detection with structure-first detection plus localized fallback text.

**Architecture:** Keep the existing completion tracker and background notification flow unchanged. Restrict the implementation to `ChatGPTAdapter.isGenerating()` and its tests by introducing focused helper functions for structure-based detection and normalized fallback text matching.

**Tech Stack:** JavaScript, Node test runner, Chrome extension MV3

---

### Task 1: Lock in the missing behavior with adapter tests

**Files:**
- Modify: `tests/adapters/chatgpt.test.js`
- Reference: `src/adapters/chatgpt.js`

- [ ] **Step 1: Write the failing Chinese-generation detection test**

```js
test("ChatGPTAdapter detects active generation from Chinese stop text", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element("button", {}, ["停止生成"]),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
});
```

- [ ] **Step 2: Run the single test to verify it fails for the right reason**

Run: `node --test tests/adapters/chatgpt.test.js`
Expected: FAIL on the new Chinese-generation test because `isGenerating()` still only recognizes English text.

- [ ] **Step 3: Add a structure-first regression test with no readable stop text**

```js
test("ChatGPTAdapter detects active generation from structure-first controls", () => {
  const snapshot = element("main", {}, [
    element("div", { attrs: { "data-message-author-role": "assistant" } }, [
      element("p", {}, ["Streaming"]),
    ]),
    element(
      "button",
      { attrs: { "data-testid": "stop-button", "aria-label": "x" } },
      [element("svg", { attrs: { "aria-hidden": "true" } }, [])],
    ),
  ]);

  assert.equal(ChatGPTAdapter.isGenerating(snapshot), true);
});
```

- [ ] **Step 4: Run the adapter test file again and verify both new tests fail**

Run: `node --test tests/adapters/chatgpt.test.js`
Expected: FAIL on the new Chinese and structure-first tests, confirming the regression is captured before implementation.

### Task 2: Implement layered ChatGPT generation detection

**Files:**
- Modify: `src/adapters/chatgpt.js`
- Verify: `tests/adapters/chatgpt.test.js`

- [ ] **Step 1: Refactor `ChatGPTAdapter.isGenerating()` into focused helpers**

```js
const STOP_TEXT_FRAGMENTS = [
  "stop generating",
  "stop responding",
  "停止生成",
  "停止回应",
  "停止回复",
];

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasStructuralStopSignal(button) {
  const dataTestId = normalizeText(getAttribute(button, "data-testid"));
  const testId = normalizeText(getAttribute(button, "testid"));
  return dataTestId.includes("stop") || testId.includes("stop");
}

function hasLocalizedStopText(button) {
  const text = normalizeText(getAccessibleText(button));
  return STOP_TEXT_FRAGMENTS.some((fragment) => text.includes(fragment));
}
```

- [ ] **Step 2: Implement the minimal generation detection loop**

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

- [ ] **Step 3: Run the adapter test file and verify the new tests pass**

Run: `node --test tests/adapters/chatgpt.test.js`
Expected: PASS with all ChatGPT adapter tests green, including English, Chinese, and structure-first coverage.

- [ ] **Step 4: Run the broader focused suite for notification behavior**

Run: `node --test tests/adapters/chatgpt.test.js tests/content/completion-tracker.test.js tests/core/notifications.test.js`
Expected: PASS with zero failures, confirming the detection fix does not regress the completion tracker or notification gating logic.

- [ ] **Step 5: Commit the documentation and code together**

```bash
git add docs/superpowers/specs/2026-03-22-chatgpt-notification-detection-design.md \
        docs/superpowers/plans/2026-03-22-chatgpt-notification-detection.md \
        src/adapters/chatgpt.js \
        tests/adapters/chatgpt.test.js
git commit -m "fix: support localized ChatGPT notification detection"
```
