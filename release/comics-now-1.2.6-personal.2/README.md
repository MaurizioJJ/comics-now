# Comics Now 1.2.6-personal.2

This personal release updates the metadata dialog to fetch the full ComicInfo
record on demand. It also adds optional per-library folder-name text exclusions,
matched case-insensitively at any folder depth. Existing global exact-path and
per-library relative-path exclusions remain supported. Excluded content stays
on disk, and the change requires no database migration.

Deployed on October 7, 2026 to SynoLiberec at `http://192.168.1.19:3000/`.
The upstream image remains pinned to digest
`sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109`.

## Build and verification

Run `npm run build` and `npm test -- --runInBand` from the repository root.
The version beside the logo is injected from `package.json` at build time. The
generated `dist` directory is ignored by Git and must be rebuilt and copied for
a later redeployment:

```sh
mkdir -p release/comics-now-1.2.6-personal.2/dist
cp -R public/dist/. release/comics-now-1.2.6-personal.2/dist/
```

## Deployment

The Compose file in this directory keeps the pinned upstream image and existing
scanner/tagger overlays. It switches the frontend and the server configuration
and settings route to the versioned files in this release. Before applying it,
back up the current Compose file and `data` directory, then run
`/usr/local/bin/docker-compose -f docker-compose.yml up -d --no-deps --pull never comics-now`.

## Rollback

Restore the pre-release Compose file from
`backups/comics-now-1.2.6-personal.2/docker-compose.yml` and recreate the
service with the same command. The existing database and library files are not
modified by deployment.
