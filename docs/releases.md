# Releases

This repository uses release-please and Conventional Commits.

## Flow

1. Merge Conventional Commits to `main`.
2. The release workflow opens or updates a release PR.
3. Merge the release PR.
4. The release workflow creates GitHub releases and publishes npm when a new package version is present.

## npm

The npm package is planned as `agenthint`.

Publishing uses npm trusted publishing from GitHub Actions, not a long-lived npm token. Before the first automated publish, configure the package trusted publisher on npm:

- package: `agenthint`
- GitHub organization: `forjd`
- GitHub repository: `agenthint`
- workflow filename: `release.yml`

If the unscoped npm name becomes unavailable before first publish, switch `package.json` and release-please config to `@forjd/agenthint`.

## Rust

The Rust crate is planned as `agenthint`.

CI runs `cargo publish -p agenthint --dry-run`. Actual crates.io publishing is intentionally not automated yet because crates.io still requires a registry token. Add that once the crate metadata and ownership are final. The unscoped crate name currently appears available from `cargo search agenthint`.

## Native Binaries

Native binary releases are produced from the Rust CLI when a GitHub Release is published. The initial target matrix is:

- Linux x64
- macOS arm64
- macOS x64
- Windows x64

Linux arm64 can be added once the runner target is confirmed for the repository.
