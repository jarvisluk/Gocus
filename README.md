# Gocus

Gocus is a compact Electron + React desktop utility for tracking a local Git repository from a side-floating panel.

GitHub repository: [jarvisluk/gocus](https://github.com/jarvisluk/gocus)

The product direction is the selected **Pinned Side Panel** design:

- narrow floating drawer instead of a full Git client
- light and dark themes
- current repo and branch status
- working-tree summary chips
- recent commits as a compact mini timeline
- changed-files preview
- explicit, safe entry points for Git-changing operations

## Run

```bash
npm install
npm run dev
```

## Verify

Run the full local quality gate before handing off changes:

```bash
npm run verify
```

This runs CSS linting, unit checks for shared logic, the Playwright UI smoke test, and the production build.

## Build

```bash
npm run build
```

## Release

macOS releases are built from `v*` tags through GitHub Actions and published as GitHub Release zip assets for the built-in updater.

```bash
npm run package:mac:release
```

See [docs/release.md](docs/release.md) for the tag flow, signing secrets, and auto-update asset requirements.
