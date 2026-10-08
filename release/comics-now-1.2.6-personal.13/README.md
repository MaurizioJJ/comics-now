# Comics Now 1.2.6-personal.13

This candidate repairs generic publisher values from embedded ComicInfo and omits the `Pages` detail list in the metadata dialog.

## Security gate

The production audit reports no vulnerabilities (`npm audit --omit=dev`). Full `npm audit` still reports 26 development dependency findings (21 moderate, 5 high) in Tailwind/Jest dependency chains; safe fixes require major-version changes. The Dockerfile prunes development dependencies before the runtime stage. The live `.12` container still runs `proxy-addr@2.0.7` and `sharp@0.35.4`; deployment uses a newly built image with the patched production lockfile.

## Runtime image

The Dockerfile derives from the exact image digest currently deployed and replaces only `/app/node_modules` using this release's locked production dependencies. This retains the existing application files and NAS overlays. Build and inspect the release image on SynoLiberec before recreating the service:

```sh
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now -f /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.13/deployment.compose.yml config
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now -f /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.13/deployment.compose.yml build comics-now
/usr/local/bin/docker run --rm --entrypoint node comics-now-personal:1.2.6-personal.13 -e 'for (const n of ["proxy-addr", "sharp"]) { let p=require.resolve(n), fs=require("fs"), path=require("path"); while (!fs.existsSync(path.join(path.dirname(p), "package.json"))) p=path.join(path.dirname(p), "..", "package.json"); console.log(n, require(path.join(path.dirname(p), "package.json")).version); }'
```

## Local validation

- `npm test -- --runInBand`: 76 suites, 579 tests passed.
- `npm run build`: passed without warnings; the build emits `jszip.min.js` into `dist`.
- `node --check server/services/comicinfo-indexer.js`: passed.
- `git diff --check`: passed.
- `gitleaks git --redact --no-banner`: 193 commits scanned, no leaks found.
- Docker publish CI runs the full test suite and the production dependency audit; third-party Actions are pinned to immutable commit SHAs.

## Production data repair

On first startup, the indexer marks folder-mode records with a generic publisher in either the database column or ComicInfo metadata for re-indexing. It reads the original archive, normalizes a specific publisher, and updates only generic publisher values. Existing meaningful publisher values are preserved. Processing uses the existing one-hour active and one-hour pause windows. The live database has not been changed by this candidate.

Before deployment, create a fresh, consistent SQLite backup on SynoLiberec:

```sh
sqlite3 /volume1/docker/comics-now/data/comics-now.db ".backup /volume1/docker/comics-now/data/backups/comics-now-pre-publisher-repair-20261009.db"
```

The candidate compose file mounts the `.13` dist and indexer. Back up the current compose file before replacing it:

```sh
cp /volume1/docker/comics-now/docker-compose.yml /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.13.yml
cp /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.13/deployment.compose.yml /volume1/docker/comics-now/docker-compose.yml
```

Verify the queued count and indexer status after startup. A known affected archive, `100 Bullets - #01`, contains `DC Comics` in its ComicInfo source while the live row currently says `comics`.

## Rollback

Restore the prior compose and recreate the service:

```sh
cp /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.13.yml /volume1/docker/comics-now/docker-compose.yml
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now
```

The data repair only replaces generic publisher values with normalized values from the source archives. To restore the exact pre-repair database instead, stop the service, restore the SQLite backup, then start the `.12` service:

```sh
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now stop comics-now
sqlite3 /volume1/docker/comics-now/data/comics-now.db ".restore /volume1/docker/comics-now/data/backups/comics-now-pre-publisher-repair-20261009.db"
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now
```
