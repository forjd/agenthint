import { existsSync } from "node:fs";

export type KnownAgent =
  | "codex"
  | "claude-code"
  | "cowork"
  | "aider"
  | "cursor"
  | "gemini"
  | "augment-cli"
  | "amp"
  | "opencode"
  | "copilot"
  | "replit"
  | "devin"
  | "antigravity"
  | "pi"
  | "kiro-cli"
  | "windsurf"
  | "cline"
  | "roo-code"
  | "kilocode"
  | "openclaw"
  | "mistral-vibe"
  | "v0"
  | "unknown";

export type AgentName = KnownAgent | (string & {});

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
  fileExists?: (path: string) => boolean;
};

type DetectionRule = {
  agent: KnownAgent | ((env: NodeJS.ProcessEnv) => KnownAgent);
  confidence: number;
  match(env: NodeJS.ProcessEnv): string[];
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const DETECTION_RULES: DetectionRule[] = [
  {
    agent: "cursor",
    confidence: 0.92,
    match: (env) => present(env, ["CURSOR_AGENT"]),
  },
  {
    agent: "gemini",
    confidence: 0.92,
    match: (env) => present(env, ["GEMINI_CLI"]),
  },
  {
    agent: "codex",
    confidence: 0.92,
    match: (env) =>
      present(env, [
        "CODEX_SANDBOX",
        "CODEX_CI",
        "CODEX_THREAD_ID",
        "CODEX_HOME",
        "CODEX_USER_AGENT",
      ]),
  },
  {
    agent: "augment-cli",
    confidence: 0.9,
    match: (env) => present(env, ["AUGMENT_AGENT"]),
  },
  {
    agent: "amp",
    confidence: 0.9,
    match: (env) => present(env, ["AMP_CURRENT_THREAD_ID"]),
  },
  {
    agent: "opencode",
    confidence: 0.9,
    match: (env) => present(env, ["OPENCODE_CLIENT", "OPENCODE"]),
  },
  {
    agent: (env) => (present(env, ["CLAUDE_CODE_IS_COWORK"]).length > 0 ? "cowork" : "claude-code"),
    confidence: 0.9,
    match: (env) => present(env, ["CLAUDECODE", "CLAUDE_CODE", "CLAUDECODE_CWD"]),
  },
  {
    agent: "copilot",
    confidence: 0.88,
    match: (env) =>
      present(env, ["COPILOT_MODEL", "COPILOT_ALLOW_ALL", "COPILOT_GITHUB_TOKEN", "COPILOT_CLI"]),
  },
  {
    agent: "aider",
    confidence: 0.86,
    match: (env) => prefixPresent(env, "AIDER_"),
  },
  {
    agent: "cursor",
    confidence: 0.82,
    match: (env) => prefixPresent(env, "CURSOR_"),
  },
  {
    agent: "replit",
    confidence: 0.65,
    match: (env) => present(env, ["REPL_ID"]),
  },
  {
    agent: "antigravity",
    confidence: 0.9,
    match: (env) => present(env, ["ANTIGRAVITY_AGENT"]),
  },
  {
    agent: "pi",
    confidence: 0.9,
    match: (env) => present(env, ["PI_CODING_AGENT"]),
  },
  {
    agent: "kiro-cli",
    confidence: 0.9,
    match: (env) => present(env, ["KIRO_AGENT_PATH"]),
  },
  {
    agent: "windsurf",
    confidence: 0.82,
    match: (env) => present(env, ["WINDSURF_AGENT"]),
  },
  {
    agent: "cline",
    confidence: 0.82,
    match: (env) => present(env, ["CLINE_AGENT"]),
  },
  {
    agent: "roo-code",
    confidence: 0.82,
    match: (env) => present(env, ["ROO_CODE_AGENT", "ROO_CODE"]),
  },
  {
    agent: "kilocode",
    confidence: 0.82,
    match: (env) => present(env, ["KILOCODE_AGENT"]),
  },
  {
    agent: "openclaw",
    confidence: 0.82,
    match: (env) => present(env, ["OPENCLAW_AGENT"]),
  },
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
    const best = matches[0];

    return {
      isAgent: true,
      agent: typeof best.agent === "function" ? best.agent(env) : best.agent,
      confidence: best.confidence,
      signals: matches.flatMap((match) => match.signals),
    };
  }

  const filesystemResult = fromFileSystem(options);
  if (filesystemResult != null) {
    return filesystemResult;
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
  const value = env.AI_AGENT?.trim();

  if (value == null || value === "") {
    return null;
  }

  return {
    isAgent: true,
    agent: normalizeAgentName(value) ?? value,
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

function present(env: NodeJS.ProcessEnv, names: string[]): string[] {
  return names.filter((name) => env[name] != null && env[name] !== "").map((name) => `env:${name}`);
}

function prefixPresent(env: NodeJS.ProcessEnv, prefix: string): string[] {
  return Object.keys(env)
    .filter((name) => name.startsWith(prefix) && env[name] != null && env[name] !== "")
    .map((name) => `env:${name}`);
}

function isTruthy(value: string | undefined): boolean {
  return value != null && TRUE_VALUES.has(value.toLowerCase());
}

function normalizeAgentName(value: string | undefined): AgentName | null {
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

  if (isKnownAgent(normalized)) {
    return normalized;
  }

  return normalized;
}

function isKnownAgent(value: string): value is KnownAgent {
  return (
    value === "codex" ||
    value === "claude-code" ||
    value === "cowork" ||
    value === "aider" ||
    value === "cursor" ||
    value === "gemini" ||
    value === "augment-cli" ||
    value === "amp" ||
    value === "opencode" ||
    value === "copilot" ||
    value === "replit" ||
    value === "devin" ||
    value === "antigravity" ||
    value === "pi" ||
    value === "kiro-cli" ||
    value === "windsurf" ||
    value === "cline" ||
    value === "roo-code" ||
    value === "kilocode" ||
    value === "openclaw" ||
    value === "mistral-vibe" ||
    value === "v0" ||
    value === "unknown"
  );
}

function ttyHints(options: DetectAgentOptions): string[] {
  const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY;
  const stdinIsTTY = options.stdinIsTTY ?? process.stdin.isTTY;
  const signals: string[] = [];

  if (stdoutIsTTY === false) {
    signals.push("stdio:stdout-not-tty");
  }

  if (stdinIsTTY === false) {
    signals.push("stdio:stdin-not-tty");
  }

  return signals;
}
