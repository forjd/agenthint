#!/usr/bin/env sh
set -eu

repo="forjd/agenthint"
bin_name="agenthint"
install_dir="${AGENTHINT_INSTALL_DIR:-${BIN_DIR:-$HOME/.local/bin}}"
version="${AGENTHINT_VERSION:-latest}"
allow_missing_checksum="${AGENTHINT_ALLOW_MISSING_CHECKSUM:-}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "agenthint install: missing required command: $1" >&2
    exit 1
  fi
}

detect_asset() {
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64 | aarch64) echo "agenthint-macos-arm64" ;;
        x86_64 | amd64) echo "agenthint-macos-x64" ;;
        *) echo "agenthint install: unsupported macOS architecture: $arch" >&2; exit 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64 | amd64) echo "agenthint-linux-x64" ;;
        aarch64 | arm64) echo "agenthint-linux-arm64" ;;
        *) echo "agenthint install: unsupported Linux architecture: $arch" >&2; exit 1 ;;
      esac
      ;;
    MINGW* | MSYS* | CYGWIN*)
      case "$arch" in
        x86_64 | amd64) echo "agenthint-windows-x64.exe" ;;
        *) echo "agenthint install: unsupported Windows architecture: $arch" >&2; exit 1 ;;
      esac
      ;;
    *)
      echo "agenthint install: unsupported operating system: $os" >&2
      exit 1
      ;;
  esac
}

download() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error "$url" --output "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$output"
  else
    echo "agenthint install: missing required command: curl or wget" >&2
    exit 1
  fi
}

sha256_file() {
  file="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    echo "agenthint install: missing required command: shasum or sha256sum" >&2
    exit 1
  fi
}

is_truthy() {
  case "$1" in
    1 | true | TRUE | yes | YES | on | ON) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_latest_native_tag() {
  releases_path="$tmp_dir/releases.json"

  download "https://api.github.com/repos/$repo/releases" "$releases_path"
  tag="$(awk -F '"' '/"tag_name": "agenthint-v/ { print $4; exit }' "$releases_path")"

  if [ -z "$tag" ]; then
    echo "agenthint install: no agenthint-v* release found" >&2
    exit 1
  fi

  echo "$tag"
}

resolve_release_base() {
  if [ "$version" = "latest" ]; then
    tag="$(resolve_latest_native_tag)"
    echo "https://github.com/$repo/releases/download/$tag"
  else
    echo "https://github.com/$repo/releases/download/$version"
  fi
}

need uname
need mktemp
need chmod
need mkdir

asset="$(detect_asset)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM
release_base="$(resolve_release_base)"

binary_path="$tmp_dir/$asset"
checksums_path="$tmp_dir/SHA256SUMS"

echo "Downloading $asset from $repo..."
download "$release_base/$asset" "$binary_path"

if download "$release_base/SHA256SUMS" "$checksums_path"; then
  expected="$(awk -v asset="$asset" '$2 == asset { print $1 }' "$checksums_path")"
  if [ -z "$expected" ]; then
    echo "agenthint install: checksum not found for $asset" >&2
    exit 1
  fi

  actual="$(sha256_file "$binary_path")"
  if [ "$expected" != "$actual" ]; then
    echo "agenthint install: checksum mismatch for $asset" >&2
    exit 1
  fi
else
  if is_truthy "$allow_missing_checksum"; then
    echo "agenthint install: SHA256SUMS not available; installing without checksum verification" >&2
  else
    echo "agenthint install: SHA256SUMS not available; refusing to install without verification" >&2
    echo "Set AGENTHINT_ALLOW_MISSING_CHECKSUM=1 to bypass checksum verification." >&2
    exit 1
  fi
fi

mkdir -p "$install_dir"
chmod +x "$binary_path"
mv "$binary_path" "$install_dir/$bin_name"

echo "Installed agenthint to $install_dir/$bin_name"
if ! command -v "$bin_name" >/dev/null 2>&1; then
  echo "Add $install_dir to PATH to run agenthint directly." >&2
fi
