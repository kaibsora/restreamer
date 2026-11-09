# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine3.22
ARG GOLANG_IMAGE=golang:1.26-alpine3.23
ARG FFMPEG_IMAGE=ghcr.io/kaibsora/restreamer:ffmpeg-hardware-latest
ARG YARN_VERSION=1.22.22
ARG RUN_TESTS=true

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS ui-builder
ARG YARN_VERSION
ARG RUN_TESTS
WORKDIR /src/ui
COPY components/ui/package.json components/ui/yarn.lock components/ui/.yarnrc.yml ./
RUN corepack enable && \
    corepack prepare yarn@${YARN_VERSION} --activate && \
    yarn install --frozen-lockfile
COPY components/ui/ ./
RUN case "${RUN_TESTS}" in \
      true) yarn test-ci ;; \
      false) ;; \
      *) echo "RUN_TESTS must be true or false, got ${RUN_TESTS}" >&2; exit 64 ;; \
    esac && \
    yarn build

FROM --platform=$BUILDPLATFORM ${GOLANG_IMAGE} AS core-builder
ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
ARG RUN_TESTS
ARG RESTREAMER_COMMIT=unknown
ARG RESTREAMER_BRANCH=local
ARG RESTREAMER_BUILD_DATE=1970-01-01T00:00:00Z
ENV GOOS=${TARGETOS} GOARCH=${TARGETARCH} GOARM=${TARGETVARIANT}
WORKDIR /src/core
RUN apk add --no-cache git make
COPY components/core/ ./
RUN rm -rf core import ffmigrate && \
    case "${RUN_TESTS}" in \
      true) go test ./... && go vet ./... ;; \
      false) ;; \
      *) echo "RUN_TESTS must be true or false, got ${RUN_TESTS}" >&2; exit 64 ;; \
    esac && \
    make release \
      COMMIT="${RESTREAMER_COMMIT}" \
      BRANCH="${RESTREAMER_BRANCH}" \
      BUILD="${RESTREAMER_BUILD_DATE}" && \
    make import && \
    make ffmigrate

FROM ${FFMPEG_IMAGE}

ARG RESTREAMER_COMMIT=unknown
ARG RESTREAMER_BRANCH=local
ARG RESTREAMER_BUILD_DATE=1970-01-01T00:00:00Z

LABEL org.opencontainers.image.title="Restreamer" \
      org.opencontainers.image.description="Unified Restreamer application with hardware-accelerated FFmpeg" \
      org.opencontainers.image.source="https://github.com/kaibsora/restreamer" \
      org.opencontainers.image.documentation="https://github.com/kaibsora/restreamer#readme" \
      org.opencontainers.image.licenses="Apache-2.0" \
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
COPY scripts/hardware-report.sh /usr/local/bin/restreamer-hardware-report
COPY scripts/healthcheck.sh /usr/local/bin/restreamer-healthcheck

RUN mkdir -p /core/config /core/data && \
    chmod +x /core/bin/run.sh \
      /usr/local/bin/restreamer-hardware-report \
      /usr/local/bin/restreamer-healthcheck && \
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
