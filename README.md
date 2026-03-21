# PromptPing

简洁的 Chrome 扩展，用来提醒你 ChatGPT 回复已完成，并导出当前聊天为 Markdown。

A lightweight Chrome extension that notifies you when ChatGPT finishes replying and lets you export the current chat as Markdown.

## 当前状态 | Status

- 当前主要支持：`ChatGPT`
- 已实现：
  - 回复完成后浏览器通知
  - 导出当前会话为 Markdown
  - 中英文界面

- Current primary support: `ChatGPT`
- Included:
  - Browser notification when a reply is finished
  - Export current conversation to Markdown
  - Chinese and English UI

## 安装 | Install

1. 打开 `chrome://extensions`
2. 打开“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目目录

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder

## 使用 | Usage

- 打开 ChatGPT 会话页面
- 点击扩展图标，可以导出当前聊天
- 切换到别的标签页后，等待 ChatGPT 回复完成，浏览器会发送提醒

- Open a ChatGPT conversation page
- Click the extension icon to export the current chat
- Switch to another tab and wait for ChatGPT to finish, then the browser will show a notification

## 说明 | Notes

- 导出文件格式为 `Markdown (.md)`
- 如果更新代码后功能没有变化，请在扩展页面点击“重新加载”

- Exported files are saved as `Markdown (.md)`
- If changes do not take effect after updating the code, reload the extension on the extensions page
