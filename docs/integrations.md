# Integration Snippets

Use `agenthint` to switch tools into quieter, structured output when an AI agent is likely driving the command.

## Bash

```sh
if agenthint >/dev/null; then
  exec my-tool --json --no-progress --no-pager "$@"
else
  exec my-tool "$@"
fi
```

## Zsh

```sh
if agenthint >/dev/null; then
  my-tool --json --no-progress --no-pager "$@"
else
  my-tool "$@"
fi
```

## Fish

```fish
if agenthint >/dev/null
  my-tool --json --no-progress --no-pager $argv
else
  my-tool $argv
end
```

## Node.js CLI

```ts
import { detectAgent } from "agenthint";

const agent = detectAgent();
const args = agent.isAgent ? ["--json", "--no-progress", ...process.argv.slice(2)] : process.argv.slice(2);

runCli(args);
```

## Rust CLI

```rust
use agenthint::detect_agent;

let result = detect_agent();

if result.is_agent {
    run_cli(&["--json", "--no-progress"]);
} else {
    run_cli(&[]);
}
```

## Python CLI

```python
from agenthint import detect_agent

result = detect_agent()
args = ["--json", "--no-progress"] if result.is_agent else []

run_cli(args)
```

## Agent Wrapper

Agents and wrappers should prefer the explicit convention:

```sh
AI_AGENT=codex my-tool
AI_AGENT=claude-code my-tool
AI_AGENT=my-custom-agent my-tool
```
