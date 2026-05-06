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

  it("prints init advice", () => {
    const result = spawnSync(process.execPath, [CLI_PATH, "init", "codex"], {
      env: {},
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /AI_AGENT=codex/);
  });
});
