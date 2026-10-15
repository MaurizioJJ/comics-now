#!/usr/bin/env bash
set -euo pipefail

# Run on the owner's Mac, from a Terminal with working SSH access.
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
release=comics-now-1.2.6-personal.16
nas=synoliberec-lan
root=/volume1/docker/comics-now
stage=$(mktemp -d /tmp/comics-now-deploy.XXXXXX)
chmod 700 "$stage"
cd "$repo"

node --check server/routes/user/library.js
node -e 'if(require("./package.json").version!=="1.2.6-personal.16")process.exit(1)'
# Rebuild so the uploaded frontend exactly matches the current source.
npm test -- --runInBand
npm run build:css
npm run build
mkdir -p "$stage/$release/server/routes/user"
cp -R public/dist "$stage/$release/dist"
cp server/routes/user/library.js "$stage/$release/server/routes/user/library.js"

# Download the active configuration; never guess it from an old release.
ssh "$nas" 'test -r /volume1/docker/comics-now/docker-compose.yml && test ! -e /volume1/docker/comics-now/releases/comics-now-1.2.6-personal.16 && test ! -e /volume1/docker/comics-now/backups/comics-now-1.2.6-personal.16'
scp -O "$nas:$root/docker-compose.yml" "$stage/compose.before.yml"
python3 - "$stage" <<'PY'
from pathlib import Path
import hashlib
import re
import sys

stage = Path(sys.argv[1])
source = (stage / 'compose.before.yml').read_bytes()
text = source.decode()
for destination, relative in [('/app/public/dist', 'dist'), ('/app/server/routes/user/library.js', 'server/routes/user/library.js')]:
    pattern = r'(?m)^([ \t]*-[ \t]+)[^\s\n]+:' + re.escape(destination) + r':ro[ \t]*$'
    replacement = r'\g<1>./releases/comics-now-1.2.6-personal.16/' + relative + ':' + destination + ':ro'
    text, count = re.subn(pattern, replacement, text)
    if count != 1:
        raise SystemExit(f'Refused deployment: expected one read-only mount for {destination}; found {count}')
(stage / 'compose.candidate.yml').write_text(text)
(stage / 'compose.before.sha256').write_text(hashlib.sha256(source).hexdigest())
release = stage / 'comics-now-1.2.6-personal.16'
entries = []
for path in sorted(release.rglob('*')):
    if path.is_file():
        entries.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(release)}')
(release / 'SHA256SUMS').write_text('\n'.join(entries) + '\n')
PY

tar -czf "$stage/$release.tar.gz" -C "$stage" "$release"
ssh "$nas" 'mkdir -p /volume1/docker/comics-now/backups /volume1/docker/comics-now/releases && mkdir /volume1/docker/comics-now/backups/comics-now-1.2.6-personal.16'
scp -O "$stage/$release.tar.gz" "$stage/compose.candidate.yml" "$stage/compose.before.sha256" "$nas:$root/backups/$release/"

ssh "$nas" 'sh -s' <<'REMOTE'
set -eu
root=/volume1/docker/comics-now
release=comics-now-1.2.6-personal.16
backup=$root/backups/$release
compose=$root/docker-compose.yml
candidate=$backup/compose.candidate.yml
activated=0

rollback() {
    echo 'Deployment failed; restoring the previous Compose file.' >&2
    if cp "$backup/docker-compose.before.yml" "$compose" && /usr/local/bin/docker-compose --project-directory "$root" up -d --no-deps --pull never comics-now; then
        echo "Previous deployment restored. Backup: $backup/docker-compose.before.yml" >&2
    else
        echo "Automatic rollback failed. Restore $backup/docker-compose.before.yml manually." >&2
    fi
}
finish() {
    code=$?
    trap - EXIT
    if [ "$code" -ne 0 ] && [ "$activated" -eq 1 ]; then rollback; fi
    exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

command -v curl >/dev/null
current=$(sha256sum "$compose")
current=${current%% *}
expected=$(cat "$backup/compose.before.sha256")
if [ "$current" != "$expected" ]; then
    echo 'Refused deployment: the active Compose file changed after download.' >&2
    exit 1
fi
cp -p "$compose" "$backup/docker-compose.before.yml"
# Back up first; preserve all existing image, data, security and overlay settings.
tar -xzf "$backup/$release.tar.gz" -C "$root/releases"
cd "$root/releases/$release"
sha256sum -c SHA256SUMS
/usr/local/bin/docker-compose --project-directory "$root" -f "$candidate" config -q

activated=1
cp "$candidate" "$compose"
/usr/local/bin/docker-compose --project-directory "$root" up -d --no-deps --pull never comics-now

wait_healthy() {
    attempts=0
    while [ "$attempts" -lt 48 ]; do
        status=$(/usr/local/bin/docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' comics-now)
        if [ "$status" = 'running healthy' ]; then return 0; fi
        echo "Waiting for ComicsNow: $status"
        attempts=$((attempts + 1))
        sleep 5
    done
    echo 'ComicsNow did not become healthy within four minutes.' >&2
    return 1
}
verify_live() {
    curl -fsS --connect-timeout 5 --max-time 30 http://192.168.1.19:3000/ > "$backup/live-home.html"
    grep -Fq 'v1.2.6-personal.16' "$backup/live-home.html"
    grep -Fq 'id="reset-library-filters"' "$backup/live-home.html"
    grep -Fq 'id="search-results-count"' "$backup/live-home.html"
    # Check every built JS/CSS asset is served after the overlay switch.
    for asset in "$root/releases/$release"/dist/assets/*.js "$root/releases/$release"/dist/assets/*.css; do
        [ -f "$asset" ] || continue
        curl -fsS --connect-timeout 5 --max-time 30 -o /dev/null "http://192.168.1.19:3000/assets/$(basename "$asset")"
    done
}
wait_healthy
verify_live
sleep 15
wait_healthy
verify_live
/usr/local/bin/docker inspect --format 'ComicsNow: {{.State.Status}} / {{.State.Health.Status}}, restarts={{.RestartCount}}' comics-now
echo 'Deployed 1.2.6-personal.16; page, reset/count controls and JS/CSS assets verified.'
echo "Rollback Compose: $backup/docker-compose.before.yml"
REMOTE

echo "Open http://192.168.1.19:3000/ and hard-refresh to test the filters."
echo "Local staging files retained at $stage"
