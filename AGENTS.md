# AGENTS.md

## Project

`agenthint` is a TypeScript CLI/library for detecting when a tool is probably being run by an AI agent. Detection is advisory only and must not be treated as a security boundary.

## Shell

Prefix shell commands with `rtk` unless the command genuinely needs raw shell behavior.

Examples:

```sh
rtk npm run check
rtk git status
rtk sed -n '1,200p' src/index.ts
```

## Commands

Use mise from the repo root for toolchain versions:

```sh
mise install
mise exec -- npm run check
```

Use these project scripts:

```sh
npm run build
npm run format
npm run format:check
npm run lint
npm run test
npm run check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Run `npm run check` before committing or handing off code changes.

If editing `install.sh`, run `sh -n install.sh` and keep it POSIX `sh` compatible.

## Code Style

- TypeScript source lives in `src/`.
- Rust source lives in `crates/agenthint/src/`.
- Tests live in `test/` and use Node's built-in test runner.
- Keep detection results explainable: include `confidence` and `signals`.
- Prefer explicit `AI_AGENT` support over heuristics.
- Never print environment variable values that may contain secrets; signal names are enough.
- Keep filesystem probes documented and configurable.

## CLI Behavior

The CLI should preserve these exit codes:

- `0`: agent runtime likely detected
- `1`: agent runtime not detected
- `2`: invalid usage or detection error

Setup-only commands such as `agenthint init <agent>` should exit `0`.

`agenthint doctor` should explain what was detected and recommend setting `AI_AGENT` when detection is heuristic.

## Git

Use Conventional Commits, for example:

```text
feat: add parent process detection
fix: avoid printing sensitive env values
docs: expand agent integration guide
```

Husky runs `npm run check` before commits.
