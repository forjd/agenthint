# agenthint

Detect AI agent runtimes and adapt CLI output.

`agenthint` is a small runtime detection spec and toolchain for CLIs and developer tools that want to know when they are probably being run by an AI agent such as Codex, Claude Code, Cursor agents, or Aider.

It is intended for output and interaction ergonomics, not security.

## Why

Agent-driven CLI sessions benefit from different defaults than human terminal sessions:

- structured output instead of decorative output
- no spinners, pagers, prompts, or browser launches
- stable section markers and exit-code explanations
- absolute paths and line-oriented diagnostics
- concise logs that preserve useful debugging context

`agenthint` gives tools a shared way to make that decision.

## Shape

The core API should return a runtime result with confidence and signals:

```json
{
  "isAgent": true,
  "agent": "codex",
  "confidence": 0.92,
  "signals": ["env:CODEX_HOME", "parent:codex"]
}
```

Agents can opt in explicitly with `AI_AGENT`:

```sh
AI_AGENT=codex my-tool
AI_AGENT=my-custom-agent my-tool
```

The first implementation target is a TypeScript CLI/library package:

```sh
agenthint
```

Example use:

```sh
if agenthint; then
  my-tool --json --no-progress
else
  my-tool
fi
```

CLI commands:

```sh
agenthint             # exit 0 if an agent is likely detected, otherwise 1
agenthint doctor      # print detection details and setup advice
agenthint --json      # print the structured detection result
agenthint --explain   # print a short explanation
```

Library API:

```ts
import { detectAgent } from "agenthint";

const result = detectAgent();

if (result.isAgent) {
  // Prefer structured, quiet, non-interactive output.
}
```

## Principles

- Detection is advisory and can be spoofed.
- Prefer `AI_AGENT` when an agent can set an explicit hint.
- Prefer explicit environment signals when available.
- Return confidence, not false certainty.
- Keep output quiet and machine-readable when requested.
- Make the result useful across languages and toolchains.

## Planned Packages

- `agenthint` CLI
- `agenthint` JavaScript/TypeScript package
- `agenthint` Rust crate
- `agenthint` Python package

## Development

```sh
mise install
npm install
npm test
npm run check
cargo test --workspace
```

See [docs/agents.md](docs/agents.md) for recommended `AI_AGENT` values.
