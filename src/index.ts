import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { type AgentName, type KnownAgent, normalizeAgentName } from "./agent-names.js";
import { ENVIRONMENT_RULES, PARENT_PROCESS_RULES, PREFIX_RULES } from "./generated-rules.js";
import { trimWhitespace } from "./whitespace.js";

export type { AgentName, KnownAgent } from "./agent-names.js";

export type AgentHintResult = {
  isAgent: boolean;
  agent: AgentName | null;
  confidence: number;
  signals: string[];
};

export type DetectAgentOptions = {
  env?: NodeJS.ProcessEnv;
  stdoutIsTTY?: boolean;
  stdinIsTTY?: boolean;
  checkFilesystem?: boolean;
  checkParentProcess?: boolean;
  parentProcessName?: string;
  getParentProcessName?: () => string | null | undefined;
  fileExists?: (path: string) => boolean;
};

type DetectionRule = {
  agent: KnownAgent | ((env: NodeJS.ProcessEnv) => KnownAgent);
  confidence: number;
  match(env: NodeJS.ProcessEnv): string[];
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const DETECTION_RULES: DetectionRule[] = [
  ...ENVIRONMENT_RULES.map((rule) => ({
    agent:
      rule.agent === "claude-code"
        ? (env: NodeJS.ProcessEnv) =>
            present(env, ["CLAUDE_CODE_IS_COWORK"]).length > 0 ? "cowork" : "claude-code"
        : rule.agent,
    confidence: rule.confidence,
    match: (env: NodeJS.ProcessEnv) => {
      const signals = present(env, [...rule.names]);

      if (rule.agent === "claude-code" && signals.length > 0) {
        signals.push(...present(env, ["CLAUDE_CODE_IS_COWORK"]));
      }

      return signals;
    },
  })),
  ...PREFIX_RULES.map((rule) => ({
    agent: rule.agent,
    confidence: rule.confidence,
    match: (env: NodeJS.ProcessEnv) => prefixPresent(env, rule.prefix),
  })),
];

export function detectAgent(options: DetectAgentOptions = {}): AgentHintResult {
  const env = options.env ?? process.env;

  if (isTruthy(env.AGENTHINT_DISABLE)) {
    return {
      isAgent: false,
      agent: null,
      confidence: 1,
      signals: ["env:AGENTHINT_DISABLE"],
    };
  }

  if (isTruthy(env.AGENTHINT_FORCE)) {
    return {
      isAgent: true,
      agent: normalizeAgentName(env.AGENTHINT_AGENT) ?? "unknown",
      confidence: 1,
      signals: ["env:AGENTHINT_FORCE"],
    };
  }

  const aiAgent = fromAiAgentEnvVar(env);
  if (aiAgent != null) {
    return aiAgent;
  }

  const matches = DETECTION_RULES.map((rule) => {
    const signals = rule.match(env);
    return { ...rule, signals };
  }).filter((rule) => rule.signals.length > 0);

  if (matches.length > 0) {
    const best = matches.reduce((currentBest, match) =>
      match.confidence > currentBest.confidence ? match : currentBest,
    );

    return {
      isAgent: true,
      agent: typeof best.agent === "function" ? best.agent(env) : best.agent,
      confidence: best.confidence,
      signals: [...new Set(matches.flatMap((match) => match.signals))],
    };
  }

  const filesystemResult = fromFileSystem(options);
  if (filesystemResult != null) {
    return filesystemResult;
  }

  const parentProcessResult = fromParentProcess(options);
  if (parentProcessResult != null) {
    return parentProcessResult;
  }

  const ttySignals = ttyHints(options);
  if (ttySignals.length > 0) {
    return {
      isAgent: false,
      agent: null,
      confidence: 0.2,
      signals: ttySignals,
    };
  }

  return {
    isAgent: false,
    agent: null,
    confidence: 0,
    signals: [],
  };
}

function fromAiAgentEnvVar(env: NodeJS.ProcessEnv): AgentHintResult | null {
  const agent = normalizeAgentName(env.AI_AGENT);

  if (agent == null) {
    return null;
  }

  return {
    isAgent: true,
    agent,
    confidence: 0.98,
    signals: ["env:AI_AGENT"],
  };
}

function fromFileSystem(options: DetectAgentOptions): AgentHintResult | null {
  if (options.checkFilesystem === false) {
    return null;
  }

  const fileExists = options.fileExists ?? existsSync;

  if (fileExists("/opt/.devin")) {
    return {
      isAgent: true,
      agent: "devin",
      confidence: 0.9,
      signals: ["file:/opt/.devin"],
    };
  }

  return null;
}

function fromParentProcess(options: DetectAgentOptions): AgentHintResult | null {
  if (options.checkParentProcess === false) {
    return null;
  }

  const rawName =
    options.parentProcessName ?? options.getParentProcessName?.() ?? parentProcessName();
  const name = normalizeProcessName(rawName);

  if (name == null) {
    return null;
  }

  const agent = agentFromProcessName(name);

  if (agent == null) {
    return null;
  }

  return {
    isAgent: true,
    agent,
    confidence: 0.55,
    signals: [`process:parent:${name}`],
  };
}

function parentProcessName(): string | null {
  const ppid = process.ppid;

  if (ppid == null || ppid <= 0) {
    return null;
  }

  try {
    return trimWhitespace(readFileSync(`/proc/${ppid}/comm`, "utf8"));
  } catch {
    // Fall through to ps for platforms without /proc, including macOS.
  }

  try {
    return trimWhitespace(
      execFileSync("ps", ["-o", "comm=", "-p", String(ppid)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null;
  }
}

function normalizeProcessName(value: string | null | undefined): string | null {
  const trimmed = value == null ? null : trimWhitespace(value);

  if (trimmed == null || trimmed === "") {
    return null;
  }

  return basename(trimmed)
    .replace(/\.exe$/i, "")
    .toLowerCase();
}

function agentFromProcessName(name: string): KnownAgent | null {
  return (
    PARENT_PROCESS_RULES.find((rule) => (rule.names as readonly string[]).includes(name))?.agent ??
    null
  );
}

function present(env: NodeJS.ProcessEnv, names: string[]): string[] {
  return names.filter((name) => hasValue(env[name])).map((name) => `env:${name}`);
}

function prefixPresent(env: NodeJS.ProcessEnv, prefix: string): string[] {
  return Object.keys(env)
    .filter((name) => name.startsWith(prefix) && hasValue(env[name]))
    .map((name) => `env:${name}`)
    .sort();
}

function hasValue(value: string | undefined): boolean {
  return value != null && trimWhitespace(value) !== "";
}

function isTruthy(value: string | undefined): boolean {
  return value != null && TRUE_VALUES.has(value.toLowerCase());
}

function ttyHints(options: DetectAgentOptions): string[] {
  const signals: string[] = [];

  if (options.stdoutIsTTY === false) {
    signals.push("stdio:stdout-not-tty");
  }

  if (options.stdinIsTTY === false) {
    signals.push("stdio:stdin-not-tty");
  }

  return signals;
}
