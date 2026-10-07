# Comics Now 1.2.6-personal.5

Shows the actual issue number from a `Txx` filename/title when indexed `Number`
metadata is wrong, loads ComicInfo directly from the archive, merges it with
indexed metadata, and opens the full populated metadata list by default. The
archive remains read-only; no comic files or database rows are modified.

Deployed October 7, 2026 to SynoLiberec at `http://192.168.1.19:3000/`.

The upstream image remains pinned to
`sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.
The Compose file retains the existing scanner, tagger, settings, authentication,
and exclusion overlays. It mounts this release's metadata route and frontend.

## Build and verify

From the repository root, run `npm run build` and `npm test -- --runInBand`.
Then populate this release's ignored frontend artifact:

```sh
mkdir -p release/comics-now-1.2.6-personal.5/dist
cp -R public/dist/. release/comics-now-1.2.6-personal.5/dist/
```

## Rollback

Restore the Compose file and config snapshot from
`/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.5/`, then recreate
the service with `/usr/local/bin/docker-compose up -d --no-deps --pull never
comics-now` from `/volume1/docker/comics-now`.
