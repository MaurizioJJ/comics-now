ARG BASE_IMAGE=ghcr.io/comicsnow/comics-now@sha256:699e69e447dd8d94435b3a11b661fa65bee16c4a674f5dcbff5fe312b3477109

FROM ${BASE_IMAGE} AS dependencies
USER root
WORKDIR /tmp/comics-now-dependencies
COPY package.json package-lock.json ./
COPY scripts/check-dependencies.js ./scripts/check-dependencies.js
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev

FROM ${BASE_IMAGE}
USER root
RUN rm -rf /app/node_modules
COPY --from=dependencies --chown=1000:1000 /tmp/comics-now-dependencies/node_modules /app/node_modules
