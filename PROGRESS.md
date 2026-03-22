# Progress

## Current Status

- Project scaffold created for a Chrome Manifest V3 extension
- ChatGPT export to Markdown is working
- ChatGPT completion notification flow is implemented and validated on the live page
- Claude export and completion notification support are implemented
- DeepSeek export and completion notification support are implemented and validated on the live page
- Bilingual documentation has been added

## Scope

- Current support: `ChatGPT`, `Claude`, `DeepSeek`
- README has been split into English and Chinese versions

## Recent Milestones

- Initialized the repository and extension structure
- Added popup, background worker, content script, and shared core modules
- Added tests for markdown export, notifications, locale handling, and adapters
- Added project documentation and bilingual README files
- Fixed localized ChatGPT completion detection so Chinese UI can trigger notifications
- Replaced the notification icon with a raster asset so Chrome can render notifications
- Fixed content script reload behavior so extension reloads do not leave ChatGPT tabs stuck on an invalidated context
- Added DeepSeek host permissions, adapter coverage, popup support checks, and export integration
- Reworked DeepSeek export to read the authenticated `history_messages` API instead of relying on virtualized DOM content
- Hardened content script reinjection so extension reloads replace stale runtime instances on already-open tabs
- Fixed DeepSeek completion detection by polling fresh history data and using stable assistant message markers for short replies

## Next Steps

- Keep validating notification behavior as supported sites change their DOM and network payload shapes over time
- Consider expanding the documented usage examples beyond ChatGPT so the README matches the current support matrix
- Consider removing or cleaning up the legacy `feature/chrome-extension` branch now that `main` is the remote default branch
