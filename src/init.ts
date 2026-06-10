import { type AgentName, normalizeAgentName } from "./agent-names.js";

export function formatInit(agent: string | undefined): string {
  const normalized = normalizeInitAgent(agent);

  if (normalized == null) {
    return [
      "agenthint init",
      "",
      "Usage:",
      "  agenthint init <agent-name>",
      "",
      "Example:",
      "  agenthint init codex",
    ].join("\n");
  }

  return [
    `AI_AGENT=${normalized}`,
    "",
    "Use this value in the environment used for agent tool calls.",
  ].join("\n");
}

function normalizeInitAgent(agent: string | undefined): AgentName | null {
  const normalized = normalizeAgentName(agent);

  if (normalized == null || normalized.startsWith("-")) {
    return null;
  }

  return normalized;
}
