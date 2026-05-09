# Releases

This repository uses release-please and Conventional Commits.

## Flow

1. Merge Conventional Commits to `main`.
2. The release workflow opens or updates a release PR.
3. Merge the release PR.
4. The release workflow creates GitHub releases and publishes npm, PyPI, and crates.io when a new package version is present.

## npm

The npm package is planned as `agenthint`.

Publishing uses npm trusted publishing from GitHub Actions, not a long-lived npm token. Before the first automated publish, configure the package trusted publisher on npm:

- package: `agenthint`
- GitHub organization: `forjd`
- GitHub repository: `agenthint`
- workflow filename: `release.yml`

If the unscoped npm name becomes unavailable before first publish, switch `package.json` and release-please config to `@forjd/agenthint`.

## PyPI

The Python package is planned as `agenthint`.

Publishing uses PyPI trusted publishing from GitHub Actions, not a long-lived API token. Before the first automated publish, configure the pending trusted publisher on PyPI:

- project: `agenthint`
- owner: `forjd`
- repository: `agenthint`
- workflow filename: `release.yml`

The release workflow builds the Python package with `python -m build`, skips publishing if the version already exists on PyPI, and publishes with `pypa/gh-action-pypi-publish`.

## crates.io

The Rust crate is planned as `agenthint`.

CI runs `cargo publish -p agenthint --dry-run`. Release publishing uses crates.io trusted publishing through `rust-lang/crates-io-auth-action@v1`, so no long-lived crates.io token is required in GitHub secrets.

Trusted publisher settings:

- crate: `agenthint`
- provider: `GitHub Actions`
- repository: `forjd/agenthint`
- workflow filename: `release.yml`

The release workflow skips `cargo publish` if the crate version is already present on crates.io.

## Native Binaries

Native binary releases are produced from the Rust CLI when a GitHub Release is published. Each release also includes per-binary `.sha256` files and a combined `SHA256SUMS` file.

The initial target matrix is:

- Linux x64
- macOS arm64
- macOS x64
- Windows x64

Linux arm64 can be added once the runner target is confirmed for the repository.

The root `install.sh` script downloads the latest `agenthint-v*` binary and verifies it against `SHA256SUMS`. Missing checksums fail closed unless `AGENTHINT_ALLOW_MISSING_CHECKSUM=1` is set explicitly.
