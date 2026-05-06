import type { AgentHintResult } from "./index.js";

const AGENT_SETUP: Record<string, string> = {
  codex:
    "Set AI_AGENT=codex in AGENTS.md instructions or the shell environment used for tool calls.",
  "claude-code": "Set AI_AGENT=claude-code in a PreToolUse hook or shell wrapper.",
  cursor: "Set AI_AGENT=cursor in Cursor agent hooks or workspace shell configuration.",
  gemini: "Set AI_AGENT=gemini in Gemini CLI hook or shell configuration.",
  copilot:
    "Set AI_AGENT=github-copilot-cli for Copilot CLI or AI_AGENT=github-copilot for Copilot agents.",
  windsurf: "Set AI_AGENT=windsurf in .windsurfrules or the workspace shell environment.",
  cline: "Set AI_AGENT=cline in .clinerules or the Cline shell environment.",
  "roo-code": "Set AI_AGENT=roo-code in Roo Code rules or shell environment.",
  kilocode: "Set AI_AGENT=kilocode in .kilocode rules or shell environment.",
  opencode: "Set AI_AGENT=opencode in an OpenCode plugin or shell environment.",
  openclaw: "Set AI_AGENT=openclaw in an OpenClaw plugin or shell environment.",
  antigravity: "Set AI_AGENT=antigravity in .agents rules or shell environment.",
};

export function formatDoctor(result: AgentHintResult): string {
  const lines = [
    "agenthint doctor",
    "",
    `status: ${result.isAgent ? "agent runtime likely detected" : "agent runtime not detected"}`,
    `agent: ${result.agent ?? "none"}`,
    `confidence: ${result.confidence.toFixed(2)}`,
    `signals: ${result.signals.length > 0 ? result.signals.join(", ") : "none"}`,
    "",
  ];

  if (result.signals.includes("env:AI_AGENT")) {
    lines.push("setup: AI_AGENT is set; this is the preferred explicit convention.");
  } else if (result.isAgent && result.agent != null) {
    lines.push(
      "setup: detection is heuristic. Prefer setting AI_AGENT for a stable explicit signal.",
    );
    lines.push(`hint: ${setupHint(result.agent)}`);
  } else {
    lines.push("setup: no agent signal was detected.");
    lines.push("hint: agents should set AI_AGENT=<agent-name> before invoking tools.");
  }

  lines.push("");
  lines.push("security: use this as a UX hint only, not as a trust boundary.");

  return lines.join("\n");
}

function setupHint(agent: string): string {
  return AGENT_SETUP[agent] ?? `Set AI_AGENT=${agent} in the agent's tool-call environment.`;
}
