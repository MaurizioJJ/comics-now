# Comics Now 1.2.6-personal.4

Fixes authenticated static asset delivery. Vite bundles are served from `/assets/`,
so the auth middleware now permits those files to load for the app shell while
keeping API routes protected. The release updates the live auth middleware and
frontend bundle. No database migration is needed.

Deployed October 7, 2026 to SynoLiberec at `http://192.168.1.19:3000/`.

The upstream image remains pinned to
`sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.
The release Compose file retains the scanner, tagger, settings, and exclusion
overlays from `.3` and mounts this release's auth middleware and frontend.

## Build and verify

From the repository root, run `npm run build` and `npm test -- --runInBand`.
Then populate this release's ignored frontend artifact:

```sh
mkdir -p release/comics-now-1.2.6-personal.4/dist
cp -R public/dist/. release/comics-now-1.2.6-personal.4/dist/
```

The version displayed beside the logo is injected from `package.json`.

## Rollback

Restore the pre-release Compose file from
`/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.4/docker-compose.yml`
and recreate the service with `/usr/local/bin/docker-compose up -d --no-deps
--pull never comics-now` from `/volume1/docker/comics-now`.
