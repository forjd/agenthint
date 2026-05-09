import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { detectAgent } from "../dist/index.js";

const fixtureCases = JSON.parse(readFileSync("fixtures/detection-cases.json", "utf8"));

describe("detectAgent", () => {
  it("matches shared detection fixtures", () => {
    for (const fixture of fixtureCases) {
      const result = detectAgent({
        env: fixture.env,
        checkFilesystem: false,
        checkParentProcess: false,
      });

      assert.equal(result.isAgent, fixture.isAgent, fixture.name);
      assert.equal(result.agent, fixture.agent, fixture.name);
      assert.equal(result.confidence, fixture.confidence, fixture.name);
      assert.deepEqual(result.signals, fixture.signals, fixture.name);
    }
  });

  it("prioritizes AI_AGENT over known environment signals", () => {
    const result = detectAgent({ env: { AI_AGENT: "custom-agent", CURSOR_AGENT: "1" } });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "custom-agent");
    assert.equal(result.confidence, 0.98);
    assert.deepEqual(result.signals, ["env:AI_AGENT"]);
  });

  it("trims and ignores empty AI_AGENT values", () => {
    const result = detectAgent({
      env: { AI_AGENT: "  " },
      checkFilesystem: false,
      checkParentProcess: false,
    });

    assert.equal(result.isAgent, false);
    assert.equal(result.agent, null);
  });

  it("normalizes AI_AGENT aliases for known agents", () => {
    const copilot = detectAgent({ env: { AI_AGENT: "github-copilot-cli" } });
    const claude = detectAgent({ env: { AI_AGENT: "claude-code/2.1.123/agent" } });

    assert.equal(copilot.agent, "copilot");
    assert.equal(claude.agent, "claude-code");
  });

  it("detects Codex from CODEX_HOME", () => {
    const result = detectAgent({ env: { CODEX_HOME: "/tmp/codex" } });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "codex");
    assert.equal(result.confidence, 0.92);
    assert.deepEqual(result.signals, ["env:CODEX_HOME"]);
  });

  it("detects Claude Code from CLAUDECODE", () => {
    const result = detectAgent({ env: { CLAUDECODE: "1" } });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "claude-code");
    assert.deepEqual(result.signals, ["env:CLAUDECODE"]);
  });

  it("detects Cowork only when a Claude signal is present", () => {
    const cowork = detectAgent({ env: { CLAUDE_CODE: "1", CLAUDE_CODE_IS_COWORK: "1" } });
    const notCowork = detectAgent({
      env: { CLAUDE_CODE_IS_COWORK: "1" },
      checkFilesystem: false,
      checkParentProcess: false,
    });

    assert.equal(cowork.isAgent, true);
    assert.equal(cowork.agent, "cowork");
    assert.equal(notCowork.isAgent, false);
  });

  it("detects Aider from AIDER-prefixed environment variables", () => {
    const result = detectAgent({ env: { AIDER_MODEL: "sonnet" } });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "aider");
    assert.deepEqual(result.signals, ["env:AIDER_MODEL"]);
  });

  it("detects additional known agent environment signals", () => {
    const cases = [
      ["cursor", { CURSOR_AGENT: "1" }],
      ["gemini", { GEMINI_CLI: "true" }],
      ["augment-cli", { AUGMENT_AGENT: "true" }],
      ["amp", { AMP_CURRENT_THREAD_ID: "thread-id" }],
      ["opencode", { OPENCODE_CLIENT: "true" }],
      ["copilot", { COPILOT_CLI: "1" }],
      ["replit", { REPL_ID: "repl-id" }],
      ["antigravity", { ANTIGRAVITY_AGENT: "1" }],
      ["pi", { PI_CODING_AGENT: "true" }],
      ["kiro-cli", { KIRO_AGENT_PATH: "/usr/local/bin/kiro" }],
      ["windsurf", { WINDSURF_AGENT: "1" }],
      ["cline", { CLINE_AGENT: "1" }],
      ["roo-code", { ROO_CODE_AGENT: "1" }],
      ["kilocode", { KILOCODE_AGENT: "1" }],
      ["openclaw", { OPENCLAW_AGENT: "1" }],
    ];

    for (const [agent, env] of cases) {
      const result = detectAgent({ env });

      assert.equal(result.isAgent, true);
      assert.equal(result.agent, agent);
    }
  });

  it("normalizes RTK-inspired AI_AGENT aliases", () => {
    const roo = detectAgent({ env: { AI_AGENT: "roo" } });
    const kilo = detectAgent({ env: { AI_AGENT: "kilo-code" } });
    const vibe = detectAgent({ env: { AI_AGENT: "vibe" } });
    const v0 = detectAgent({ env: { AI_AGENT: "v0" } });

    assert.equal(roo.agent, "roo-code");
    assert.equal(kilo.agent, "kilocode");
    assert.equal(vibe.agent, "mistral-vibe");
    assert.equal(v0.agent, "v0");
  });

  it("detects Devin from the filesystem marker", () => {
    const result = detectAgent({
      env: {},
      fileExists: (path) => path === "/opt/.devin",
    });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "devin");
    assert.deepEqual(result.signals, ["file:/opt/.devin"]);
  });

  it("detects known parent process names at low confidence", () => {
    const result = detectAgent({
      env: {},
      checkFilesystem: false,
      parentProcessName: "/usr/local/bin/codex",
    });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "codex");
    assert.equal(result.confidence, 0.55);
    assert.deepEqual(result.signals, ["process:parent:codex"]);
  });

  it("can skip parent process checks", () => {
    const result = detectAgent({
      env: {},
      checkFilesystem: false,
      checkParentProcess: false,
      parentProcessName: "codex",
    });

    assert.equal(result.isAgent, false);
    assert.equal(result.agent, null);
  });

  it("can skip filesystem checks", () => {
    const result = detectAgent({
      env: {},
      checkFilesystem: false,
      checkParentProcess: false,
      fileExists: () => true,
    });

    assert.equal(result.isAgent, false);
    assert.equal(result.agent, null);
  });

  it("uses known environment priority order", () => {
    const cursorWins = detectAgent({ env: { CURSOR_AGENT: "1", CLAUDECODE: "1" } });
    const claudeWins = detectAgent({ env: { CLAUDECODE: "1", REPL_ID: "repl-id" } });
    const strongerWins = detectAgent({ env: { REPL_ID: "repl-id", ANTIGRAVITY_AGENT: "1" } });

    assert.equal(cursorWins.agent, "cursor");
    assert.equal(claudeWins.agent, "claude-code");
    assert.equal(strongerWins.agent, "antigravity");
    assert.equal(strongerWins.confidence, 0.9);
  });

  it("supports AGENTHINT_FORCE", () => {
    const result = detectAgent({ env: { AGENTHINT_FORCE: "true", AGENTHINT_AGENT: "cursor" } });

    assert.equal(result.isAgent, true);
    assert.equal(result.agent, "cursor");
    assert.equal(result.confidence, 1);
    assert.deepEqual(result.signals, ["env:AGENTHINT_FORCE"]);
  });

  it("lets AGENTHINT_DISABLE override other signals", () => {
    const result = detectAgent({ env: { AGENTHINT_DISABLE: "1", CODEX_HOME: "/tmp/codex" } });

    assert.equal(result.isAgent, false);
    assert.equal(result.agent, null);
    assert.equal(result.confidence, 1);
    assert.deepEqual(result.signals, ["env:AGENTHINT_DISABLE"]);
  });

  it("reports low-confidence stdio hints without marking them as an agent", () => {
    const result = detectAgent({
      env: {},
      checkFilesystem: false,
      checkParentProcess: false,
      stdoutIsTTY: false,
      stdinIsTTY: false,
    });

    assert.equal(result.isAgent, false);
    assert.equal(result.agent, null);
    assert.equal(result.confidence, 0.2);
    assert.deepEqual(result.signals, ["stdio:stdout-not-tty", "stdio:stdin-not-tty"]);
  });
});
