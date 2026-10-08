# Comics Now 1.2.6-personal.11

Language searches now trust the persisted ComicInfo indexing marker. Once the
indexer has checked an archive, language filters use the SQLite metadata and
do not reopen that archive on every search, including when ComicInfo has no
language value.

## Validation

- `node --check` passed for the changed server files.
- `git diff --check` passed.
- `npm run build` passed; Vite reported its existing config-loader and JSZip
  warnings.
- The live index completed for all 21,974 Folder Mode rows. A live French
  single-field API search returned 6,632 comics, included the T01 comic, and
  excluded `100 anni di fumetto italiano`.
- Jest tests were not run in this turn.

## Rollback

Restore `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.11/docker-compose.before.yml`
to return to .10. The index data is preserved and .10 understands it.
