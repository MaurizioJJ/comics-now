# Comics Now 1.2.6-personal.8

Language filters now read `LanguageISO` from the archive when a Folder Mode row
does not contain that field in the database. French matches `fr`, `fra`, and
`fre` values and French language names. Archive reads run with bounded
concurrency, are cached by comic path and file modification time, and happen
only after the current user’s comic access has been checked. Search does not
write to the comic archive or database.

The release retains the previous deployment overlays and upstream image pin.
It mounts this release's frontend bundle and library route.

## Verify

Run `npm run build` and `npm test -- --runInBand`.

## Rollback

Restore `/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.8/docker-compose.before.yml`
and recreate the service. Language search does not modify indexed data.
