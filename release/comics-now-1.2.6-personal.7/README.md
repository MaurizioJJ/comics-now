# Comics Now 1.2.6-personal.7

Fixes Language field search when the library uses Folder Mode and its database
rows do not contain `LanguageISO`. The search route reads the archive's
ComicInfo language on demand, at a bounded concurrency, and caches the value
for the current file version. French name and ISO code searches match `fr`,
`fra`, and `fre` values.

The release preserves the existing deployment overlays and pins the same
upstream image. It mounts this release's frontend bundle and library search
route.

## Build and verify

Run `npm run build` and `npm test -- --runInBand`. The `dist` folder and matching
library route are included in this release snapshot.

## Rollback

Restore `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.7/docker-compose.before.yml`
and recreate the service. The Comics Now database is not modified by language
search.
