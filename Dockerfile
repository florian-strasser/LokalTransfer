ARG NODE_VERSION=22.17.0
ARG MYSQL_VERSION=8.4

# --- Build ---------------------------------------------------------------
#
# Pinned to the *build* machine's architecture. The toolchain (Vite, esbuild,
# oxc) then runs natively instead of under QEMU, which is both far faster and
# far more reliable — emulating an amd64 esbuild on an arm64 host faults at
# random. Nuxt's `.output` is portable JavaScript, so the runtime stage below is
# still free to target a different architecture.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS build

WORKDIR /app

# Manifests first, so this layer is reused unless the dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# `--frozen-lockfile` installs exactly what the lockfile pins rather than
# re-resolving, so an image built today matches one built next month.
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# --- Runtime -------------------------------------------------------------
#
# Built on the official MySQL image rather than on Node, so the container can
# carry its own database. That is the wrong way round from most Node images, but
# the database is the part with the exacting requirements: a correct data
# directory, the right defaults, first-run initialisation. Node, by contrast, is
# a self-contained tarball that drops onto any glibc.
#
# MySQL specifically, not MariaDB: the schema uses `utf8mb4_0900_ai_ci`, which
# only MySQL 8 has.
FROM mysql:${MYSQL_VERSION}

ARG NODE_VERSION
ARG TARGETARCH

# Node from the official tarball rather than a distribution package. The version
# is then exactly the one this app was built and tested against, instead of
# whatever the base image's repository happens to carry — and the official builds
# target glibc 2.28, so they run on this base without a matching-distro build.
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) NODE_ARCH=x64 ;; \
      arm64) NODE_ARCH=arm64 ;; \
      *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
      -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
      --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md; \
    rm -f /tmp/node.tar.xz; \
    node --version

WORKDIR /app

COPY --from=build /app/.output ./
COPY docker-entrypoint.sh /usr/local/bin/lokaltransfer-entrypoint.sh
RUN chmod +x /usr/local/bin/lokaltransfer-entrypoint.sh

ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    NUXT_STORAGE_PATH=/app/storage

# Uploads and database files both have to outlive the container. They are
# declared separately because they have different lifetimes in practice: a
# database can be replaced from a dump, uploaded files cannot be reconstructed
# from anything.
RUN mkdir -p /app/storage && chown -R mysql:mysql /app/storage
VOLUME ["/app/storage", "/var/lib/mysql"]

# The container starts as root — the base image needs that to fix ownership on a
# freshly mounted data directory — and the entrypoint drops to the unprivileged
# `mysql` user before starting anything, using the `gosu` the base image already
# ships. That user owns both volumes above.
EXPOSE 3000

# Checks the database too, not just that the process is listening: an instance
# that cannot reach its database can serve neither an upload nor a download, and
# reporting it healthy would keep a broken container in a load balancer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/lokaltransfer-entrypoint.sh"]
CMD ["node", "/app/server/index.mjs"]
