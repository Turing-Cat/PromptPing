# PromptPing

[English](./README.md)

PromptPing 是一个面向聊天网站的轻量 Chrome 扩展。
它可以在回复完成后发送浏览器提醒，并把当前会话导出为 Markdown。

## 当前状态

- 当前支持：
  - `ChatGPT`：通知和导出
  - `Claude`：通知和导出
  - `DeepSeek`：通知和导出
  - `Gemini`：仅通知
- 已实现：
  - 回复完成后浏览器通知
  - 在支持导出的站点将当前会话导出为 Markdown
  - 中英文界面

## 安装

1. 打开 `chrome://extensions`
2. 打开“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目目录

## 使用

- 打开 ChatGPT、Claude、DeepSeek 或 Gemini 会话页面
- 在 ChatGPT、Claude 或 DeepSeek 页面点击扩展图标导出当前聊天
- 切换到其他标签页后，等待回复完成，浏览器会发送提醒

## 说明

- 导出文件格式为 `Markdown (.md)`
- 如果更新代码后功能没有变化，请在扩展页面点击“重新加载”
