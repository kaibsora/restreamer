# Components, credit and source availability

CQComber Restreamer is an independent adaptation, maintained by CQComber
(GitHub account **kaibsora**). It is based on the work of **datarhei / FOSS GmbH**
and their contributors. Rebranding does not replace their authorship or copyright.
There is no implied endorsement by any upstream project.

| Component | Version / source policy | Original source | License |
| --- | --- | --- | --- |
| Application integration | This repository's exact image revision | [datarhei/restreamer](https://github.com/datarhei/restreamer) | Apache-2.0 |
| Administration UI | Fork of UI 1.14.0; dependencies locked in `components/ui/yarn.lock` | [datarhei/restreamer-ui](https://github.com/datarhei/restreamer-ui) | Apache-2.0 |
| Core process manager / API / media server | Fork of Core 16.16.0; modules vendored in `components/core/vendor` | [datarhei/core](https://github.com/datarhei/core) | Apache-2.0 |
| FFmpeg packaging and progress/HLS patches | Forked build integration, exact source selected by CI | [datarhei/ffmpeg](https://github.com/datarhei/ffmpeg) | Upstream README declares LGPL with optional GPL components; patched FFmpeg uses GPL-3.0-or-later here |
| FFmpeg / FFprobe | Current upstream Git revision resolved to an immutable SHA for every build | [FFmpeg/FFmpeg](https://github.com/FFmpeg/FFmpeg) | GPL-3.0-or-later for this configuration (`--enable-gpl --enable-version3`) |
| NVIDIA codec headers | 12.2.72.0 | [FFmpeg/nv-codec-headers](https://github.com/FFmpeg/nv-codec-headers) | MIT |
| Vulkan headers | 1.4.362 | [KhronosGroup/Vulkan-Headers](https://github.com/KhronosGroup/Vulkan-Headers) | Apache-2.0 / MIT as specified by each file |
| MediaMTX LAN relay | 1.21.3, separate optional Compose service | [bluenviron/mediamtx](https://github.com/bluenviron/mediamtx) | MIT |
| React / React DOM | 18.3.1-compatible, exact versions in lockfile | [facebook/react](https://github.com/facebook/react) | MIT |
| Material UI | 6.x-compatible, exact versions in lockfile | [mui/material-ui](https://github.com/mui/material-ui) | MIT |
| Video.js | 8.24.1 | [videojs/video.js](https://github.com/videojs/video.js) | Apache-2.0 |
| Lingui | 6.x-compatible, exact versions in lockfile | [lingui/js-lingui](https://github.com/lingui/js-lingui) | MIT |
| Fonts and icons | Dosis, Roboto, Font Awesome; package licenses retained | Respective packages in UI lockfile | See bundled font/icon notices; licenses vary by asset |
| Ubuntu runtime and codec/driver libraries | Ubuntu 24.04, exact package source versions retained per build | [Ubuntu source archive](https://archive.ubuntu.com/ubuntu/) and original package authors | Per-package licenses, including GPL, LGPL, BSD and MIT |

The last row includes x264, x265, libvpx, libaom, dav1d, rav1e, LAME, Opus,
Vorbis/Ogg, SRT, OpenSSL, libcurl, libxml2, FreeType, HarfBuzz, ALSA, V4L2,
libdrm, libva, oneVPL, Intel media drivers, Mesa and Vulkan loader libraries.
The exact package inventory and notices are authoritative for a particular image;
the table is an overview, not a replacement for dependency licenses.

The ARM64 Raspberry Pi variant omits the NVIDIA codec/Vulkan header bundles,
CUDA libraries, libva/oneVPL/Intel media drivers and Mesa/Vulkan desktop stacks.
It retains Linux V4L2/DRM and software codec dependencies. Each architecture's
image label points to its own matching corresponding-source container.

Node and Go toolchains, GCC, CUDA development tools, Vite and other build tools
are build-stage dependencies. Their presence in the build does not imply their
entire toolchains are shipped in the application image. NVIDIA's host driver and
Container Toolkit are provided by the deployment host.

## Notices inside the image

- `/usr/share/doc/cqcomber-restreamer/`: project LICENSE, NOTICE, modification
  overview, this document and preserved Go/JavaScript dependency notices.
- `/usr/share/doc/ffmpeg/`: FFmpeg license texts, exact patched source archive,
  build configuration/log, original patches and dependency copyright files.
- `/usr/share/doc/ffmpeg/SOURCES.txt`: immutable public source-container reference.
- `/usr/share/doc/ffmpeg/source-SHA256SUMS`: checksums for the corresponding
  source container, including Ubuntu source packages.

JavaScript package metadata identifies nested dependencies and their repositories.
Go module versions are also recorded in `components/core/vendor/modules.txt` and
`components/core/go.mod`. GitHub Actions publishes image provenance and an SBOM.
Existing upstream license/NOTICE files are retained in the source tree.

## Obtain the exact corresponding source

Application/UI/Core source and scripts are in this repository at the image's
`org.opencontainers.image.revision` commit. For FFmpeg and redistributed Ubuntu
runtime/library sources, use the immutable source image recorded in the binary:

```sh
IMAGE=ghcr.io/kaibsora/restreamer:latest
docker pull "$IMAGE"
SOURCES=$(docker image inspect "$IMAGE" --format '{{index .Config.Labels "io.cqcomber.ffmpeg.sources"}}')
docker pull "$SOURCES"
ID=$(docker create "$SOURCES" /bin/true)
mkdir -p corresponding-source
docker cp "$ID:/sources/." ./corresponding-source/
docker rm "$ID"
(cd corresponding-source && sha256sum -c SHA256SUMS)
```

The source image is a data container: do not try to run it. It contains the exact
patched FFmpeg tree, header sources, patches, build recipe/configuration, Ubuntu
source archives with their `.dsc` metadata and package license files. It is
published to the same public GHCR package before the binary image; no additional
purchase or source-access account is required. For reproducible binary identity,
retain the binary digest, application revision and source-image digest together.
Ubuntu dependency revisions can change on a subsequent rebuild of the same FFmpeg
commit; each binary therefore records its source container **by digest**.

For the separately distributed MediaMTX image, consult its linked upstream source
and MIT license. Full source is available at its corresponding version tag.

## License boundaries

The Restreamer-derived application source remains Apache-2.0. The bundled FFmpeg
executable uses GPL components and is GPL-3.0-or-later; its license is not replaced
by the application's Apache license. Other dependencies retain their own terms.
No claim is made that the entire container has one license. See [LICENSE](LICENSE),
[NOTICE](NOTICE), [MODIFICATIONS.md](MODIFICATIONS.md), component licenses and the
[FFmpeg licensing documentation](https://ffmpeg.org/legal.html).
