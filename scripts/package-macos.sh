#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "${script_dir}/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/package-macos.sh [--no-install] [--open]

Builds and packages Gocus as a macOS app bundle.
By default, it also updates /Applications/Gocus.app.

Outputs:
  release/macos/Gocus.app
  release/macos/Gocus-<version>-macOS.zip

Options:
  --install      Copy the packaged app into /Applications/Gocus.app (default)
  --no-install   Do not update /Applications after packaging
  --open         Open the installed app after building
  -h, --help     Show this help

Environment:
  GOCUS_PRODUCT_NAME  Override the app display name
  GOCUS_BUNDLE_ID     Override the bundle identifier
  GOCUS_VERSION       Override CFBundleShortVersionString
  GOCUS_BUILD         Override CFBundleVersion
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
  echo "Node.js is required to package Gocus." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build Gocus before packaging." >&2
  exit 1
fi

if [[ ! -d "${project_root}/node_modules/electron/dist/Electron.app" ]]; then
  echo "Electron runtime is missing. Run npm install first." >&2
  exit 1
fi

cd "$project_root"
exec node "${project_root}/scripts/package-macos.cjs" "$@"
