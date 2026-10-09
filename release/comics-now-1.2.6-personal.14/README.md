# Comics Now 1.2.6-personal.14

This release removes duplicate case variants of the publisher field from the right-click metadata dialog. It prefers the canonical `Publisher` key. If ComicInfo only has lowercase `publisher`, the dialog presents it as `Publisher`.

## Publisher data check

Before changing the view model, the deployed database was checked across all 21,980 comic rows. Of the 14,050 rows containing both keys, every capitalized and lowercase value matched; there were no conflicts or lowercase-only records. The display change therefore keeps the correct capitalized value and hides the redundant lowercase duplicate. It does not modify stored metadata.

## Build and deploy

Build the client from the repository root and copy `public/dist` into this release directory. On SynoLiberec, validate and build the image, then deploy the candidate compose file:

```sh
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now -f /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.14/deployment.compose.yml config
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now -f /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.14/deployment.compose.yml build comics-now
cp /volume1/docker/comics-now/docker-compose.yml /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.14.yml
cp /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.14/deployment.compose.yml /volume1/docker/comics-now/docker-compose.yml
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now
```

No database write or migration is part of this release.

## Deployment record

- Deployed on SynoLiberec as `comics-now-personal:1.2.6-personal.14`, image ID `sha256:b4b7cad6af72441728bf1d10fe5db5debdd2bddf160e7f57f39844f285733d4f`.
- The container is running and healthy, and the app returns HTTP 200. The UI reports version `1.2.6-personal.14`.
- The pre-deploy compose copy is `/volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.14.yml` (SHA256 `8c6f66954e792b5a7f37bcc6e5fc5e20ae08d599f832580503b652e664d65d8a`). The active compose file matches this release's `deployment.compose.yml`.
- Live right-click verification for 100 Bullets shows `Publisher: DC Comics` and no lowercase `publisher` row. The user-visible primary publisher also reads DC Comics.

## Rollback

Restore the compose backup and recreate the previous service:

```sh
cp /volume1/docker/comics-now/backups/docker-compose.pre-1.2.6-personal.14.yml /volume1/docker/comics-now/docker-compose.yml
/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now
```
