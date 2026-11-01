import { type GeneratedKnownAgent, KNOWN_AGENTS } from "./generated-rules.js";
import { trimWhitespace } from "./whitespace.js";

export type KnownAgent = GeneratedKnownAgent;

export type AgentName = KnownAgent | (string & {});

const KNOWN_AGENT_NAMES: ReadonlySet<string> = new Set(KNOWN_AGENTS);

const AGENT_ALIASES: Readonly<Record<string, KnownAgent>> = {
  "github-copilot": "copilot",
  "github-copilot-cli": "copilot",
  roo: "roo-code",
  "kilo-code": "kilocode",
  vibe: "mistral-vibe",
};

// Agents that set AI_AGENT natively add a version or surface after a
// separator, for example `claude-code_2-1-316_agent` from Claude Code or
// `github_copilot_vscode_agent` from VS Code.
const AGENT_PREFIXES: ReadonlyArray<readonly [string, KnownAgent]> = [
  ["claude-code/", "claude-code"],
  ["claude-code_", "claude-code"],
  ["github_copilot_", "copilot"],
];

// Known names and aliases match case-insensitively. Only ASCII letters are
// folded so every implementation agrees (see SPEC.md). Custom names keep
// their original case.
export function normalizeAgentName(value: string | undefined): AgentName | null {
  const normalized = value == null ? null : trimWhitespace(value);

  if (normalized == null || normalized === "") {
    return null;
  }

  const lower = asciiLowercase(normalized);
  const alias = Object.hasOwn(AGENT_ALIASES, lower) ? AGENT_ALIASES[lower] : undefined;

  if (alias != null) {
    return alias;
  }

  const prefixed = AGENT_PREFIXES.find(([prefix]) => lower.startsWith(prefix));

  if (prefixed != null) {
    return prefixed[1];
  }

  if (KNOWN_AGENT_NAMES.has(lower)) {
    return lower;
  }

  return normalized;
}

function asciiLowercase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}
