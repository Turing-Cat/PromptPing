import { ChatGPTAdapter } from "./chatgpt.js";
import { ClaudeAdapter } from "./claude.js";
import { DeepSeekAdapter } from "./deepseek.js";
import { GeminiAdapter } from "./gemini.js";

const ADAPTERS = [ChatGPTAdapter, ClaudeAdapter, DeepSeekAdapter, GeminiAdapter];

export function getAdapterForUrl(url) {
  return ADAPTERS.find((adapter) => adapter.matchesLocation(url)) ?? null;
}

export function isSupportedUrl(url) {
  return getAdapterForUrl(url) !== null;
}
