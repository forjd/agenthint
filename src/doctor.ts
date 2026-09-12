import { sanitizeForDisplay } from "./display.js";
import { MESSAGES } from "./generated-messages.js";
import type { AgentHintResult } from "./index.js";

export function formatDoctor(result: AgentHintResult): string {
  const lines = [
    "agenthint doctor",
    "",
    `status: ${result.isAgent ? MESSAGES.doctor.status.detected : MESSAGES.doctor.status.notDetected}`,
    `agent: ${result.agent == null ? "none" : sanitizeForDisplay(result.agent)}`,
    `confidence: ${result.confidence.toFixed(2)}`,
    `signals: ${
      result.signals.length > 0 ? result.signals.map(sanitizeForDisplay).join(", ") : "none"
    }`,
    "",
  ];

  const setup = setupAdvice(result);

  if (setup.kind === "explicit") {
    lines.push(MESSAGES.doctor.explicitText);
  } else if (setup.kind === "heuristic") {
    lines.push(MESSAGES.doctor.heuristicText);
    lines.push(`hint: ${sanitizeForDisplay(setup.hint ?? "")}`);
  } else {
    lines.push(MESSAGES.doctor.missingText);
    lines.push(MESSAGES.doctor.missingHintText);
  }

  lines.push("");
  lines.push(MESSAGES.doctor.securityText);

  return lines.join("\n");
}

export function formatDoctorJson(result: AgentHintResult): string {
  return JSON.stringify(
    {
      status: result.isAgent ? MESSAGES.doctor.status.detected : MESSAGES.doctor.status.notDetected,
      agent: result.agent,
      confidence: result.confidence,
      signals: result.signals,
      setup: setupAdvice(result),
      security: MESSAGES.doctor.securityJson,
    },
    null,
    2,
  );
}

function setupAdvice(result: AgentHintResult): { kind: string; message: string; hint?: string } {
  if (result.signals.includes("env:AI_AGENT")) {
    return {
      kind: "explicit",
      message: MESSAGES.doctor.explicitMessage,
    };
  }

  if (result.isAgent) {
    return {
      kind: "heuristic",
      message: MESSAGES.doctor.heuristicMessage,
      hint: setupHint(result.agent ?? "unknown"),
    };
  }

  return {
    kind: "missing",
    message: MESSAGES.doctor.missingMessage,
    hint: MESSAGES.doctor.missingHint,
  };
}

function setupHint(agent: string): string {
  const hints = MESSAGES.doctor.agentHints as Record<string, string>;

  return hints[agent] ?? MESSAGES.doctor.fallbackHint.replace("{agent}", () => agent);
}
