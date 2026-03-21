# Chat Notifier + Markdown Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency Chrome MV3 extension that notifies on completed background-tab responses and exports the current ChatGPT or Claude conversation to Markdown with zh/en localization.

**Architecture:** Normalize live DOM into a testable snapshot, route site behavior through adapters, keep popup logic thin, and centralize notification/download logic in the background worker. Use Node's built-in test runner for TDD because the repository starts empty.

**Tech Stack:** JavaScript ES modules, Chrome Extensions Manifest V3, Node 24 `node:test`

---

### Task 1: Bootstrap project and save docs

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `docs/superpowers/specs/2026-03-21-chat-notify-export-design.md`
- Create: `docs/superpowers/plans/2026-03-21-chat-notifier-export.md`

- [ ] Save the approved design doc
- [ ] Save the execution plan doc
- [ ] Add a zero-dependency test script

### Task 2: Write failing tests for shared logic

**Files:**
- Create: `tests/core/markdown.test.js`
- Create: `tests/core/i18n.test.js`
- Create: `tests/core/notifications.test.js`
- Create: `tests/content/completion-tracker.test.js`

- [ ] Write failing tests for Markdown rendering and filename generation
- [ ] Write failing tests for locale resolution and duplicate notification protection
- [ ] Write failing tests for generation completion state transitions
- [ ] Run `npm test` and confirm failures

### Task 3: Write failing tests for adapters

**Files:**
- Create: `tests/helpers/snapshot-builder.js`
- Create: `tests/adapters/chatgpt.test.js`
- Create: `tests/adapters/claude.test.js`
- Create: `tests/adapters/registry.test.js`

- [ ] Write ChatGPT extraction and generation-detection tests
- [ ] Write Claude extraction and generation-detection tests
- [ ] Write adapter selection tests
- [ ] Run `npm test` and confirm failures

### Task 4: Implement shared runtime modules

**Files:**
- Create: `src/core/snapshot.js`
- Create: `src/core/markdown.js`
- Create: `src/core/i18n.js`
- Create: `src/core/notifications.js`
- Create: `src/content/completion-tracker.js`

- [ ] Implement DOM snapshot normalization
- [ ] Implement Markdown generation and filename sanitization
- [ ] Implement locale resolution helpers
- [ ] Implement notification gating and completion tracking
- [ ] Run `npm test`

### Task 5: Implement adapters and browser entrypoints

**Files:**
- Create: `src/adapters/chatgpt.js`
- Create: `src/adapters/claude.js`
- Create: `src/adapters/index.js`
- Create: `src/content/index.js`
- Create: `src/background/index.js`
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.js`
- Create: `src/popup/popup.css`
- Create: `_locales/en/messages.json`
- Create: `_locales/zh_CN/messages.json`
- Create: `manifest.json`
- Create: `assets/icon.svg`

- [ ] Implement site adapters against normalized snapshots
- [ ] Wire content script messaging and mutation observation
- [ ] Wire background notifications and downloads
- [ ] Build popup status/export flow and localized strings
- [ ] Add manifest and host permissions
- [ ] Run `npm test`

### Task 6: Final verification

**Files:**
- Verify: entire repository

- [ ] Run `npm test`
- [ ] Review generated file tree
- [ ] Compare the result against acceptance criteria

