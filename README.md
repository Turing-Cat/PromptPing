# PromptPing

[中文说明](./README.zh-CN.md)

PromptPing is a lightweight Chrome extension for chat sites.
It notifies you when a reply is finished and lets you export the current conversation as Markdown.

## Status

- Current support:
  - `ChatGPT`: notifications and export
  - `Claude`: notifications and export
  - `DeepSeek`: notifications and export
  - `Gemini`: notifications only
- Included:
  - Browser notification when a reply is finished
  - Export current conversation to Markdown on supported sites
  - Chinese and English UI

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder

## Usage

- Open a ChatGPT, Claude, DeepSeek, or Gemini conversation page
- On ChatGPT, Claude, or DeepSeek, click the extension icon to export the current chat
- Switch to another tab and wait for the reply to finish, then the browser will show a notification

## Notes

- Exported files are saved as `Markdown (.md)`
- If changes do not take effect after updating the code, reload the extension on the extensions page
