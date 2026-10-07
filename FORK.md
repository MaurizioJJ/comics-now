# Personal ComicsNow fork

This fork keeps the author's history and separates upstream updates from personal
customizations. It is a source repository, not an automatic NAS deployment.

## Branches and remotes

- `origin`: `MaurizioJJ/comics-now`, the personal fork.
- `upstream`: `ComicsNow/comics-now`, the author's repository.
- `main`: an unmodified upstream tracking branch. At setup on October 6, 2026,
  it points to upstream 1.2.5, commit `62b7ecd79cd24bb38522dfbffcb85ad40e3d28ed`.
- `personal`: the customized integration branch, starting from the installed
  1.2.3 revision `5e19db4989876612b2a0c787f9260ee3d514192b`.

Starting `personal` at the installed revision deliberately avoids upgrading the
application while importing the already-tested fix. The newer author changes are
preserved on `main` and are available for a separately reviewed merge.

If cloning this fork elsewhere, add the author remote with
`git remote add upstream https://github.com/ComicsNow/comics-now.git`.
Use short-lived feature branches from `personal` for further customizations, then
merge them back into `personal`. Do not put personal changes on `main`.

## First personal release: 1.2.3-personal.1

Fixes repeated reading-list requests when no reading lists exist, which could
exhaust browser network resources and prevent folder navigation. The cache now
distinguishes an empty loaded result from an unloaded result, and overlapping
loads share one request. Explicit refresh and error reporting remain available.

Six regression tests cover empty responses, concurrent requests, explicit refresh,
preloaded empty caches, publisher lookup, direct-fetch fallback and failure/retry.
They use the existing Jest suite and frontend sandbox convention. No new runtime
dependencies, database migrations, comic-file changes or authentication changes.

## Local validation

The setup was validated with Node 22.22.0 and npm 11.14.1. From a checkout of
`personal`, install locked dependencies, run syntax checks and the unit suite, and
build using one command:

```sh
npm ci --no-fund --no-audit && node --input-type=module --check < public/js/library/smartlists.js && node --check tests/readingListsCache.test.js && npm test -- --runInBand && npm run build
```

The existing `npm run test:e2e` command is separate and was not run during fork
setup. Full local PDF/CBR conversion also needs Poppler (`pdftoppm`) and `unrar`;
these are absent from the setup machine and were not installed by this work.

## Bring in author updates without discarding personal changes

First fast-forward the clean upstream branch:

```sh
git fetch upstream --tags
git switch main
git merge --ff-only upstream/main
git push origin main
```

Then integrate the update on a short-lived review branch:

```sh
git switch -c update/upstream-YYYYMMDD personal
git merge --no-ff upstream/main
```

Replace `YYYYMMDD` with the actual update date. Resolve any conflicts deliberately;
do not use force-sync, hard resets, or blanket "ours/theirs" conflict resolution.
Run the validation command and review `git diff personal...HEAD`. If acceptable:

```sh
git switch personal
git merge --ff-only update/upstream-YYYYMMDD
git push origin personal
```

An upstream merge updates source only. Deploying a new version to the NAS requires
a separately approved build, rollback plan and live verification. If an update
removes the need for a personal patch, retire that patch after testing rather than
carrying a duplicate implementation indefinitely.

## Personal deployment versions

The version shown beside the Comics Now logo is generated from `package.json` by
Vite. Before each deployment, increase that package version and keep the root
`package-lock.json` version in sync. Build with `npm run build:css && npm run build`,
then deploy the resulting `public/dist` as a new, versioned static overlay. Keep the
prior Compose file and overlay directory intact for rollback. The server container
version is independent; do not replace it as part of a frontend-only release.

## Automation safety

GitHub Actions are disabled for this fork. The inherited workflows target the
author's Docker Hub, GHCR and npm publishing setup; they must not run unchanged in
the personal fork. No publication, schedule or automatic deployment was enabled.
Before enabling Actions, configure a read-only validation workflow, pin action
revisions, remove or disable inherited publishing workflows, and review credentials
and permissions. Publishing personal images must target the personal namespace.

## Release 1.2.6-personal.1

