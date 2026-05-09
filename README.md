# agenthint

[![CI](https://github.com/forjd/agenthint/actions/workflows/ci.yml/badge.svg)](https://github.com/forjd/agenthint/actions/workflows/ci.yml)
[![Release](https://github.com/forjd/agenthint/actions/workflows/release.yml/badge.svg)](https://github.com/forjd/agenthint/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/agenthint?logo=npm&color=cb3837)](https://www.npmjs.com/package/agenthint)
[![crates.io](https://img.shields.io/crates/v/agenthint?logo=rust&color=dea584)](https://crates.io/crates/agenthint)
[![PyPI](https://img.shields.io/pypi/v/agenthint?logo=python&color=3776ab)](https://pypi.org/project/agenthint/)
[![License](https://img.shields.io/github/license/forjd/agenthint)](LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/forjd/agenthint?style=social)](https://github.com/forjd/agenthint)

Detect AI agent runtimes and adapt CLI output.

`agenthint` is a small detection spec, CLI, and multi-language library for developer tools that want to know when they are probably being run by an AI agent such as Codex, Claude Code, Cursor, Gemini CLI, Aider, or another automated coding environment.

Use it to choose better defaults for agent-driven runs: structured output, quiet logs, no spinners, no pagers, no interactive prompts, and clearer diagnostics.

> Detection is advisory. `agenthint` is for user experience decisions, not authentication, authorization, sandboxing, or policy enforcement.

## Quick Start

Install the CLI:

```sh
npm install -g agenthint
# or
cargo install agenthint
# or
python3 -m pip install agenthint
```

Use its exit code in scripts:

```sh
if agenthint >/dev/null; then
  exec my-tool --json --no-progress --no-pager "$@"
else
  exec my-tool "$@"
fi
```

Prefer the explicit convention when you control the agent or wrapper:

```sh
AI_AGENT=codex my-tool
AI_AGENT=claude-code my-tool
AI_AGENT=my-custom-agent my-tool
```

## Why

Humans and agents often need different CLI behavior.

| Humans often prefer | Agents often prefer |
| --- | --- |
| Colors, spinners, prompts | Stable, parseable output |
| Pagers and browser launches | Non-interactive execution |
| Decorative progress UI | Line-oriented diagnostics |
| Friendly summaries | Explicit sections and exit codes |

`agenthint` gives tools a shared, explainable way to switch modes without each project inventing its own agent detection logic.

## CLI

```sh
agenthint             # exit 0 if an agent is likely detected, otherwise 1
agenthint --json      # print the structured detection result
agenthint --explain   # print a short human-readable explanation
agenthint doctor      # print detection details and setup advice
agenthint doctor --json
agenthint init codex  # print the recommended AI_AGENT value
```

Example JSON:

```json
{
  "isAgent": true,
  "agent": "codex",
  "confidence": 0.92,
  "signals": ["env:CODEX_CI", "env:CODEX_THREAD_ID"]
}
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Agent runtime likely detected |
| `1` | Agent runtime not detected |
| `2` | Invalid usage or detection error |

Setup-only commands such as `agenthint init <agent>` exit `0`.

## Libraries

### TypeScript

```ts
import { detectAgent } from "agenthint";

const result = detectAgent();

if (result.isAgent) {
  // Prefer structured, quiet, non-interactive output.
}
```

### Rust

```rust
use agenthint::detect_agent;

let result = detect_agent();

if result.is_agent {
    // Prefer structured, quiet, non-interactive output.
}
```

### Python

```python
from agenthint import detect_agent

result = detect_agent()

if result.is_agent:
    # Prefer structured, quiet, non-interactive output.
    pass
```

## Install

### npm

```sh
npm install -g agenthint
agenthint --json
```

### crates.io

```sh
cargo install agenthint
agenthint --json
```

### PyPI

```sh
python3 -m pip install agenthint
agenthint --json
```

### Native binary

```sh
curl -fsSL https://raw.githubusercontent.com/forjd/agenthint/main/install.sh | sh
```

The install script downloads the latest `agenthint-v*` GitHub Release asset for your platform and verifies `SHA256SUMS` when the selected release provides them.

Override the install directory or version:

```sh
AGENTHINT_INSTALL_DIR=/usr/local/bin sh install.sh
AGENTHINT_VERSION=agenthint-vX.Y.Z sh install.sh
```

## Detection Model

Every detection result includes:

| Field | Description |
| --- | --- |
| `isAgent` | Whether an agent runtime is likely detected |
| `agent` | Known or custom agent name, when available |
| `confidence` | A number from `0` to `1` |
| `signals` | Diagnostic signal names, never secret values |

Detection priority:

1. `AGENTHINT_DISABLE`
2. `AGENTHINT_FORCE`
3. Explicit `AI_AGENT`
4. Known environment signals
5. Documented filesystem signals
6. Low-confidence parent process signals
7. Low-confidence stdio hints

Known agents include Codex, Claude Code, Cursor, Gemini CLI, Aider, Augment CLI, AMP, OpenCode, OpenClaw, GitHub Copilot, Replit, Devin, Google Antigravity, Pi, Kiro CLI, Windsurf, Cline, Roo Code, Kilo Code, Mistral Vibe, v0, and Cowork.

Custom agents are supported through any non-empty `AI_AGENT` value.

## Docs

- [Agent integration notes](docs/agents.md): recommended `AI_AGENT` values
- [Integration snippets](docs/integrations.md): Bash, Zsh, Fish, Node.js, Rust, and Python examples
- [Signal registry](docs/signals.md): known signals and confidence levels
- [Detection spec](SPEC.md): the portable detection contract

## Principles

- Prefer explicit `AI_AGENT` support over heuristics.
- Return confidence, not false certainty.
- Print signal names, not environment variable values.
- Keep filesystem probes documented and configurable.
- Keep requested machine-readable output quiet and stable.
- Treat detection as a hint, never as a security boundary.

## Development

```sh
mise install
mise exec -- npm run check
```

Useful scripts:

```sh
npm run build
npm run format
npm run lint
npm run test
npm run check
cargo test --workspace
```

Contributions are welcome. Please keep detection results explainable, avoid printing secret-bearing environment values, and update the docs when adding or changing signals.
