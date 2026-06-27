# Release

Gocus releases publish macOS zip assets and Windows portable zip assets through
GitHub Releases. The packaged macOS app uses Electron's `autoUpdater` with the
`update.electronjs.org` feed, so macOS Release assets must stay public and must
include the macOS platform and architecture in the zip name. Windows portable
builds are downloadable release assets but do not support automatic updates yet.

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

From Windows, build the portable release artifact with PowerShell:

```powershell
$env:GOCUS_VERSION = "0.2.0"
$env:GOCUS_BUILD = "1"
npm run package:win:release
```

If the Electron runtime download stalls on a regional network, set
`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` before running the
package command.

The release zips are written to:

```text
release/macos/Gocus-<version>-mac-<arch>.zip
release/windows/Gocus-<version>-win-<arch>.zip
```

## Release Candidate

Use `Actions > Release > Run workflow` for an artifact-only candidate before
moving a public tag.

- `version`: release version without `v`, such as `0.1.0`.
- `create_release`: leave off for a candidate build.
- `prerelease`: only applies when `create_release` is enabled.
- `notarize`: `auto` uses notarization only when all Apple secrets exist.
- Artifacts are uploaded as `gocus-macos-<version>` and
  `gocus-windows-<version>`.

## Develop Candidate Flow

The `Develop Release Candidate` workflow builds candidate artifacts from
`develop`, uploads them to the workflow run, and publishes an update release to
the dedicated `jarvisluk/Gocus-Develop-Releases` repository. It runs
automatically on pushes to `develop` and can also be started manually from
Actions.

- A local commit alone does not publish anything. Publishing starts when the
  commit is pushed to `origin/develop`.
- Merging a feature branch into `develop` and pushing `develop` creates a new
  develop release candidate automatically.
- Consecutive pushes to `develop` cancel the older in-progress candidate run
  and keep the newest commit as the release source.
- `.github/develop-next-version` is the target stable version for develop
  candidates. CI publishes `<target>-dev.<run number>`, such as
  `0.2.0-dev.123`.
- To move develop from patch candidates to a larger release train, change
  `.github/develop-next-version`, for example from `0.1.2` to `0.2.0`, then
  merge that change into `develop`.
- Manual `version` is optional. If provided, it is an exact candidate version
  override and takes precedence over `.github/develop-next-version`.
- `notarize`: `auto` uses notarization only when all Apple secrets exist.
- `publish_update_release`: `true` publishes the develop update release when
  `DEVELOP_RELEASE_TOKEN` is configured.
- Artifacts are uploaded to the workflow run as
  `gocus-develop-macos-<version>` and `gocus-develop-windows-<version>`.
- The develop update release is a normal GitHub Release in
  `jarvisluk/Gocus-Develop-Releases`, tagged `v<version>`. Do not mark these
  releases as GitHub prereleases; the public Electron update service ignores
  prerelease releases.

Use this workflow for internal validation before merging `develop` into `main`.
Develop candidate packages are marked with the `develop` update channel and
point their develop update feed at `jarvisluk/Gocus-Develop-Releases`. Stable
packages continue to use `jarvisluk/Gocus`. The develop update release is used
by macOS auto-update; Windows candidates are workflow artifacts only.

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
8. The `Release` GitHub Actions workflow builds macOS and Windows artifacts,
   signs and notarizes macOS when secrets exist, uploads zips and checksums, and
   creates or updates the GitHub Release.

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
DEVELOP_RELEASE_TOKEN
```

If the certificate secrets are missing, CI falls back to ad-hoc macOS signing.
If notarization secrets are missing while a Developer ID identity is used,
Gatekeeper verification will fail before publishing.
Windows release zips are currently unsigned portable builds.

`DEVELOP_RELEASE_TOKEN` needs permission to create and edit releases in
`jarvisluk/Gocus-Develop-Releases`. A fine-grained token limited to that
repository with Contents read/write permission is preferred.

### Developer ID Signing Setup

Create a **Developer ID Application** certificate in Apple Developer, install it
in Keychain Access, then export the certificate and private key together as a
password-protected `.p12`. Convert that file for GitHub Actions:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
```

Store the copied value as `MACOS_CERTIFICATE_P12_BASE64`, and store the `.p12`
export password as `MACOS_CERTIFICATE_PASSWORD`. The signing identity must match
the Keychain identity exactly, for example:

```bash
security find-identity -v -p codesigning
```

Use the displayed `Developer ID Application: ... (TEAMID)` value for
`MACOS_CODESIGN_IDENTITY`.

For notarization, create an app-specific password for the Apple ID and configure
`APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_SPECIFIC_PASSWORD`. `MACOS_KEYCHAIN_PASSWORD`
is optional; CI uses a generated temporary keychain password when it is not set.

After configuring the secrets, run the `Release` or `Develop Release Candidate`
workflow with `notarize=true` once to fail fast if any credential is incomplete.
Successful signed builds should pass:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Gocus.app
spctl --assess --type execute --verbose=4 /Applications/Gocus.app
```

## Auto Update

Packaged macOS builds check for updates shortly after launch and then
periodically. Users can also run **Check for Updates...** from the app menu,
Help menu, or menu bar icon menu. Windows portable builds report that automatic
updates are unavailable.

The Settings panel's **App** page includes **Automatically check for updates**
and **Automatically install updates** toggles plus a **Channel** selector.
Automatic checks are on by default. Automatic install is off by default, so
downloaded updates ask before relaunching.

The update feed is:

```text
https://update.electronjs.org/jarvisluk/gocus/darwin-<arch>/<current-version>
```

The stable channel uses `GOCUS_UPDATE_REPO` / `GOCUS_UPDATE_STABLE_REPO`, and
the develop channel uses `GOCUS_UPDATE_DEVELOP_REPO`. CI packages develop
builds with:

```bash
GOCUS_UPDATE_CHANNEL=develop
GOCUS_UPDATE_DEVELOP_REPO=jarvisluk/Gocus-Develop-Releases
```

`GOCUS_UPDATE_CHANNELS` can also provide a JSON map when packaging locally.

If the selected channel has no configured GitHub Releases repository, manual
checks report that updates are unavailable for that channel instead of falling
back to another channel.

Stable and develop versions are compared independently. Same-channel checks use
the installed app version. When the selected channel differs from the installed
package channel, Gocus checks the target channel from a `0.0.0` baseline so the
latest target-channel package can install even if its version is lower than the
currently installed package. This allows switching from a develop candidate
back to the latest stable release, and from stable to the latest develop
candidate, without coordinating the two version sequences.

The macOS feed is backed by GitHub Releases, so each release needs a non-draft
zip asset named like:

```text
Gocus-0.2.0-mac-arm64.zip
Gocus-0.2.0-mac-x64.zip
```

The app intentionally skips update checks in development, unpackaged builds,
and non-macOS runtimes. Windows release assets are still published to GitHub
Releases for direct download:

```text
Gocus-0.2.0-win-x64.zip
```
