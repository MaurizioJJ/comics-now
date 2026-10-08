# Comics Now 1.2.6-personal.6

Fixes language filters for ComicInfo `LanguageISO` values. Searching the single
Language field with an empty global search now matches ISO 639-1 codes such as
`fr` as well as three-letter codes (`fra`, `fre`) and language names such as
French. The same aliases are used by offline search.

The Compose file preserves the existing deployment overlays and mounts this
release's frontend bundle and library search route.

## Build and verify

Run `npm run build` and `npm test -- --runInBand`, then copy `public/dist` into
this release's `dist` folder. The release folder also contains the matching
library route.

## Rollback

Restore the previous Compose file and release snapshot, then recreate the
`comics-now` service with `docker-compose up -d --no-deps --pull never
comics-now` from `/volume1/docker/comics-now`.
