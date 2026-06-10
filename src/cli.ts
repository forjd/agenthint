#!/usr/bin/env node
import { formatDoctor, formatDoctorJson } from "./doctor.js";
import { formatInit } from "./init.js";
import { detectAgent } from "./index.js";

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 1 && (rawArgs[0] === "-h" || rawArgs[0] === "--help")) {
  printHelp();
  process.exit(0);
}

if (rawArgs[0] === "init") {
  const agent = rawArgs[1];

  if (rawArgs.length !== 2 || agent == null || agent.trim() === "" || agent.startsWith("-")) {
    printUsageError(formatInit(undefined));
  }

  console.log(formatInit(agent));
  process.exit(0);
}

const validArgs =
  rawArgs.length === 0 ||
  (rawArgs.length === 1 && (rawArgs[0] === "--json" || rawArgs[0] === "--explain")) ||
  (rawArgs.length === 1 && rawArgs[0] === "doctor") ||
  (rawArgs.length === 2 && rawArgs[0] === "doctor" && rawArgs[1] === "--json");

if (!validArgs) {
  printUsageError(`invalid usage: ${rawArgs.join(" ")}`);
}

const result = detectAgent();

if (rawArgs[0] === "doctor") {
  console.log(rawArgs[1] === "--json" ? formatDoctorJson(result) : formatDoctor(result));
} else if (rawArgs[0] === "--json") {
  console.log(JSON.stringify(result, null, 2));
} else if (rawArgs[0] === "--explain") {
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
  agenthint doctor --json
                        Print detection details and setup advice as JSON
  agenthint --json      Print the structured detection result
  agenthint --explain   Print a short human-readable explanation
  agenthint --help      Show this help
`);
}

function printUsageError(message: string): never {
  console.error(message);
  process.exit(2);
}

function formatExplanation(result: ReturnType<typeof detectAgent>): string {
  const status = result.isAgent ? "agent runtime likely detected" : "agent runtime not detected";
  const agent = result.agent ? `\nagent: ${result.agent}` : "";
  const confidence = `\nconfidence: ${result.confidence.toFixed(2)}`;
  const signals =
    result.signals.length > 0 ? `\nsignals: ${result.signals.join(", ")}` : "\nsignals: none";

  return `${status}${agent}${confidence}${signals}`;
}
