# Comics Now 1.2.6-personal.12

Folder-mode search now groups matches by their containing directory, hides the
regular folder and smart-list views while search is active, and shows a spinner
while the query is running.

## Production deployment

Deployed on October 8, 2026 to SynoLiberec at `http://192.168.1.19:3000/`.
The live container reported healthy and served the `.12` page with HTTP 200.

## Validation

- `npm test -- --runInBand`: 75 suites and 573 tests passed.
- `npm run build`: passed with the existing Vite config-loader and JSZip warnings.
- `git diff --check`: passed.
- The browser loaded the live French search with 6,632 results; a final visual
  check of folder cards could not be completed because browser inspection
  disconnected.

## Rollback

Restore the pre-deployment `docker-compose.yml`, which mounts
`releases/comics-now-1.2.6-personal.11/dist` at `/app/public/dist`, then run
`/usr/local/bin/docker-compose --project-directory /volume1/docker/comics-now up -d --no-deps --pull never comics-now`.
