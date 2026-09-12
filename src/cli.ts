#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { sanitizeForDisplay } from "./display.js";
import { formatDoctor, formatDoctorJson } from "./doctor.js";
import { MESSAGES } from "./generated-messages.js";
import { formatInit } from "./init.js";
import { detectAgent } from "./index.js";
import { trimWhitespace } from "./whitespace.js";

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 1 && (rawArgs[0] === "-h" || rawArgs[0] === "--help")) {
  printHelp();
  process.exit(0);
}

if (rawArgs.length === 1 && rawArgs[0] === "--version") {
  console.log(`agenthint ${packageVersion()}`);
  process.exit(0);
}

if (rawArgs[0] === "init") {
  const agent = rawArgs[1];

  if (
    rawArgs.length !== 2 ||
    agent == null ||
    trimWhitespace(agent) === "" ||
    agent.startsWith("-")
  ) {
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
  console.log(MESSAGES.help);
}

function printUsageError(message: string): never {
  console.error(sanitizeForDisplay(message));
  process.exit(2);
}

function formatExplanation(result: ReturnType<typeof detectAgent>): string {
  const status = result.isAgent ? MESSAGES.explain.detected : MESSAGES.explain.notDetected;
  const agent = result.agent ? `\nagent: ${sanitizeForDisplay(result.agent)}` : "";
  const confidence = `\nconfidence: ${result.confidence.toFixed(2)}`;
  const signals =
    result.signals.length > 0
      ? `\nsignals: ${result.signals.map(sanitizeForDisplay).join(", ")}`
      : "\nsignals: none";

  return `${status}${agent}${confidence}${signals}`;
}

function packageVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version?: string };

    return packageJson.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
