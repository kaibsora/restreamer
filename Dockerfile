# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine3.22
ARG GOLANG_IMAGE=golang:1.26-alpine3.23
ARG FFMPEG_IMAGE=ghcr.io/kaibsora/restreamer:ffmpeg-hardware-latest
ARG YARN_VERSION=1.22.22
ARG RUN_TESTS=true

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS ui-builder
ARG YARN_VERSION
ARG RUN_TESTS
ENV NODE_OPTIONS=--max-old-space-size=1024
WORKDIR /src/ui
COPY components/ui/package.json components/ui/yarn.lock components/ui/.yarnrc.yml ./
COPY components/ui/scripts/install-ci.sh ./scripts/install-ci.sh
RUN corepack enable && \
    corepack prepare yarn@${YARN_VERSION} --activate && \
    sh scripts/install-ci.sh
COPY components/ui/ ./
RUN case "${RUN_TESTS}" in \
      true) yarn test-ci ;; \
      false) ;; \
      *) echo "RUN_TESTS must be true or false, got ${RUN_TESTS}" >&2; exit 64 ;; \
    esac && \
    yarn build && node scripts/collect-licenses.cjs

FROM --platform=$BUILDPLATFORM ${GOLANG_IMAGE} AS core-builder
ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
ARG RUN_TESTS
ARG CORE_RUN_TESTS=${RUN_TESTS}
ARG GO_BUILD_PARALLELISM=2
ENV GOOS=${TARGETOS} GOARCH=${TARGETARCH} GOARM=${TARGETVARIANT} \
    GOFLAGS="-p=${GO_BUILD_PARALLELISM}" GOMAXPROCS=${GO_BUILD_PARALLELISM} GOMEMLIMIT=768MiB
WORKDIR /src/core
RUN apk add --no-cache git make
COPY components/core/ ./
RUN rm -rf core import ffmigrate && \
    case "${CORE_RUN_TESTS}" in \
      true) go test ./... && go vet ./... ;; \
      false) ;; \
      *) echo "CORE_RUN_TESTS must be true or false, got ${CORE_RUN_TESTS}" >&2; exit 64 ;; \
    esac
# Keep the tested source/compiler layer reusable when only build identity or UI
# changes. The release binary below still embeds this exact commit and branch.
ARG RESTREAMER_COMMIT=unknown
ARG RESTREAMER_BRANCH=local
ARG RESTREAMER_BUILD_DATE=1970-01-01T00:00:00Z
RUN make release \
      COMMIT="${RESTREAMER_COMMIT}" \
      BRANCH="${RESTREAMER_BRANCH}" \
      BUILD="${RESTREAMER_BUILD_DATE}" && \
    make import && \
    make ffmigrate && \
    find vendor -type f \( -iname '*license*' -o -iname '*notice*' -o -iname 'copying*' \) \
      -exec sh -c 'for file; do mkdir -p "/licenses/$(dirname "$file")"; cp "$file" "/licenses/$file"; done' sh {} +

FROM ${FFMPEG_IMAGE}

ARG RESTREAMER_COMMIT=unknown
ARG RESTREAMER_BRANCH=local
ARG RESTREAMER_BUILD_DATE=1970-01-01T00:00:00Z

# Modified for CQComber Restreamer: fork branding and bundled component attribution.
LABEL org.opencontainers.image.title="CQComber Restreamer" \
      org.opencontainers.image.description="Independent adaptation of datarhei Restreamer with unified hardware-accelerated FFmpeg" \
      org.opencontainers.image.source="https://github.com/kaibsora/restreamer" \
      org.opencontainers.image.documentation="https://github.com/kaibsora/restreamer#readme" \
      org.opencontainers.image.licenses="Apache-2.0 AND GPL-3.0-or-later" \
      org.opencontainers.image.version="${RESTREAMER_COMMIT}" \
      org.opencontainers.image.revision="${RESTREAMER_COMMIT}" \
      org.opencontainers.image.created="${RESTREAMER_BUILD_DATE}" \
      io.restreamer.repository.branch="${RESTREAMER_BRANCH}"

COPY --from=core-builder /src/core/core /core/bin/core
COPY --from=core-builder /src/core/import /core/bin/import
COPY --from=core-builder /src/core/ffmigrate /core/bin/ffmigrate
COPY --from=core-builder /src/core/mime.types /core/mime.types
COPY --from=ui-builder /src/ui/build /core/ui
COPY run.sh /core/bin/run.sh
COPY ui-root /core/ui-root
COPY LICENSE NOTICE THIRD_PARTY.md MODIFICATIONS.md /usr/share/doc/cqcomber-restreamer/
COPY components/ffmpeg/README.md /usr/share/doc/cqcomber-restreamer/ffmpeg-build-README.md
COPY --from=core-builder /licenses /usr/share/doc/cqcomber-restreamer/core-dependencies
COPY --from=ui-builder /src/ui/licenses /usr/share/doc/cqcomber-restreamer/ui-dependencies
COPY scripts/hardware-report.sh /usr/local/bin/restreamer-hardware-report
COPY scripts/healthcheck.sh /usr/local/bin/restreamer-healthcheck
COPY scripts/verify-hevc-hls.sh /usr/local/bin/restreamer-verify-hevc-hls

# Pin the archive reader to liblzma's installed version: its corresponding source
# is already retained in the runtime's Ubuntu xz-utils source package.
RUN apt-get -o Acquire::Retries=5 -o Acquire::https::Timeout=30 update && \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      "xz-utils=$(dpkg-query -W -f '${Version}' liblzma5)" && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /core/config /core/data && \
    chmod +x /core/bin/run.sh \
      /usr/local/bin/restreamer-hardware-report \
      /usr/local/bin/restreamer-healthcheck \
      /usr/local/bin/restreamer-verify-hevc-hls && \
    /usr/local/bin/restreamer-verify-hevc-hls && \
    ffmpeg -hide_banner -buildconf

ENV CORE_CONFIGFILE=/core/config/config.json \
    CORE_DB_DIR=/core/config \
    CORE_ROUTER_UI_PATH=/core/ui \
    CORE_STORAGE_DISK_DIR=/core/data

EXPOSE 8080/tcp 8181/tcp 1935/tcp 1936/tcp 6000/udp
VOLUME ["/core/data", "/core/config"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 CMD ["/usr/local/bin/restreamer-healthcheck"]
ENTRYPOINT ["/core/bin/run.sh"]
WORKDIR /core
