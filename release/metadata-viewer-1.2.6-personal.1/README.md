# Comics Now 1.2.6-personal.1

This release updates the frontend bundle with the metadata dialog, metadata-field
search controls, and the visible version label. It preserves the live library
exclusion controls and Bédéthèque source option. The existing 1.2.5 container and
its server overlays provide the search API and remain unchanged.

## Build

From the repository root, run:

```sh
npm run build:css && npm run build
```

The version displayed beside the logo is injected from `package.json` at build
time. Increase `package.json` and the root lockfile version before every later
deployment.

## Deployment target

The static bundle is mounted at `/app/public/dist` from
`/volume1/docker/comics-now/releases/comics-now-1.2.6-personal.1/dist`. The
versioned Compose file switches only this mount; it does not replace the running
image or change library data.

## Rollback

The pre-release Compose file is saved at
`/volume1/docker/comics-now/backups/comics-now-1.2.6-personal.1/docker-compose.yml`.
From `/volume1/docker/comics-now`, restore it and recreate the service:

```sh
cp backups/comics-now-1.2.6-personal.1/docker-compose.yml docker-compose.yml
/usr/local/bin/docker compose up -d --no-deps --pull never comics-now
```

The previous `metadata-refresh-20261007/dist` overlay remains in place and can be
reselected by restoring the prior Compose file.
