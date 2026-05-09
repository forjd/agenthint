# agenthint

[![CI](https://github.com/forjd/agenthint/actions/workflows/ci.yml/badge.svg)](https://github.com/forjd/agenthint/actions/workflows/ci.yml)
[![Release](https://github.com/forjd/agenthint/actions/workflows/release.yml/badge.svg)](https://github.com/forjd/agenthint/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/agenthint?logo=npm&color=cb3837)](https://www.npmjs.com/package/agenthint)
[![crates.io](https://img.shields.io/crates/v/agenthint?logo=rust&color=dea584)](https://crates.io/crates/agenthint)
[![License](https://img.shields.io/github/license/forjd/agenthint)](LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/forjd/agenthint?style=social)](https://github.com/forjd/agenthint)

Detect AI agent runtimes and adapt CLI output.

`agenthint` is a small runtime detection spec, CLI, and library for developer tools that want to know when they are probably being run by an AI agent such as Codex, Claude Code, Cursor, Gemini CLI, or Aider.

It is built for ergonomics, not security. Use it to choose better output defaults for agents; do not use it as a trust boundary.

## Why

AI agents benefit from different CLI defaults than humans:

- structured output instead of decorative output
- no spinners, pagers, prompts, or browser launches
- stable section markers and clear exit-code meanings
- absolute paths and line-oriented diagnostics
- concise logs that preserve useful debugging context

`agenthint` gives CLIs and libraries a shared way to make that decision.

## Quick Start

```sh
npm install -g agenthint
# or
cargo install agenthint
```

```sh
if agenthint; then
  my-tool --json --no-progress
else
  my-tool
fi
```

Use it inside another CLI or script to choose agent-friendly output:

```sh
if agenthint >/dev/null; then
  exec my-cli --json --no-progress --no-pager "$@"
else
  exec my-cli "$@"
fi
```

For agents and wrappers, the preferred explicit convention is `AI_AGENT`:

```sh
AI_AGENT=codex my-tool
AI_AGENT=claude-code my-tool
AI_AGENT=my-custom-agent my-tool
```

## CLI

```sh
agenthint             # exit 0 if an agent is likely detected, otherwise 1
agenthint --json      # print the structured detection result
agenthint --explain   # print a short explanation
agenthint doctor      # print detection details and setup advice
agenthint doctor --json
                      # print detection details and setup advice as JSON
agenthint init codex  # print the recommended AI_AGENT value
```

Example JSON output:

```json
{
  "isAgent": true,
  "agent": "codex",
  "confidence": 0.92,
  "signals": ["env:CODEX_CI", "env:CODEX_THREAD_ID"]
}
```

## Install

Install from npm:

```sh
npm install -g agenthint
agenthint --json
```

Install from crates.io:

```sh
cargo install agenthint
agenthint --json
```

Install from PyPI:

```sh
python3 -m pip install agenthint
agenthint --json
```

Install the latest native binary from GitHub Releases:

```sh
curl -fsSL https://raw.githubusercontent.com/forjd/agenthint/main/install.sh | sh
```

Override the install directory or version:

```sh
AGENTHINT_INSTALL_DIR=/usr/local/bin sh install.sh
AGENTHINT_VERSION=agenthint-vX.Y.Z sh install.sh
```

Native binaries are built by GitHub Actions for release assets. The installer verifies `SHA256SUMS` when the selected release provides it.

## TypeScript API

```ts
import { detectAgent } from "agenthint";

const result = detectAgent();

if (result.isAgent) {
  // Prefer structured, quiet, non-interactive output.
}
```

## Rust API

The repository also contains a Rust implementation under `crates/agenthint`.

```rust
use agenthint::detect_agent;

let result = detect_agent();

if result.is_agent {
    // Prefer structured, quiet, non-interactive output.
}
```

Run the Rust CLI locally:

```sh
cargo run -q -p agenthint -- --json
```

## Python API

```python
from agenthint import detect_agent

result = detect_agent()

if result.is_agent:
    # Prefer structured, quiet, non-interactive output.
    pass
```

## Detection Model

The result includes:

- `isAgent`: whether an agent runtime is likely detected
- `agent`: known or custom agent name
- `confidence`: a number from `0` to `1`
- `signals`: diagnostic signal names, never secret values

Detection priority:

1. `AGENTHINT_DISABLE`
2. `AGENTHINT_FORCE`
3. explicit `AI_AGENT`
4. known environment signals
5. documented filesystem signals
6. low-confidence parent process signals
7. low-confidence stdio hints

## Supported Agents

Current known agent names include:

- Codex
- Claude Code
- Cowork
- Cursor
- Gemini CLI
- Aider
- Augment CLI
- AMP
- OpenCode
- OpenClaw
- GitHub Copilot
- Replit
- Devin
- Google Antigravity
- Pi
- Kiro CLI
- Windsurf
- Cline
- Roo Code
- Kilo Code
- Mistral Vibe
- v0

Custom agents are supported through any non-empty `AI_AGENT` value.

See [docs/agents.md](docs/agents.md) for recommended `AI_AGENT` values.

See [docs/integrations.md](docs/integrations.md) for Bash, Zsh, Fish, Node.js, Rust, and Python integration snippets.

See [docs/signals.md](docs/signals.md) for the signal registry and confidence levels.

## Principles

- Detection is advisory and can be spoofed.
- Prefer `AI_AGENT` when an agent can set an explicit hint.
- Prefer explicit environment signals over brittle heuristics.
- Return confidence, not false certainty.
- Print signal names, not environment variable values.
- Keep output quiet and machine-readable when requested.
- Make the convention useful across languages and toolchains.

## Packages

Current:

- `agenthint` JavaScript/TypeScript package
- `agenthint` Rust crate and CLI implementation
- `agenthint` Python package

Planned:

- standalone native binary releases

The packages use the unscoped `agenthint` name across npm, crates.io, and PyPI. If the npm name becomes unavailable before first publish, the fallback package name is `@forjd/agenthint`.

## CI and Releases

GitHub Actions runs formatting, linting, TypeScript tests, Rust tests, Python tests, npm package checks, and `cargo publish --dry-run`.

Releases use release-please with Conventional Commits. npm publishing is configured for trusted publishing via GitHub Actions OIDC, so no long-lived npm token is required. Before the first npm publish, configure the trusted publisher in npm package settings for `forjd/agenthint` and `.github/workflows/release.yml`.

See [docs/releases.md](docs/releases.md) for release details.

## Development

Use [mise](https://mise.jdx.dev/) for local toolchain versions:

```sh
mise install
```

Install dependencies and run checks:

```sh
npm install
npm run check
```

Useful commands:

```sh
npm run format
npm run lint
npm test
npm run python:test
npm run generate:rules
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

## Security

`agenthint` is not an authentication, authorization, sandboxing, or policy tool. Environment variables, parent process names, and filesystem markers can be spoofed. Treat all results as UX hints only.

## License

MIT © Forjd
