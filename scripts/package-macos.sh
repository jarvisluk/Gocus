#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/package-macos.sh [--no-install] [--open]

Builds and packages Git Peek as a macOS app bundle.
By default, it also updates /Applications/Git Peek.app.

Outputs:
  release/macos/Git Peek.app
  release/macos/GitPeek-<version>-macOS.zip

Options:
  --install      Copy the packaged app into /Applications/Git Peek.app (default)
  --no-install   Do not update /Applications after packaging
  --open         Open the installed app after building
  -h, --help     Show this help

Environment:
  GIT_PEEK_PRODUCT_NAME  Override the app display name
  GIT_PEEK_BUNDLE_ID     Override the bundle identifier
  GIT_PEEK_VERSION       Override CFBundleShortVersionString
  GIT_PEEK_BUILD         Override CFBundleVersion
  CODESIGN_IDENTITY      Use a signing identity instead of ad-hoc signing
  SKIP_CODESIGN=1        Skip codesign
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "package-macos.sh only supports macOS." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to package Git Peek." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build Git Peek before packaging." >&2
  exit 1
fi

if [[ ! -d "${project_root}/node_modules/electron/dist/Electron.app" ]]; then
  echo "Electron runtime is missing. Run npm install first." >&2
  exit 1
fi

cd "$project_root"
exec node "${project_root}/scripts/package-macos.cjs" "$@"
