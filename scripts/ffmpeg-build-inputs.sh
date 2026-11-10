#!/usr/bin/env bash
set -euo pipefail

# Git object IDs remain stable across checkout paths and line-ending settings.
# Include the resolver and this script as well as the complete Docker context.
git ls-tree HEAD -- components/ffmpeg scripts/resolve-ffmpeg-version.sh scripts/ffmpeg-build-inputs.sh \
    | sha256sum | cut -c1-16
