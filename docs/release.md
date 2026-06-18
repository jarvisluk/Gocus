# Release

Git Peek releases are macOS zip assets published through GitHub Releases.
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
GIT_PEEK_VERSION=0.2.0 GIT_PEEK_BUILD=1 npm run package:mac:release
```

The release zip is written to:

```text
release/macos/GitPeek-<version>-mac-<arch>.zip
```

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
Manual runs create the matching `v<version>` GitHub Release from the selected
commit, and that selected commit must already be contained in `origin/main`.

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

The update feed is:

```text
https://update.electronjs.org/jarvisluk/git-tree-vis/darwin-<arch>/<current-version>
```

The feed is backed by GitHub Releases, so each release needs a non-draft zip asset named like:

```text
GitPeek-0.2.0-mac-arm64.zip
GitPeek-0.2.0-mac-x64.zip
```

The app intentionally skips update checks in development, unpackaged builds,
and non-macOS runtimes.
