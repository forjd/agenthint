// Native trim functions disagree on non-ASCII whitespace, so every
// implementation trims this exact ASCII set instead (see SPEC.md).
const EDGE_WHITESPACE = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g;

export function trimWhitespace(value: string): string {
  return value.replace(EDGE_WHITESPACE, "");
}
