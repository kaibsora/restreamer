#!/bin/sh
# Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
# Download the exact Ubuntu source versions for redistributed runtime packages
# and libraries copied from the FFmpeg builder. Fail rather than publish a
# binary whose corresponding sources could not be retained.
set -eu
mkdir -p /distribution/ubuntu /distribution/licenses
chown _apt /distribution/ubuntu
dpkg-query -W -f '${source:Package}=${source:Version}\n' > /tmp/runtime-sources
cat /tmp/runtime-sources /distribution/builder-library-sources.txt | sort -u > /distribution/ubuntu-packages.txt
sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources
apt-get -o Acquire::Retries=5 update
cd /distribution/ubuntu
xargs -r -a /distribution/ubuntu-packages.txt \
    apt-get -o Acquire::Retries=5 source --download-only --only-source
# Preserve package copyright/license files with their original paths.
find /usr/share/doc -name copyright -type f -exec cp --parents '{}' /distribution/licenses/ \;
cd /distribution
find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
