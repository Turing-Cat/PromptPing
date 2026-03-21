export function text(value) {
  return {
    type: "text",
    text: value,
  };
}

export function element(tagName, options = {}, children = []) {
  return {
    type: "element",
    tagName: tagName.toLowerCase(),
    attrs: options.attrs ?? {},
    classList: options.classList ?? [],
    children: children.map((child) =>
      typeof child === "string" ? text(child) : child,
    ),
  };
}

