export function resolveLocale(locale) {
  const normalized = (locale ?? "").toLowerCase();
  if (normalized.startsWith("zh")) {
    return "zh_CN";
  }

  return "en";
}

