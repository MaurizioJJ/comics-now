# Comics Now 1.2.6-personal.10

This follow-up keeps the ComicInfo indexing job running and resuming in one-hour
work windows separated by one-hour pauses. It corrects the progress counters so
archives with no new fields are distinct from archives with no readable
ComicInfo.xml. It also checks the database schema before adding the progress
column, avoiding a duplicate-column error on later starts.

## Validation

- `node --check` passed for the changed server files.
- `git diff --check` passed.
- `npm run build` passed; Vite reported its existing config-loader and JSZip
  warnings.
- Jest tests were not run in this turn.

## Rollback

Restore `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.9/docker-compose.before.yml`
to roll back the service. Restore `comics-now.db.before` from the same folder to
reverse metadata writes made by releases .9 and .10.
