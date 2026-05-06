#!/usr/bin/env node
import { formatDoctor } from "./doctor.js";
import { formatInit } from "./init.js";
import { detectAgent } from "./index.js";

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);

if (args.has("-h") || args.has("--help")) {
  printHelp();
  process.exit(0);
}

const result = detectAgent();

if (args.has("init")) {
  console.log(formatInit(rawArgs[rawArgs.indexOf("init") + 1]));
  process.exit(0);
} else if (args.has("doctor")) {
  console.log(formatDoctor(result));
} else if (args.has("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else if (args.has("--explain")) {
  console.log(formatExplanation(result));
}

process.exit(result.isAgent ? 0 : 1);

function printHelp(): void {
  console.log(`agenthint

Detect whether the current process is probably running under an AI agent.

Usage:
  agenthint             Exit 0 if an agent is likely detected, otherwise 1
  agenthint init <name> Print the recommended AI_AGENT value
  agenthint doctor      Print detection details and setup advice
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help
`);
}

function formatExplanation(result: ReturnType<typeof detectAgent>): string {
  const status = result.isAgent ? "agent runtime likely detected" : "agent runtime not detected";
  const agent = result.agent ? `\nagent: ${result.agent}` : "";
  const confidence = `\nconfidence: ${result.confidence.toFixed(2)}`;
  const signals =
    result.signals.length > 0 ? `\nsignals: ${result.signals.join(", ")}` : "\nsignals: none";

  return `${status}${agent}${confidence}${signals}`;
}
