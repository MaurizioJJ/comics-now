# Comics Now 1.2.6-personal.3

This release carries forward the full ComicInfo dialog and configurable
folder-name exclusions. It updates the live legacy exclusion helper so folder
matching now applies consistently to scans, browsing, and search. Existing
global exact-path rules remain supported. No database migration is needed.

Deployed October 7, 2026 to SynoLiberec at `http://192.168.1.19:3000/`.

The upstream image remains pinned to
`sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.
The release Compose file switches only versioned frontend/config/settings and
exclusion-helper mounts; scanner/tagger overlays remain in place.

## Build and verify

From the repository root, run `npm run build` and `npm test -- --runInBand`.
Then populate the ignored frontend artifact:

```sh
mkdir -p release/comics-now-1.2.6-personal.3/dist
cp -R public/dist/. release/comics-now-1.2.6-personal.3/dist/
```

The version displayed beside the logo is injected from `package.json`.

## Rollback

Restore the pre-release Compose file from
`/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.3/docker-compose.yml`
and recreate the service with `/usr/local/bin/docker-compose up -d --no-deps
--pull never comics-now` from `/volume1/docker/comics-now`.
