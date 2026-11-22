# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
ARG RUST_IMAGE=rust:1.100.0-bookworm

FROM ${RUST_IMAGE} AS native-build
WORKDIR /src/native-core
COPY native-core/Cargo.toml native-core/Cargo.lock ./
COPY native-core/src ./src
RUN cargo build --release --locked

FROM ${NODE_IMAGE} AS javascript-build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
WORKDIR /app/desktop-shell
COPY desktop-shell/package.json desktop-shell/package-lock.json desktop-shell/tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY desktop-shell/src ./src
COPY headless-runtime/tsconfig.json /app/headless-runtime/tsconfig.json
RUN node node_modules/typescript/bin/tsc -p /app/headless-runtime/tsconfig.json

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app/desktop-shell
COPY desktop-shell/package.json desktop-shell/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    DAFTAR_REPO_ROOT=/app \
    DAFTAR_DATA_DIR=/var/lib/daftar \
    DAFTAR_CORE_BINARY=/app/native-core/target/release/atlas-core \
    DAFTAR_HOST=127.0.0.1 \
    DAFTAR_PORT=8788 \
    DAFTAR_CONTROL_TOKEN_FILE=/run/secrets/control-token
WORKDIR /app
RUN groupadd --gid 10001 daftar \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /var/lib/daftar --shell /usr/sbin/nologin daftar \
    && install -d -o 10001 -g 10001 -m 0700 /var/lib/daftar
COPY --from=native-build /src/native-core/target/release/atlas-core /app/native-core/target/release/atlas-core
COPY --from=javascript-build /app/desktop-shell/dist /app/desktop-shell/dist
COPY --from=production-dependencies /app/desktop-shell/node_modules /app/desktop-shell/node_modules
COPY desktop-shell/package.json desktop-shell/package-lock.json /app/desktop-shell/
COPY desktop-shell/models.catalog.json /app/desktop-shell/models.catalog.json
COPY company /app/company
COPY headless-runtime/*.mjs /app/headless-runtime/
COPY tools/atlas-mcp.mjs tools/daftar-runtime-mcp.mjs /app/tools/
COPY deploy/healthcheck.mjs /app/deploy/healthcheck.mjs
COPY deploy/runtime-request.mjs /app/deploy/runtime-request.mjs
USER 10001:10001
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "/app/deploy/healthcheck.mjs"]
CMD ["node", "/app/headless-runtime/server.mjs"]
