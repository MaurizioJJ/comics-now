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

## Automation safety

GitHub Actions are disabled for this fork. The inherited workflows target the
author's Docker Hub, GHCR and npm publishing setup; they must not run unchanged in
the personal fork. No publication, schedule or automatic deployment was enabled.
Before enabling Actions, configure a read-only validation workflow, pin action
revisions, remove or disable inherited publishing workflows, and review credentials
and permissions. Publishing personal images must target the personal namespace.

## Validation evidence and remaining gates

- Correctness: five new regression cases failed on the original module, then all
  six passed with the fix. The full existing suite passed: 66 suites, 517 tests.
- Static: JavaScript syntax and `git diff --check` passed. The full static gate is
  not met: no lint/type-check tooling is configured, and Vite retains its upstream
  config-loader and non-module JSZip warnings. Dependency installation also reports
  existing deprecations. They were not suppressed or changed as part of this fix.
- Self-review: the code patch matches the tested NAS fix. Tests follow the existing
  framework. No lockfile, application version, upstream workflows or data changed.
- Security: repository history was scanned with Gitleaks. It flagged one inherited
  API-key test literal in `tests/geminiCompliance.test.js`, commit
  `7c5645a76533d5ce8a2490b7651942e0b59c909e`; no clean-history claim is made.
  `npm audit --omit=dev` reports existing critical `proxy-addr` and high `sharp`
  findings. The full security gate is deliberately not met; no dependency upgrade
  is included in this source-only fork setup.
- Delivery: locked installation, the full unit suite and frontend build ran locally.
  CI is deliberately not enabled until fork-safe automation is reviewed. A custom
  Docker image and end-to-end suite were not built/run, so the full gate is not met.
- Runtime: the regression verifies failure logging and explicit retry. No fork
  version was deployed and no new live-runtime claim is made during source setup.
- Reversibility: source changes can be reverted on `personal`. The installed NAS
  version and its existing rollback remain untouched; a future image deployment
  must retain its previous image and configuration before switching versions.
