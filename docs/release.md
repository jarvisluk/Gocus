# Release

Gocus releases are macOS zip assets published through GitHub Releases.
The packaged app uses Electron's `autoUpdater` with the `update.electronjs.org`
feed, so Release assets must stay public and must include the macOS platform
and architecture in the zip name.

## Local Gate

Run the full local gate before creating a release tag:

```bash
npm ci
npm run verify
```

To build the same release artifact locally without installing into `/Applications`:

```bash
GOCUS_VERSION=0.2.0 GOCUS_BUILD=1 npm run package:mac:release
```

The release zip is written to:

```text
release/macos/Gocus-<version>-mac-<arch>.zip
```

## Release Candidate

Use `Actions > Release > Run workflow` for an artifact-only candidate before
moving a public tag.

- `version`: release version without `v`, such as `0.1.0`.
- `create_release`: leave off for a candidate build.
- `prerelease`: only applies when `create_release` is enabled.
- `notarize`: `auto` uses notarization only when all Apple secrets exist.

## Develop Candidate Flow

The `Develop Release Candidate` workflow builds candidate artifacts from
`develop` without creating GitHub Releases or tags. It runs automatically on
pushes to `develop` and can also be started manually from Actions.

- Manual `version` is optional. If omitted, CI derives
  `<package patch + 1>-dev.<run number>`, such as `0.1.2-dev.123`.
- `notarize`: `auto` uses notarization only when all Apple secrets exist.
- Artifacts are uploaded to the workflow run as
  `gocus-develop-macos-<version>`.

Use this workflow for internal validation before merging `develop` into `main`.
The official auto-update feed still comes only from public GitHub Releases
created by the main/tag release flow.

For manual runs to appear in the Actions UI, the workflow file must exist on
the repository's default branch. Push-triggered candidate builds run once the
workflow file exists on `develop`.

## Tag Release Flow

1. Sync `main` with `origin/main`.
2. Bump `package.json` to the release version.
3. Run `npm run verify`.
4. Commit the version bump.
5. Merge or fast-forward that commit into `origin/main`.
6. Create and push a tag named `v<version>` from that main commit, for example
   `v0.2.0`.
7. The release workflow rejects any commit that is not contained in
   `origin/main`.
8. The `Release` GitHub Actions workflow builds, signs, notarizes when secrets
   exist, uploads the zip and checksum, and creates or updates the GitHub
   Release.

The workflow can also be run manually from GitHub Actions with a version input.
Manual artifact-only runs can be used as release candidates. Manual GitHub
Release creation must run from `main`, and the selected commit must already be
contained in `origin/main`.

## Required GitHub Secrets

Signing is optional for local artifacts but required for public auto-update
reliability. Configure these repository secrets for official releases:

```text
MACOS_CERTIFICATE_P12_BASE64
MACOS_CERTIFICATE_PASSWORD
MACOS_KEYCHAIN_PASSWORD
MACOS_CODESIGN_IDENTITY
APPLE_ID
APPLE_TEAM_ID
APPLE_APP_SPECIFIC_PASSWORD
```

If the certificate secrets are missing, CI falls back to ad-hoc signing.
If notarization secrets are missing while a Developer ID identity is used,
Gatekeeper verification will fail before publishing.

## Auto Update

Packaged macOS builds check for updates shortly after launch and then
periodically. Users can also run **Check for Updates...** from the app menu,
Help menu, or menu bar icon menu.

The Settings panel's **App** page includes **Automatically check for updates**
and **Automatically install updates** toggles. Automatic checks are on by
default. Automatic install is off by default, so downloaded updates ask before
relaunching.

The update feed is:

```text
https://update.electronjs.org/jarvisluk/gocus/darwin-<arch>/<current-version>
```

The feed is backed by GitHub Releases, so each release needs a non-draft zip asset named like:

```text
Gocus-0.2.0-mac-arm64.zip
Gocus-0.2.0-mac-x64.zip
```

The app intentionally skips update checks in development, unpackaged builds,
and non-macOS runtimes.
