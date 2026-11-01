# Signal Registry

Detection is advisory. Signals describe why `agenthint` returned a result; they must not be used as a security boundary.

## Explicit Overrides

| Signal | Agent | Confidence | Type | Notes |
| --- | --- | ---: | --- | --- |
| `env:AGENTHINT_DISABLE` | none | `1.00` | explicit | Forces no-agent result for local overrides and tests. Truthy as `1`, `true`, `yes`, `on`, case-insensitively. |
| `env:AGENTHINT_FORCE` | `AGENTHINT_AGENT` or `unknown` | `1.00` | explicit | Forces an agent result for local overrides and tests. Truthy as `1`, `true`, `yes`, `on`, case-insensitively. |
| `env:AI_AGENT` | normalized value | `0.98` | explicit | Preferred portable convention. Values are not printed. Empty and whitespace-only values are ignored. Known names and aliases match case-insensitively. |

## Environment Heuristics

| Signal | Agent | Confidence | Type |
| --- | --- | ---: | --- |
| `env:CURSOR_AGENT` | `cursor` | `0.92` | heuristic |
| `env:GEMINI_CLI` | `gemini` | `0.92` | heuristic |
| `env:CODEX_SANDBOX` | `codex` | `0.92` | heuristic |
| `env:CODEX_CI` | `codex` | `0.92` | heuristic |
| `env:CODEX_THREAD_ID` | `codex` | `0.92` | heuristic |
| `env:CODEX_SANDBOX_NETWORK_DISABLED` | `codex` | `0.92` | heuristic |
| `env:KILO` | `kilocode` | `0.92` | heuristic |
| `env:KILO_PID` | `kilocode` | `0.92` | heuristic |
| `env:AUGMENT_AGENT` | `augment-cli` | `0.90` | heuristic |
| `env:AMP_CURRENT_THREAD_ID` | `amp` | `0.90` | heuristic |
| `env:OPENCODE` | `opencode` | `0.90` | heuristic |
| `env:OPENCODE_PID` | `opencode` | `0.90` | heuristic |
| `env:CLAUDE_CODE_CHILD_SESSION` | `claude-code` or `cowork` | `0.90` | heuristic |
| `env:COPILOT_CLI` | `copilot` | `0.88` | heuristic |
| `env:COPILOT_AGENT` | `copilot` | `0.88` | heuristic |
| `env:REPL_ID` | `replit` | `0.65` | heuristic |
| `env:ANTIGRAVITY_AGENT` | `antigravity` | `0.90` | heuristic |
| `env:PI_CODING_AGENT` | `pi` | `0.90` | heuristic |
| `env:WINDSURF_CASCADE_TERMINAL` | `windsurf` | `0.82` | heuristic |
| `env:CLINE_ACTIVE` | `cline` | `0.82` | heuristic |
| `env:ROO_ACTIVE` | `roo-code` | `0.82` | heuristic |

`CLAUDE_CODE_IS_COWORK` is only a classifier. It selects `cowork` when another Claude signal is present; it is not an agent signal by itself. When it selects `cowork`, `env:CLAUDE_CODE_IS_COWORK` is included in `signals` so the classification stays explainable.

Variables that people set in their own shell profile, or that an IDE sets for every terminal, are not agent signals. For that reason `agenthint` does not use `CODEX_HOME`, `COPILOT_GITHUB_TOKEN`, `AIDER_*` configuration variables, the `CURSOR_*` variables that the Cursor IDE sets in its integrated terminal (such as `CURSOR_TRACE_ID`), or `CLAUDECODE`, which Claude Code IDE extensions also set in their integrated terminals. Claude Code sets `CLAUDE_CODE_CHILD_SESSION` only for its own subprocesses. Aider is still detected through `AI_AGENT` or its parent process name.

Kilo Code is built on opencode and also sets `OPENCODE`, so the `kilocode` rule has a higher confidence than the `opencode` rule.

Several agents set `AI_AGENT` themselves: Claude Code (`claude-code_<version>_<surface>`), opencode (`opencode`), Pi (`pi`), and GitHub Copilot in VS Code (`github_copilot_vscode_agent`). These values normalize to `claude-code`, `opencode`, `pi`, and `copilot`.

`REPL_ID` is present in every Replit workspace, including human-driven sessions, which is why it reports a low `0.65` confidence. Exit-code consumers that want to avoid false positives can read `confidence` from `agenthint --json` and apply their own threshold.

Empty and whitespace-only environment values are ignored. Whitespace is the ASCII set space, `\t`, `\n`, `\v`, `\f`, and `\r`; non-ASCII characters such as U+00A0 or U+FEFF count as values (see `SPEC.md`).

Human-readable output replaces Unicode control characters (category Cc) from agent names and signal names with U+FFFD so env-derived values cannot inject terminal escape sequences. JSON output uses standard JSON escaping.

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
| `process:parent:gemini` | `gemini` | `0.55` | heuristic | yes |
| `process:parent:aider` | `aider` | `0.55` | heuristic | yes |
| `process:parent:opencode` | `opencode` | `0.55` | heuristic | yes |
| `process:parent:amp` | `amp` | `0.55` | heuristic | yes |

Parent process signals report normalized executable names only, not full paths.

Parent process detection reads `/proc` or `ps`, so it is effectively unavailable on Windows unless a parent process name is supplied explicitly through library options.

## Stdio Hints

| Signal | Agent | Confidence | Type | Notes |
| --- | --- | ---: | --- | --- |
| `stdio:stdout-not-tty` | none | `0.20` | hint | Does not mark the process as an agent. Library opt-in only via explicit `stdoutIsTTY: false`. |
| `stdio:stdin-not-tty` | none | `0.20` | hint | Does not mark the process as an agent. Library opt-in only via explicit `stdinIsTTY: false`. |

## Explicit-Only Known Agents

These names are recognized through `AI_AGENT` but do not currently have stable heuristic signals:

| Agent | Recommended explicit value |
| --- | --- |
| Kiro CLI | `kiro-cli` |
| Mistral Vibe | `mistral-vibe` |
| OpenClaw | `openclaw` |
| v0 | `v0` |
