# Chat Notifier + Markdown Export Design

## Goal
Build a Chrome extension that supports ChatGPT and Claude with three user-facing capabilities:
- browser notifications when a model response finishes while the tab is in the background
- exporting the current conversation to Markdown
- Chinese and English UI strings, following browser locale

## Architecture
The extension uses Manifest V3 with four major pieces:
- a background service worker for notification delivery and Markdown downloads
- a content script for site detection, DOM observation, and conversation extraction
- a popup for supported-page status and export action
- a site adapter layer so ChatGPT and Claude share common behavior through a stable interface

## Site Adapters
Each site adapter exposes:
- `matchesLocation(url)`
- `getSiteName()`
- `extractConversation(snapshot, pageTitle)`
- `isGenerating(snapshot)`
- `getLatestAssistantFingerprint(snapshot)`

The content script uses these adapters against a normalized DOM snapshot. This keeps extraction and completion detection testable outside the browser.

## Completion Notifications
The content script tracks response generation via adapter heuristics and a previous-state flag:
1. while a site is generating, mark the tab as pending completion
2. once generation stops, compute a fingerprint from the latest assistant message
3. send the fingerprint to the background worker
4. the background worker compares sender tab id with the active tab id and only shows a notification for background tabs
5. duplicate fingerprints are ignored

## Markdown Export
Export starts from the popup:
1. popup checks whether the current tab is supported
2. popup requests a structured conversation from the content script
3. background converts the conversation to Markdown
4. background triggers a `.md` download

Markdown format:
- top-level `#` title with the conversation title
- ordered `## User` / `## Assistant` sections
- paragraphs preserved as text blocks
- lists preserved as Markdown lists
- fenced code blocks preserved with optional language metadata

First version excludes images, file attachments, and rich citation cards.

## Internationalization
Extension-owned text lives in `_locales/en/messages.json` and `_locales/zh_CN/messages.json`.
The popup UI, notification copy, and fallback labels use Chrome i18n APIs.
Conversation content is never translated.

## Acceptance Criteria
1. ChatGPT and Claude both notify once when a background-tab response finishes.
2. Export downloads a Markdown file containing the full current conversation in order.
3. Unsupported pages show a localized unsupported message in the popup.
4. Browser locale selects Chinese or English UI automatically, with English fallback.

