# Agent Integration Notes

`agenthint` prefers explicit runtime hints over heuristics. Agents and wrappers should set `AI_AGENT` before invoking tools.

## Recommended Values

| Tool | Recommended value |
| --- | --- |
| Codex | `codex` |
| Claude Code | `claude-code` |
| Cursor | `cursor` |
| Gemini CLI | `gemini` |
| GitHub Copilot | `github-copilot` |
| GitHub Copilot CLI | `github-copilot-cli` |
| Windsurf | `windsurf` |
| Cline | `cline` |
| Roo Code | `roo-code` |
| Kilo Code | `kilocode` |
| OpenCode | `opencode` |
| OpenClaw | `openclaw` |
| Google Antigravity | `antigravity` |
| Mistral Vibe | `mistral-vibe` |
| v0 | `v0` |

Custom agents can use any non-empty value:

```sh
AI_AGENT=my-custom-agent my-tool
```

## Why Explicit Beats Heuristic

Environment and filesystem heuristics are useful for compatibility, but they can be missing, stale, or ambiguous. `AI_AGENT` is stable, readable, and portable across languages.

## Heuristic Coverage

Some known agent names are explicit-only until a stable runtime signal is documented:

- Mistral Vibe: set `AI_AGENT=mistral-vibe`
- v0: set `AI_AGENT=v0`

## Tool Author Pattern

```sh
if agenthint; then
  my-tool --json --no-progress
else
  my-tool
fi
```

Use `agenthint doctor` to inspect the active signals:

```sh
agenthint doctor
```
