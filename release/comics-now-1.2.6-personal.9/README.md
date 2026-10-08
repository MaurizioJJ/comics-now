# Comics Now 1.2.6-personal.9

Folder Mode libraries now index embedded ComicInfo.xml into the SQLite metadata
field. The background indexer works for at most one hour, pauses for one hour,
and resumes from per-comic completion markers after restarts. It merges only
non-empty ComicInfo values and preserves existing non-empty metadata. Existing
folder-derived publisher and series columns remain unchanged.

Index status is available to administrators at
`GET /api/v1/admin/metadata-index/status` (`indexing`, `paused`, or `complete`,
with processed and enriched counts). Unreadable or empty archives are recorded
and skipped so they do not block later comics. A normal scan resets the marker
when it replaces a comic row, allowing changed or newly discovered comics to be
indexed.

The release retains the upstream image digest and all existing deployment
overlays. It adds only the versioned server, database migration, indexer, admin
status route, and frontend bundle.

## Validation

- `node --check` passed for the changed server files.
- `git diff --check` passed.
- `npm run build` passed; Vite reported its existing config-loader and JSZip
  warnings.
- Jest tests were not run in this turn.

## Rollback

Restore `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.9/docker-compose.before.yml`
and recreate the service. The migration only adds `metadataIndexedAt`; the
indexer only merges embedded metadata into `comics.metadata`. To reverse its
data writes, restore the pre-release SQLite backup from the same backup folder.
