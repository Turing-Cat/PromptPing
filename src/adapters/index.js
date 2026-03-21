import { ChatGPTAdapter } from "./chatgpt.js";
import { ClaudeAdapter } from "./claude.js";
import { DeepSeekAdapter } from "./deepseek.js";

const ADAPTERS = [ChatGPTAdapter, ClaudeAdapter, DeepSeekAdapter];

export function getAdapterForUrl(url) {
  return ADAPTERS.find((adapter) => adapter.matchesLocation(url)) ?? null;
}

export function isSupportedUrl(url) {
  return getAdapterForUrl(url) !== null;
}
