import type { GeneratedKnownAgent } from "./generated-rules.js";

export type KnownAgent = GeneratedKnownAgent;

export type AgentName = KnownAgent | (string & {});

export function normalizeAgentName(value: string | undefined): AgentName | null {
  const normalized = value?.trim();

  if (normalized == null || normalized === "") {
    return null;
  }

  if (normalized === "github-copilot" || normalized === "github-copilot-cli") {
    return "copilot";
  }

  if (normalized.startsWith("claude-code")) {
    return "claude-code";
  }

  if (normalized === "roo" || normalized === "roo-code") {
    return "roo-code";
  }

  if (normalized === "kilo-code" || normalized === "kilocode") {
    return "kilocode";
  }

  if (normalized === "mistral-vibe" || normalized === "vibe") {
    return "mistral-vibe";
  }

  return normalized;
}
