#!/bin/sh
# Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
set -eu

# Keep partial downloads between attempts on throttled runners. Dependency
# versions/integrity remain pinned; a failed install never advances the build.
attempt=1
until yarn install --frozen-lockfile --network-concurrency 4 --network-timeout 120000; do
    if [ "$attempt" -ge 3 ]; then
        echo 'Dependency installation failed after three attempts.' >&2
        exit 1
    fi
    printf 'Retrying dependency installation after attempt %s.\n' "$attempt" >&2
    attempt=$((attempt + 1))
    sleep 5
done
