ARG BASE_IMAGE=ghcr.io/comicsnow/comics-now@sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109

FROM ${BASE_IMAGE} AS dependencies
USER root
WORKDIR /tmp/comics-now-dependencies
COPY package.json package-lock.json ./
COPY scripts/check-dependencies.js ./scripts/check-dependencies.js
RUN npm ci --omit=dev --ignore-scripts \
    && mkdir -p node_modules/better-sqlite3/build/Release \
    && cp /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node node_modules/better-sqlite3/build/Release/
RUN node -e 'const Database = require("better-sqlite3"); const db = new Database(":memory:"); if (db.prepare("SELECT 1 AS value").get().value !== 1) process.exit(1); db.close(); require("sharp"); require("onnxruntime-node"); console.log("Production native modules load successfully.")'

FROM ${BASE_IMAGE}
USER root
RUN rm -rf /app/node_modules
COPY --from=dependencies --chown=1000:1000 /tmp/comics-now-dependencies/node_modules /app/node_modules
COPY package.json package-lock.json /app/
