# Comics Now 1.2.6-personal.13

This candidate repairs generic publisher values from embedded ComicInfo and omits the `Pages` detail list in the metadata dialog.

## Security gate

The production audit reports no vulnerabilities (`npm audit --omit=dev`). Full `npm audit` still reports 26 development dependency findings (21 moderate, 5 high) in Tailwind/Jest dependency chains; safe fixes require major-version changes. The Dockerfile prunes development dependencies before the runtime stage. The deployed `.13` image runs `proxy-addr@2.0.8` and `sharp@0.35.5`.

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

On first startup, the indexer marks folder-mode records with a generic publisher in either the database column or ComicInfo metadata for re-indexing. It reads the original archive, normalizes a specific publisher, and updates only generic publisher values. Existing meaningful publisher values are preserved. Processing uses the existing one-hour active and one-hour pause windows. The live database was backed up and repaired during deployment; see **Deployment record** below.

Before deployment, create a fresh, consistent SQLite backup on SynoLiberec:

```sh
sqlite3 /volume1/docker/comics-now/data/comics-now.db ".backup /volume1/docker/comics-now/data/backups/comics-now-pre-publisher-repair-20261009.db"
```

The candidate compose file mounts the `.13` dist and indexer. Back up the current compose file before replacing it:

```sh
cp /volume1/docker/comics-now/docker-compose.yml /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.13.yml
cp /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.13/deployment.compose.yml /volume1/docker/comics-now/docker-compose.yml
```

Verify the queued count and indexer status after startup. A known affected archive, `100 Bullets - #01`, contains `DC Comics` in its ComicInfo source.

## Deployment record

- Deployed on SynoLiberec on 2026-10-09 as `comics-now-personal:1.2.6-personal.13` (image ID `sha256:8f773b24d123fc3317915aecfd601c26f62174673879259fb58306400c8a9421`). The service is healthy and the app returns HTTP 200.
- The active compose file matches this release's `deployment.compose.yml`; the rollback copy is `/volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.13.yml` (SHA256 `fc2435c6541a57dc8f548807a73605f051d838583b51dfa4ca852bfe6e735c5b`).
- The pre-repair database backup is `/volume1/docker/comics-now/data/backups/comics-now-pre-publisher-repair-20261009.db` (SHA256 `8e4ac305e673050b5ca6307117e41b89490ba32540fdeab8ebaf2ea8f1b99331`). Its SQLite integrity check passed; it contains 21,980 comic rows and 18,126 generic publisher values.
- The indexing pass completed with 40,100 records processed, 34,430 enriched, 2,733 unchanged, 2,937 without ComicInfo, and zero indexer errors. The live DB contains 4,076 generic publisher values (14,050 fewer than the backup); no remaining generic-publisher row has a specific publisher in its stored ComicInfo metadata. Those rows need a source with a specific publisher before they can be repaired safely.
- Live record and UI verification: `100 Bullets - #01` has `publisher = DC Comics` and ComicInfo `Publisher = DC Comics`. The metadata dialog shows DC Comics and omits the `Pages` list. `PageCount` remains available as the one-number page-count field.

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
