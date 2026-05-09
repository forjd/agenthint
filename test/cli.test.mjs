import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const cliCases = JSON.parse(readFileSync("fixtures/cli-cases.json", "utf8"));

describe("agenthint CLI", () => {
  it("matches shared CLI fixtures", () => {
    for (const fixture of cliCases) {
      const result = spawnSync(process.execPath, [CLI_PATH, ...fixture.args], {
        env: fixture.env,
        encoding: "utf8",
      });

      assert.equal(result.status, fixture.status, fixture.name);

      if (fixture.stdout != null) {
        assert.equal(result.stdout, fixture.stdout, fixture.name);
      }

      for (const expected of fixture.stdoutContains ?? []) {
        assert.match(result.stdout, new RegExp(expected), fixture.name);
      }
    }
  });

  it("exits 1 and prints JSON when no agent is detected", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--json"], {
      env: {},
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout), {
      isAgent: false,
      agent: null,
      confidence: 0,
      signals: [],
    });
  });

  it("exits 0 when forced", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "--explain"], {
      env: { AGENTHINT_FORCE: "1", AGENTHINT_AGENT: "codex" },
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /agent runtime likely detected/);
    assert.match(result.stdout, /agent: codex/);
  });

  it("prints doctor advice", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "doctor"], {
      env: { CODEX_SANDBOX: "1" },
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /agenthint doctor/);
    assert.match(result.stdout, /Prefer setting AI_AGENT/);
    assert.match(result.stdout, /AI_AGENT=codex/);
  });

  it("prints doctor advice as JSON", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "doctor", "--json"], {
      env: { CODEX_SANDBOX: "1" },
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "agent runtime likely detected",
      agent: "codex",
      confidence: 0.92,
      signals: ["env:CODEX_SANDBOX"],
      setup: {
        kind: "heuristic",
        message: "Detection is heuristic. Prefer setting AI_AGENT for a stable explicit signal.",
        hint: "Set AI_AGENT=codex in AGENTS.md instructions or the shell environment used for tool calls.",
      },
      security: "use this as a UX hint only, not as a trust boundary",
    });
  });

  it("prints init advice", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "init", "codex"], {
      env: {},
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /AI_AGENT=codex/);
  });

  it("exits 2 for invalid usage", () => {
    const unknown = spawnSync(process.execPath, [CLI_PATH, "bogus"], {
      env: {},
      encoding: "utf8",
    });
    const missingInitAgent = spawnSync(process.execPath, [CLI_PATH, "init"], {
      env: {},
      encoding: "utf8",
    });

    assert.equal(unknown.status, 2);
    assert.equal(unknown.stdout, "");
    assert.match(unknown.stderr, /invalid usage: bogus/);
    assert.equal(missingInitAgent.status, 2);
    assert.equal(missingInitAgent.stdout, "");
    assert.match(missingInitAgent.stderr, /agenthint init <agent-name>/);
  });
});
