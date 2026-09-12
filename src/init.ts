import { type AgentName, normalizeAgentName } from "./agent-names.js";
import { sanitizeForDisplay } from "./display.js";
import { MESSAGES } from "./generated-messages.js";

export function formatInit(agent: string | undefined): string {
  const normalized = normalizeInitAgent(agent);

  if (normalized == null) {
    return MESSAGES.init.usage;
  }

  return MESSAGES.init.output.replace("{agent}", sanitizeForDisplay(normalized));
}

function normalizeInitAgent(agent: string | undefined): AgentName | null {
  const normalized = normalizeAgentName(agent);

  if (normalized == null || normalized.startsWith("-")) {
    return null;
  }

  return normalized;
}
