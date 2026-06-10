# Signal Registry

Detection is advisory. Signals describe why `agenthint` returned a result; they must not be used as a security boundary.

## Explicit Overrides

| Signal | Agent | Confidence | Type | Notes |
| --- | --- | ---: | --- | --- |
| `env:AGENTHINT_DISABLE` | none | `1.00` | explicit | Forces no-agent result for local overrides and tests. |
| `env:AGENTHINT_FORCE` | `AGENTHINT_AGENT` or `unknown` | `1.00` | explicit | Forces an agent result for local overrides and tests. |
| `env:AI_AGENT` | normalized value | `0.98` | explicit | Preferred portable convention. Values are not printed. |

## Environment Heuristics

| Signal | Agent | Confidence | Type |
| --- | --- | ---: | --- |
| `env:CURSOR_AGENT` | `cursor` | `0.92` | heuristic |
| `env:GEMINI_CLI` | `gemini` | `0.92` | heuristic |
| `env:CODEX_SANDBOX` | `codex` | `0.92` | heuristic |
| `env:CODEX_CI` | `codex` | `0.92` | heuristic |
| `env:CODEX_THREAD_ID` | `codex` | `0.92` | heuristic |
| `env:CODEX_HOME` | `codex` | `0.92` | heuristic |
| `env:CODEX_USER_AGENT` | `codex` | `0.92` | heuristic |
| `env:AUGMENT_AGENT` | `augment-cli` | `0.90` | heuristic |
| `env:AMP_CURRENT_THREAD_ID` | `amp` | `0.90` | heuristic |
| `env:OPENCODE_CLIENT` | `opencode` | `0.90` | heuristic |
| `env:OPENCODE` | `opencode` | `0.90` | heuristic |
| `env:CLAUDECODE` | `claude-code` | `0.90` | heuristic |
| `env:CLAUDE_CODE` | `claude-code` or `cowork` | `0.90` | heuristic |
| `env:CLAUDECODE_CWD` | `claude-code` | `0.90` | heuristic |
| `env:COPILOT_MODEL` | `copilot` | `0.88` | heuristic |
| `env:COPILOT_ALLOW_ALL` | `copilot` | `0.88` | heuristic |
| `env:COPILOT_GITHUB_TOKEN` | `copilot` | `0.88` | heuristic |
| `env:COPILOT_CLI` | `copilot` | `0.88` | heuristic |
| `env:AIDER_*` | `aider` | `0.86` | heuristic |
| `env:CURSOR_*` | `cursor` | `0.82` | heuristic |
| `env:REPL_ID` | `replit` | `0.65` | heuristic |
| `env:ANTIGRAVITY_AGENT` | `antigravity` | `0.90` | heuristic |
| `env:PI_CODING_AGENT` | `pi` | `0.90` | heuristic |
| `env:KIRO_AGENT_PATH` | `kiro-cli` | `0.90` | heuristic |
| `env:WINDSURF_AGENT` | `windsurf` | `0.82` | heuristic |
| `env:CLINE_AGENT` | `cline` | `0.82` | heuristic |
| `env:ROO_CODE_AGENT` | `roo-code` | `0.82` | heuristic |
| `env:ROO_CODE` | `roo-code` | `0.82` | heuristic |
| `env:KILOCODE_AGENT` | `kilocode` | `0.82` | heuristic |
| `env:OPENCLAW_AGENT` | `openclaw` | `0.82` | heuristic |

`CLAUDE_CODE_IS_COWORK` is only a classifier. It selects `cowork` when another Claude signal is present; it is not an agent signal by itself. When it selects `cowork`, `env:CLAUDE_CODE_IS_COWORK` is included in `signals` so the classification stays explainable.

`REPL_ID` is present in every Replit workspace, including human-driven sessions, which is why it reports a low `0.65` confidence. Exit-code consumers that want to avoid false positives can read `confidence` from `agenthint --json` and apply their own threshold.

## Filesystem Heuristics

| Signal | Agent | Confidence | Type | Configurable |
| --- | --- | ---: | --- | --- |
| `file:/opt/.devin` | `devin` | `0.90` | heuristic | yes |

## Parent Process Heuristics

| Signal | Agent | Confidence | Type | Configurable |
| --- | --- | ---: | --- | --- |
| `process:parent:codex` | `codex` | `0.55` | heuristic | yes |
| `process:parent:claude` | `claude-code` | `0.55` | heuristic | yes |
| `process:parent:claude-code` | `claude-code` | `0.55` | heuristic | yes |
| `process:parent:cursor-agent` | `cursor` | `0.55` | heuristic | yes |
| `process:parent:cursor` | `cursor` | `0.55` | heuristic | yes |
| `process:parent:gemini` | `gemini` | `0.55` | heuristic | yes |
| `process:parent:aider` | `aider` | `0.55` | heuristic | yes |
| `process:parent:opencode` | `opencode` | `0.55` | heuristic | yes |
| `process:parent:amp` | `amp` | `0.55` | heuristic | yes |

Parent process signals report normalized executable names only, not full paths.

Parent process detection reads `/proc` or `ps`, so it is effectively unavailable on Windows unless a parent process name is supplied explicitly through library options.

## Stdio Hints

| Signal | Agent | Confidence | Type | Notes |
| --- | --- | ---: | --- | --- |
| `stdio:stdout-not-tty` | none | `0.20` | hint | Does not mark the process as an agent. |
| `stdio:stdin-not-tty` | none | `0.20` | hint | Does not mark the process as an agent. |

## Explicit-Only Known Agents

These names are recognized through `AI_AGENT` but do not currently have stable heuristic signals:

| Agent | Recommended explicit value |
| --- | --- |
| Mistral Vibe | `mistral-vibe` |
| v0 | `v0` |
