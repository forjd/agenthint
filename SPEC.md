# agenthint Detection Spec

This document defines the early detection contract for agent-aware tools.

## Result

An implementation should expose this shape:

```ts
type AgentHintResult = {
  isAgent: boolean
  agent: string | null
  confidence: number
  signals: string[]
}
```

`confidence` is a number from `0` to `1`.

## Signal Classes

Implementations may use multiple signal classes:

- environment variables
- parent process names
- terminal metadata
- stdio TTY state
- explicit user overrides

## Explicit Agent Convention

Tools and agents should prefer `AI_AGENT` when they can set an explicit runtime hint:

```sh
AI_AGENT=codex my-tool
AI_AGENT=claude-code/2.1.123/agent my-tool
AI_AGENT=my-custom-agent my-tool
```

`AI_AGENT` should be checked before heuristic signals. Empty and whitespace-only values should be ignored.

## Override Conventions

`AGENTHINT_DISABLE` forces a no-agent result and `AGENTHINT_FORCE` forces an agent result; both take precedence over `AI_AGENT` and heuristics. When `AGENTHINT_FORCE` is set, `AGENTHINT_AGENT` optionally names the forced agent; otherwise the agent is `unknown`. Truthy values are `1`, `true`, `yes`, and `on`.

## Signal Ordering and Ties

To keep results portable across implementations:

- Heuristic matches report every matching signal, deduplicated, in rule-registry order.
- Signal names matched by an environment prefix rule are sorted lexicographically.
- When multiple heuristic rules match with equal confidence, the earliest rule in the registry wins.

## Parent Process Signals

Implementations may inspect the direct parent process name as a low-confidence heuristic. Parent process checks should be configurable because process names can be unavailable, ambiguous, platform-specific, or controlled by wrappers.

Parent process diagnostics should report only a normalized executable name, for example `process:parent:codex`, not a full path.

## Known Environment Signals

Initial candidates:

- `AI_AGENT`
- `CODEX_SANDBOX`
- `CODEX_CI`
- `CODEX_THREAD_ID`
- `CODEX_HOME`
- `CODEX_USER_AGENT`
- `CLAUDECODE`
- `CLAUDE_CODE`
- `CLAUDECODE_CWD`
- `AIDER_*`
- `CURSOR_AGENT`
- `GEMINI_CLI`
- `AUGMENT_AGENT`
- `AMP_CURRENT_THREAD_ID`
- `OPENCODE_CLIENT`
- `OPENCODE`
- `COPILOT_MODEL`
- `COPILOT_ALLOW_ALL`
- `COPILOT_GITHUB_TOKEN`
- `COPILOT_CLI`
- `REPL_ID`
- `ANTIGRAVITY_AGENT`
- `PI_CODING_AGENT`
- `KIRO_AGENT_PATH`
- `WINDSURF_AGENT`
- `CLINE_AGENT`
- `ROO_CODE_AGENT`
- `ROO_CODE`
- `KILOCODE_AGENT`
- `OPENCLAW_AGENT`
- `AGENTHINT_FORCE`
- `AGENTHINT_AGENT`
- `AGENTHINT_DISABLE`

Implementations must not print environment variable values by default. Signal names are enough for diagnostics.

`CLAUDE_CODE_IS_COWORK` is a classifier only. It may select `cowork` when another Claude signal is present, but should not be treated as an agent signal by itself. When it does select `cowork`, `env:CLAUDE_CODE_IS_COWORK` is included in `signals` to keep the classification explainable.

Known agent names without stable heuristic signals should still be supported through `AI_AGENT`.
Current explicit-only known names:

- `mistral-vibe`
- `v0`

## Known Filesystem Signals

- `/opt/.devin`

Filesystem checks should be documented and configurable.

## Exit Codes

The `agenthint` CLI should use:

- `0`: agent runtime likely detected
- `1`: agent runtime not detected
- `2`: invalid usage or detection error

Subcommands that only print setup information, such as `agenthint init <agent>`, should exit `0` when invoked successfully.

`agenthint --json` should return the raw detection result. `agenthint doctor --json` may return a richer diagnostic object that includes setup advice while preserving the same detection-based exit code as `agenthint doctor`.

## Security

Agent detection must not be used as an authorization, sandboxing, policy, or trust boundary. Treat all results as hints for user experience only.