Deployed on October 7, 2026 to SynoLiberec as a frontend-only release. The service
continues to use the pinned image
`ghcr.io/comicsnow/comics-now@sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.
The version label is visible beside the logo. The release also includes the comic
metadata dialog, per-field search, sticky library header, and the existing excluded
folder and Bédéthèque settings controls.

### Validation evidence and remaining gates

- Correctness: all 70 Jest suites and 545 tests passed.
- Static quality: CSS generation and the production build passed. Vite reported its
  existing config-loader and non-module JSZip warnings; Browserslist also reported
  stale `caniuse-lite` data. No lint or type-check command is configured.
- Self-review: source is committed as `8bac5cc` on
  `feature/comic-search-metadata-view`. The release changes only the frontend
  overlay; it keeps the current container image and backend overlays.
- Security: Gitleaks flagged one historical API-key-like test value in commit
  `7c5645a76533d5ce8a2490b7651942e0b59c909e`. The production dependency audit found
  critical `proxy-addr` and high `sharp` advisories. These existing dependencies
  were not changed in this frontend-only release.
- Delivery: built from the fork source and deployed to the versioned overlay.
  GitHub Actions remain disabled; the feature branch has not been pushed.
- Runtime: the page, JavaScript and CSS returned HTTP 200; the browser showed
  `v1.2.6-personal.1`; the container is running and healthy. The pinned image is
  unchanged.
- Reversibility: the prior Compose file is at
  `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.1/docker-compose.yml`.
  Restore it and recreate the service to return to the previous frontend overlay.

# Folder exclusions (deployed)

In Settings, each configured library has an **Excluded folders** field. Enter one
relative folder per line, such as `Archive/Old` or `Private`, then save. Paths are
literal, case-sensitive names, not wildcard patterns; the entire subtree is hidden
from browsing/search and skipped by scans. Absolute paths, traversal, the library
root, more than 100 entries, and entries over 1024 characters are rejected.

Comic files, indexed metadata, thumbnails, and reading progress are retained. Clear
the field and save to restore indexed comics; run a full scan to discover files added
while excluded. Exclusions apply to all users, including administrators, and are
not a replacement for filesystem permissions. Matching is lexical: use the path
under which a folder is indexed rather than a separate symlink alias.

The feature uses no database migration and retains comic files and reading
progress. The current NAS deployment keeps the excluded-folder settings and
server overlays active.

## Release 1.2.6-personal.2

This release fetched full ComicInfo metadata when opening a comic's metadata
dialog. It also introduced an optional case-insensitive folder-name substring
list per library. The legacy helper still used by live scanning and browsing did
not yet apply that new list; release `1.2.6-personal.3` wires it through all
three paths.

Deployed October 7, 2026 to SynoLiberec. The image remains pinned to
`ghcr.io/comicsnow/comics-now@sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.
The new versioned Compose file mounts the release's frontend, config, and admin
settings route, preserving the remaining scanner and tagger overlays.

### Release evidence and remaining gates

- Correctness: all 71 Jest suites and 559 tests passed. The metadata dialog
  regression test failed before the fix because it made no full-metadata
  request, then passed after the change. Focused exclusion and dialog suites
  also passed.
- Static quality: `npm run build` and `git diff --check` passed. Vite emitted
  its existing config-loader and JSZip warnings; no lint or type-check command
  is configured.
- Security: no dependency versions changed. Gitleaks scanned all 187 commits
  and found one historical generic API key-like fixture at
  `tests/geminiCompliance.test.js:86` in commit
  `7c5645a76533d5ce8a2490b7651942e0b59c909e`; it remains unresolved. `npm audit
  --omit=dev --audit-level=critical` reported critical `proxy-addr` and high
  `sharp` advisories. The security gate remains open.
- Delivery: built frontend and server overlays are in
  `release/comics-now-1.2.6-personal.2/`. The immutable upstream image and all
  unrelated live mounts remain unchanged.
- Runtime: Synology reports the container healthy; the live page returned
  HTTP 200 and served `v1.2.6-personal.2`. An unauthenticated request to the
  admin exclusion endpoint returned HTTP 401, confirming the route is behind
  its admin guard. Browser UI also loaded the new version. The metadata dialog
  action itself was validated by the dialog-level regression test, not clicked
  in the live browser.
- Reversibility: the prior Compose file and a 517 MB data backup are at
  `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.2/`. Restore
  `docker-compose.yml` from that directory and recreate the service to roll
  back.

## Release 1.2.6-personal.3

This correction updates the live `excluded-folders` helper to call the shared
config matcher. The optional folder-name text rules now apply consistently to
library scans, folder browsing, and search while retaining global exact-path
rules. No comic files or reading progress are changed.

Deployed October 7, 2026 to SynoLiberec. The pinned image is unchanged. The
versioned Compose file adds only the new exclusion-helper overlay alongside the
versioned frontend and settings/config overlays.

- Correctness: all 71 suites and 559 tests pass, including the scanner/browser
  helper regression. The full ComicInfo dialog request regression is also
  covered.
- Runtime: the container reports healthy and the live page returns HTTP 200
  with `v1.2.6-personal.3`. A fresh Chrome tab loaded the updated version.
- Rollback: the current data and prior Compose file are backed up under
  `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.3/`.
- Security: the history scan still finds the same test-fixture key-like string;
  the dependency audit still reports critical `proxy-addr` and high `sharp`
  findings. Those gates remain open.
