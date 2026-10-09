# Comics Now 1.2.6-personal.15

This release adds searchable multiselect dropdowns to the per-field search filters. Multiple selected values within one field use OR matching; separate fields combine with AND. The global search term continues to work alongside those filters. Search values are drawn from the loaded library; typing narrows the choices, and selected values remain visible while narrowing.

The backend accepts the existing string filter format for compatibility and also accepts arrays of up to 100 values per field. No database migration or metadata write is included.

## Build and deploy

Build from the repository root with `npm run build:css && npm run build`, then copy `public/dist` and `server/routes/user/library.js` into this release directory. The deployment reuses the already installed `comics-now-personal:1.2.6-personal.14` image and overlays the new frontend and search route.

On SynoLiberec, transfer this release directory, validate its Compose configuration, back up the active Compose file, and apply the candidate:

```sh
scp -O -r release/comics-now-1.2.6-personal.15 synoliberec-lan:/volume1/docker/comics-now/releases/
ssh synoliberec-lan '/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now -f /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.15/deployment.compose.yml config'
ssh synoliberec-lan 'cp /volume1/docker/comics-now/docker-compose.yml /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.15.yml && cp /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.15/deployment.compose.yml /volume1/docker/comics-now/docker-compose.yml && /usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now'
```

## Deployment record

- Deployed October 9, 2026 to SynoLiberec. The container reuses `comics-now-personal:1.2.6-personal.14`; no database writes or migrations were performed.
- The live page returned HTTP 200 and displayed `1.2.6-personal.15`. Its JavaScript and CSS assets returned HTTP 200.
- The live multi-value Publisher search returned HTTP 200 and 3,255 comics for `Bonelli Editore` or `DC Comics`; the results contained those matching publisher values, including the existing `Sergio Bonelli Editore` substring match.
- Docker reports the container running and healthy with zero restarts.
- The pre-deploy Compose backup is `/volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.15.yml` (SHA256 `c1548a681d0466147a7b38f58b9d14c4402e5df8c73f13d5f8805484519b7d81`). The deployed Compose file has SHA256 `f18ecd1dd70de91ff0f4c24876940229bedfb09ca452a39e13bf66602e2cf3e8`.
- Rollback restores the pre-deploy Compose file and recreates the service. No database restore is needed.

## Rollback

Restore the pre-release Compose file and recreate the service:

```sh
ssh synoliberec-lan 'cp /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.15.yml /volume1/docker/comics-now/docker-compose.yml && /usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now'
```
