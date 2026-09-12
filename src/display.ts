// Unicode general category Cc (C0, DEL, and C1) and lone surrogates (Cs)
// are replaced so terminal escape sequences in env-derived values cannot
// reach human-readable output. JSON output relies on standard JSON escaping
// instead.
const REPLACEMENT_CHARACTER = "\uFFFD";

export function sanitizeForDisplay(value: string): string {
  let sanitized = "";

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControl = codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    const isLoneSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;

    sanitized += isControl || isLoneSurrogate ? REPLACEMENT_CHARACTER : character;
  }

  return sanitized;
}
