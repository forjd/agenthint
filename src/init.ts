import type { AgentName } from "./index.js";

const INIT_ALIASES: Record<string, AgentName> = {
  "github-copilot": "copilot",
  "github-copilot-cli": "copilot",
  roo: "roo-code",
  "kilo-code": "kilocode",
  vibe: "mistral-vibe",
};

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
  const value = agent?.trim();

  if (value == null || value === "") {
    return null;
  }

  if (value.startsWith("claude-code")) {
    return "claude-code";
  }

  return INIT_ALIASES[value] ?? value;
}
