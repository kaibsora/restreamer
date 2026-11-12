# Changelog

## 1.0.0

First stable CQComber Restreamer release, an independent adaptation of datarhei
Restreamer, Core, UI and FFmpeg packaging.

- Unified native AMD64/ARM64 application images with architecture-specific
  FFmpeg runtimes, matching source packages, provenance and SBOMs.
- Intel VA-API/Quick Sync, AMD VA-API/Vulkan and NVIDIA NVENC build support;
  ARM CPU and V4L2 M2M support. Physical validation limits are listed in the README.
- Multiple USB/IP/virtual sources, driver-reported capture modes and controls,
  encoded rotation, integrated USB hot-plug and MediaMTX LAN relay integration.
- HLS playback fixes for long camera GOPs, retained initialization segments and
  current FFmpeg APIs; RTSP/RTMP video delivery validation.
- CQComber default source descriptions and player-site branding, with original
  upstream attribution and licenses preserved.
- Camera discovery excludes metadata/output nodes, codecs and unsupported ISP
  processing queues while retaining standalone capture devices and codec access.
- Stable semantic-version image tags, immutable fixed releases and explicit
  promotion of a validated digest to the major/minor/`latest` aliases.

See the [deployment guide](README.md), [component inventory](THIRD_PARTY.md) and
[physical validation evidence](docs/physical-validation.md) for details and limits.

---

# Restreamer

## Unreleased

- Keep every input source available with current and future FFmpeg majors. The
  inherited compatibility declarations stopped at FFmpeg 6 even though this fork
  intentionally tracks FFmpeg master.
- Embed the exact unified-repository commit, branch, and build timestamp in Core's
  existing `/api` version response, and verify that identity in the image smoke test.
- Build Core executables from clean output paths and assert their file type and
  execute bits before starting the Compose smoke stack.
- Resolve the immutable FFmpeg source concurrently with quality checks; image and
  FFmpeg publication remain gated on every quality lane, without deferring creation
  of the source-resolution job behind the matrix.
- Fail hardware acceptance early with daemon-side ARC/DinD GPU preflight evidence
  and document the device/runtime wiring required by dedicated GPU runner scale sets.

### Deployment and FFmpeg

-   Add an on-demand ARC hardware-acceptance workflow that records the immutable
    unified-image digest and performs a real NVENC, VA-API, Quick Sync, or Vulkan
    encode on a GPU-backed runner, retaining the evidence as a workflow artifact.
-   Move the release and hardware workflows to the current Node 24 generations of
    GitHub Checkout, Artifact, and Docker actions instead of relying on the runner's
    compatibility shim for deprecated Node 20 actions.
-   Track FFmpeg's development branch by immutable commit for default local and
    scheduled builds, while retaining `stable`, exact-release, and exact-commit
    inputs for rollback and reproducibility.
-   Rebase the Restreamer JSON statistics patch onto current FFmpeg development
    sources and compile-test it together with the HLS patch before enabling the
    development-branch policy.

### Core

-   Remove the legacy datarhei update checker and its periodic instance telemetry.
    The deprecated `update_check`/`CORE_UPDATE_CHECK` setting remains readable for
    configuration compatibility but no longer causes outbound requests
    ([#869](https://github.com/datarhei/restreamer/issues/869)).
-   Make Swagger UI automatically add the required `Bearer` scheme when a raw JWT
    is pasted into API authorization, while preserving explicitly supplied schemes
    ([#851](https://github.com/datarhei/restreamer/issues/851)).
-   Resolve viewer and HTTP session addresses through trusted private reverse-proxy
    hops, preserving real-client ignore-list behavior without trusting forged public
    `X-Forwarded-For` headers
    ([#856](https://github.com/datarhei/restreamer/issues/856)).
-   Discover container-mapped `/dev/videoN` devices even when `v4l2-ctl` cannot
    describe them, addressing USB capture-device discovery failures
    ([#890](https://github.com/datarhei/restreamer/issues/890)).
-   Document and integration-test API control of individual ingest and publication
    processes, addressing multi-camera resource-control questions
    ([#907](https://github.com/datarhei/restreamer/issues/907),
    [#930](https://github.com/datarhei/restreamer/issues/930)).
-   Integration-test managed HLS snapshot generation, JPEG validity, public
    `/memfs` retrieval, and cleanup to prevent thumbnail regressions
    ([#950](https://github.com/datarhei/restreamer/issues/950)).

### UI

-   Route documentation, issue-reporting, requirements, logo, and repository links
    to the maintained fork while preserving explicit attribution and links to the
    original datarhei Restreamer and Core projects. Label the optional datarhei
    service as a legacy third-party integration instead of presenting it as the
    fork's own infrastructure.
-   Remove the browser-side datarhei update request and the misleading update and
    anonymous-metrics controls. Fork updates are published as immutable GHCR image
    tags until this project establishes its own release-version contract.
-   Keep the live player mounted when a transient Core state poll fails, avoiding
    setup-screen flashes and playback/audio resets, and serialize the one-second
    state poll to prevent out-of-order updates
    ([#863](https://github.com/datarhei/restreamer/issues/863)).
-   Add selected-channel JSON export and import with validation, collision-free ID
    remapping, binary-safe logo and poster migration, safe process startup, and
    rollback on partial imports
    ([#955](https://github.com/datarhei/restreamer/issues/955)).
-   Create and AAC-encode a real `anullsrc` input when the setup wizard selects
    silence for a camera without audio, instead of mapping the video stream twice
    ([#938](https://github.com/datarhei/restreamer/issues/938),
    [#954](https://github.com/datarhei/restreamer/issues/954)).
-   Normalize YouTube audio timestamps by forcing AAC re-encoding at 128 kbit/s,
    preventing the distortion and stuttering reported with long-running AAC
    passthrough streams
    ([#648](https://github.com/datarhei/restreamer/issues/648),
    [#728](https://github.com/datarhei/restreamer/issues/728)).
-   Show configurable, clickable LAN RTSP and WebRTC client URLs in the MediaMTX
    publication preset.
-   Add a dedicated MediaMTX LAN relay publication with safe channel-derived paths,
    H.264 compatibility, and low-latency RTSP defaults for printer dashboards.
-   Expose the compiled AV1 VA-API, NVENC, Quick Sync, and Vulkan encoders in the
    UI, along with HEVC NVENC and VP9 Quick Sync. Supported Intel and AMD systems
    can now select AV1 VA-API directly
    ([#945](https://github.com/datarhei/restreamer/issues/945)).
-   Allow H.264, HEVC, and VP9 VA-API profiles to select their DRM render node,
    and use one-second GOP, zero B-frame, and modern frame-rate defaults for
    low-latency Intel/AMD encoding
    ([#657](https://github.com/datarhei/restreamer/issues/657),
    [#943](https://github.com/datarhei/restreamer/issues/943)).
-   Restore player logo overlays by synchronizing the vendored overlay plugin with
    Video.js 8 and correct image load handling
    ([#912](https://github.com/datarhei/restreamer/issues/912)).
-   Stop combining output `-r` with non-CFR frame-rate modes, allowing V4L2 and
    other camera sources to use passthrough or variable frame timing
    ([#943](https://github.com/datarhei/restreamer/issues/943)).
-   Preserve the complete RTMP application name when normalizing leading and
    trailing slashes ([#825](https://github.com/datarhei/restreamer/issues/825)).

### Deployment

-   Add a built-in Docker health check for the unauthenticated Core `/ping`
    endpoint and validate it in the unified camera-stack smoke test.
-   Document root-host reverse proxying, HTTPS redirects, large uploads, and
    correct origin forwarding for NGINX, Caddy, and IIS
    ([#957](https://github.com/datarhei/restreamer/issues/957),
    [#981](https://github.com/datarhei/restreamer/issues/981)).
-   Allow deployment acceptance to require specific NVENC, VA-API, Quick Sync,
    or Vulkan backends so one working GPU cannot mask a missing target runtime.
-   Allow multi-GPU deployments to target explicit VA-API and Quick Sync DRM
    render nodes during active hardware acceptance.
-   Validate the MediaMTX WHEP discovery endpoint used by Mainsail for every
    named printer relay instead of accepting an HTML player page alone.
-   Exercise a real SRT publisher, Core SRT ingest, managed FFmpeg process, and
    MediaMTX RTSP/WHEP relay in the sub-second camera-stack gate
    ([#942](https://github.com/datarhei/restreamer/issues/942)).

## 2.12.0

### UI v1.13.0 > v1.14.0

-   Add wettercom service
-   Add option to select which channels will be displayed on the playersite ([#392](https://github.com/datarhei/restreamer/issues/392), [#800](https://github.com/datarhei/restreamer/issues/800))
-   Mod updates public videojs >v8
-   Fix erroneous filter setting
-   Fix encoded address
-   Fix double -filter parameter when encoder sets filter ([#787](https://github.com/datarhei/restreamer/issues/787))
-   Fix Docker build ([#64](https://github.com/datarhei/restreamer-ui/issues/64))

### 🧡💚💜 Thank you to all Patrons and donors

-   Michael Shepherd
-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.11.0

### UI v1.12.0 > v1.13.0

-   Add to allow stream hints in case probing fails
-   Mod enables ff-loglevel and prepares the logging component
-   Mod uses official Instagram-RTMP target
-   Mod Remove unused imports
-   Mod Update translations
-   Mod updates dependencies
-   Fix player position

### Core v16.15.0 > v16.16.0

-   Add ConnectionIdleTimeout to RTMP server
-   Add WithLevel() to Logger interface
-   Fix datarhei/restreamer#759
-   Fix various RTMP bugs
-   Fix wrong log output when receiving a RTMP stream
-   Fix skipping session handling if collectors are nil
-   Update dependencies

### 🧡💚💜 Thank you to all Patrons and donors

-   Michael Shepherd
-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.10.0

### UI v1.11.0 > v1.12.0

-   Add option to select different SRT stream in wizard
-   Add option to select different RTMP stream in wizard
-   Fix selecting other than first audio stream ([#710](https://github.com/datarhei/restreamer/issues/710))
-   Fix reset of previous audio settings when editing profile ([#730](https://github.com/datarhei/restreamer/issues/730))
-   Fix RTMP URL for receive mode

### 🧡💚💜 Thank you to all Patrons and donors

-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.9.0

### UI v1.10.0 > v1.11.0

-   Add allow to stream HEVC and AV1 to Youtube via RTMP
-   Add librav1e AV1 encoder
-   Add support for AV1 CUDA decoding ([PR 46](https://github.com/datarhei/restreamer-ui/pull/46))
-   Add FFmpeg 6 support
-   Add HEVC VideoToolbox encoder
-   Fix anonymize error message ([#688](https://github.com/datarhei/restreamer/issues/688))
-   Fix chromecast config ([#37](https://github.com/datarhei/restreamer-ui/issues/37))

### Core v16.14.0 > v16.15.0

-   Add migrating to ffmpeg 6
-   Fix missing process data if process has been deleted meanwhile
-   Fix maintaining the metadata on process config update (datarhei/restreamer#698)
-   Fix placeholder parsing
-   Fix concurrent memfs accesses
-   Fix memfs concurrent read and write performance

### 🧡💚💜 Thank you to all Patrons and donors

-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.8.0

### UI v1.9.0 > v1.10.0

-   Add resource usage and ffmpeg command to process details
-   Add audio loop source
-   Add to allow to select from already publishing RTMP and SRT streams
-   Fix wrongly displayed SRT URL ([#635](https://github.com/datarhei/restreamer/issues/635))
-   Fix RTMPS address with custom ports ([#658](https://github.com/datarhei/restreamer/issues/658))
-   Fix allow RTSPS protocol ([#677](https://github.com/datarhei/restreamer/issues/677))

### Core v16.13.1 > v16.14.0

-   Add support for SRTv4 clients
-   Add support for Enhanced RTMP in internal RTMP server
-   Fix require positive persist interval (session)
-   Fix race condition (process)
-   Update dependencies

### 🧡💚💜 Thank you to all Patrons and donors

-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.7.0

### UI v1.8.0 > v1.9.0

-   Add enlarged channel overview
-   Add new publication services: Dailymotion, Livepush, kick.com, NimoTV, PicartoTV, Rumble
-   Add frame interpolation (framerate) filter (thanks to orryverducci)
-   Add -referer option for pulling HTTP streams ([PR 40](https://github.com/datarhei/restreamer-ui/pull/40), thanks to mdastgheib)
-   Add a/v filter to the publication components ([#593](https://github.com/datarhei/restreamer-ui/issues/593))
-   Add video or image loop as input ([#528](https://github.com/datarhei/restreamer/discussions/528))
-   Add option for custom poster image in player ([#632](https://github.com/datarhei/restreamer/issues/632))
-   Add option to allow to set limits for ingest and egress processes ([#636](https://github.com/datarhei/restreamer/issues/636))
-   Mod extends twitch's server list
-   Mod uses placeholders for ingress setups ([#560](https://github.com/datarhei/restreamer-ui/issues/560))
-   Mod updates npm
-   Fix Owncast typo
-   Fix Restream grid
-   Fix the advanced settings in the MPEG-TS publication service ([#597](https://github.com/datarhei/restreamer/issues/597), thanks to orryverducci)
-   Fix ALSA demuxer option names
-   Fix index out-of-range warning, list ALSA devices for Raspicam video source
-   Fix MUI warning
-   Fix videojs skin

### Core v16.13.0 > v16.13.1

-   Fix transfer of reports to updated process
-   Fix calling Wait after process has been read
-   Fix 509 return code if non-existing stream is requested
-   Fix default search paths for config file
-   Fix sized filesystem
-   Update dependencies

### Thank you to all Patrons and donors

-   Jacob Fritsche
-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.6.0

## v1.7.0 > v1.8.0

-   Add Ukrainian translation (thanks to Yurii Denys)
-   Add Add stream key field and protocol detection to RTMP publication service
-   Add Chinese (simplified) translation (thanks to Huyg0180110559)
-   Fix empty force_key_frames value
-   Fix Icecast publication service
-   Fix imprint, terms and credit without share ([#525](https://github.com/datarhei/restreamer/issues/529))
-   Fix proxy error on the playersite ([#525](https://github.com/datarhei/restreamer/issues/525))
-   Fix saving RTMP advanced options ([#518](https://github.com/datarhei/restreamer/issues/518))
-   Fix help buttons for other languages than English and German ([#24](https://github.com/datarhei/restreamer-ui/issues/24))
-   Fix internal player skin (volume bar)
-   Fix security hints (npm dep.)

### Core v16.12.0 > v16.13.0

-   Add updated_at field in process infos
-   Add preserve process log history when updating a process
-   Add support for input framerate data from jsonstats patch
-   Add number of keyframes and extradata size to process progress data
-   Mod bumps FFmpeg to v5.1.3 (datarhei/core:tag bundles)
-   Fix better naming for storage endpoint documentation
-   Fix freeing up S3 mounts
-   Fix URL validation if the path contains FFmpeg specific placeholders
-   Fix purging default file from HTTP cache
-   Fix parsing S3 storage definition from environment variable
-   Fix checking length of CPU time array ([#10](https://github.com/datarhei/core/issues/10))
-   Fix possible infinite loop with HLS session rewriter
-   Fix not propagating process limits
-   Fix URL validation if the path contains FFmpeg specific placeholders
-   Fix RTMP DoS attack (thx Johannes Frank)
-   Deprecate ENV names that do not correspond to JSON name

### FFmpeg v5.1.2 > v5.1.3

-   Add alsa support by default
-   Add min, max, avg of incoming framerates for each input and output (jsonstats patch)
-   Add keyframe count for each input and output (jsonstats patch)
-   Add size in bytes for each input and output (jsonstats patch)
-   Mod bumps FFmpeg to v5.1.3

### Thank you to all Patrons and donors

-   Martin H.
-   Paulo Gonçalves
-   Philipp Burkart
-   Mark Stephens
-   Fabian Stoll
-   Perry Johnson
-   Alex O'Carroll
-   Fiberian
-   Ivan Hašek
-   krischan941
-   Doug Roberts
-   Bassim Charafeddine
-   josue osorto
-   Raketenbaum
-   Byron Garcia
-   Jeff Moe
-   Ramakrishna Chillara
-   Eduardo Sarabia
-   Giovanni Russo
-   Gioele Cerati
-   Blueman2 (Robert G. Pearse)
-   Alex Fuhr
-   Frank Schulz

## 2.5.0

## Restreamer UI v1.6.0 > v1.7.0

-   Add analyzeduration, probesize and max_probe_packets input options
-   Add avoid_negative_ts input option
-   Add http_proxy input option ([#513](https://github.com/datarhei/restreamer/issues/513))
-   Add copyts, start_at_zero and use_wallclock_as_timestamps input options
-   Add heuristic to find core address if UI is proxied
-   Add Turkish translation (thanks to Ramazan Sancar) ([#22](https://github.com/datarhei/restreamer-ui/issues/22))
-   Add Danish translation (Thanks to Filip Stadler and Info)
-   Add Slovenian translation (thanks to Grega)
-   Add Greek translation
-   Mod allows general input settings for pull and push streams
-   Mod updates npm dependencies
-   Fix Creative Commons icons
-   Fix positioning of the deinterlacing filter ([#465](https://github.com/datarhei/restreamer/issues/465))

### Core v16.11.0 > v16.12.0

-   Add S3 storage support
-   Add support for variables in placeholde parameter
-   Add support for RTMP token as stream key as last element in path
-   Add support for soft memory limit with debug.memory_limit_mbytes in config
-   Add support for partial process config updates
-   Add support for alternative syntax for auth0 tenants as environment variable
-   Fix config timestamps created_at and loaded_at
-   Fix /config/reload return type
-   Fix modifying DTS in RTMP packets ([#487](https://github.com/datarhei/restreamer/issues/487), [#367](https://github.com/datarhei/restreamer/issues/367))
-   Fix default internal SRT latency to 20ms

## 2.4.2

### Restreamer UI v1.5.1 > v1.6.0

-   Add Bob Weaver Deinterlacing Filter ([#465](https://github.com/datarhei/restreamer/issues/465))
-   Add tests for wizard, network source, and coders
-   Add Korean translation (thanks to Jihaeng)
-   Mod splitting wizard in components
-   Fix wrong call to encoder defaults ([#467](https://github.com/datarhei/restreamer/issues/467))

## 2.4.1

### Restreamer UI v1.5.0 > v1.5.1

-   Fix FFmpeg version check for RTSP sources ([#455](https://github.com/datarhei/restreamer/issues/455))
-   Fix requires Core >= v16.11.0 and FFmpeg >= 5.1.0

## 2.4.0

### Attention

Restreamer v2.4.0 includes an update to FFmpeg v5.1.2.
All necessary process adjustments are activated at the first start of the Restreamer.

If you want to switch back to the old version follow these steps:  
[https://docs.datarhei.com/restreamer/installing/migration](https://docs.datarhei.com/restreamer/installing/migration)

_Hint: The backup restores only the previous processes._

### Restreamer UI v1.4.0 > v1.5.0

-   Add changelog viewer
-   Add skills props to encoder and decoder components
-   Add fps_mode to x264, x265, vp9 encoder
-   Add scale filter to non-hwaccel encoders
-   Add PeerTube and Media Network to publication services (plattforms, software)
-   Add reset button to hide a player logo ([#431](https://github.com/datarhei/restreamer/issues/431))
-   Mod expands V4L2_M2M options (an unstable RPI 64bit encoder)
-   Mod indicates a faulty cache configuration
-   Mod switches to the improved SRT syntax (thx to SA Consulting)
-   Mod improves display of progress data
-   Mod removes deprecated param ocl - now ochl (ff5)
-   Mod simplifies the setup of Restreamer-to-Restreamer connections
-   Mod adds Istafeed.me as StreamKey service to Instagram's publishing service
-   Mod renames "Low delay" to "Low latency (buffer)" and set false as default (requires more feedback)
-   Del removes support for clappr player
-   Fix npm dependencies (security fixes)
-   Fix videojs-overlay logo size ([#431](https://github.com/datarhei/restreamer/issues/431))
-   Fix use of TLS for input from local RTMP server
-   Fix Icecast publication service settings ([#429](https://github.com/datarhei/restreamer/issues/429))
-   Fix removes SRT bitstream on tee (OBS > RTMP > SRT is faulty)

### Core v16.10.1 > v16.11.0

-   Add FFmpeg v4.4 to FFmpeg v5.1 migration tool
-   Add alternative SRT streamid
-   Mod bump FFmpeg to v5.1.2 (datarhei/core:tag bundles)
-   Fix crash with custom SSL certificates ([restreamer/#425](https://github.com/datarhei/restreamer/issues/425))
-   Fix proper version handling for config
-   Fix widged session data
-   Fix resetting process stats when process stopped
-   Fix stale FFmpeg process detection for streams with only audio
-   Fix wrong return status code ([#6](https://github.com/datarhei/core/issues/6)))
-   Fix use SRT defaults for key material exchange

### FFmpeg v4.4.2 > v5.1.2

-   Mod FFmpeg v4.4.2 > v5.1.2 (+ patches)
-   Mod Nvidia CUDA v11.4.2 > v11.7.1
-   Mod Intel Media Driver v20.1.1

_We recommend OpenMAX IL for Raspberry PI (3/4) with a 32-bit operating system._

### Documentation

-   Add [v2.4+ to v2.3.x (downgrade) migration guide](https://docs.datarhei.com/restreamer/installing/migration)
-   Add [Windows install guides (Docker Desktop, Terminal)](https://docs.datarhei.com/restreamer/installing/windows)
-   Add [OSX installation guide (Docker Desktop, Terminal)](https://docs.datarhei.com/restreamer/installing/mac)
-   Mod small adjustments

## 2.3.0

-   Mod exposes ports (Docker desktop)

### Restreamer UI v1.2.0 > v1.4.0

-   Add email field for Let's Encrypt certification
-   Add low_delay option to processing (default: true)
-   Mod uses the ingest stream for publication ([#411](https://github.com/datarhei/restreamer/issues/411))
-   Add dlive & Trovo publication services
-   Mod optimized DVR on DiskFS
-   Mod updates packages
-   Fix SRT bitstream on tee
-   Fix typo
-   Fix viewer count (datarhei/restreamer#394)
-   Fix user registration if username and/or password are set via environment ([#13](https://github.com/datarhei/restreamer-ui/issues/13))
-   Fix Dockerfile, Reduce size, serve production build (datarhei/restreamer-ui#12)

### Core v16.9.1 > v16.10.1

-   Add email address in TLS config for Let's Encrypt
-   Add HLS session middleware to diskfs
-   Add /v3/metrics (get) endpoint to list all known metrics
-   Add logging HTTP request and response body sizes
-   Add process id and reference glob pattern matching
-   Add cache block list for extensions not to cache
-   Mod exclude .m3u8 and .mpd files from disk cache by default
-   Mod replaces x/crypto/acme/autocert with caddyserver/certmagic
-   Mod exposes ports (Docker desktop)
-   Fix use of Let's Encrypt production CA
-   Fix assigning cleanup rules for diskfs
-   Fix wrong path for swagger definition
-   Fix process cleanup on delete, remove empty directories from disk
-   Fix SRT blocking port on restart (upgrade datarhei/gosrt)
-   Fix RTMP communication (Blackmagic Web Presenter, thx 235 MEDIA)
-   Fix RTMP communication (Blackmagic ATEM Mini, datarhei/restreamer#385)
-   Fix injecting commit, branch, and build info
-   Fix API metadata endpoints responses

## 2.2.0

### Restreamer UI v1.1.0 > v1.2.0

-   Add allow writing HLS to disk
-   Add audio pan filter
-   Add video rotation filter ([#347](https://github.com/datarhei/restreamer/discussions/347))
-   Add video h/v flip filter
-   Add audio volume filter ([#313](https://github.com/datarhei/restreamer/issues/313))
-   Add audio loudness normalization filter
-   Add audio resample filter, that was before part of the encoders
-   Add HLS Master playlist (requires FFmpeg hlsbitrate.patch) (thx Dwaynarang, Electra Player compatibility)
-   Add linkedIn & Azure Media Services to publication services (thx kalashnikov)
-   Add AirPlay support with silvermine videojs plugin
-   Add Chromecast support (thx badincite, [#10](https://github.com/datarhei/restreamer-ui/pull/10))
-   Add stream distribution across multiple internal servers
-   Add SRT settings
-   Add HLS version selection (thx Dwaynarang, Electra Player compatibility)
-   Add Owncast to publication services ([#369](https://github.com/datarhei/restreamer/issues/369))
-   Add Telegram to publication services (thx Martin Held)
-   Add Polish translations (thx Robert Rykała)
-   Mod extends the datarhei Core publication service with srt streaming
-   Mod allow decoders and encoders to set global options
-   Mod allow trailing slash on Core address
-   Fix player problem with different stream formats (9:16)
-   Fix process report naming
-   Fix publication service icon styles
-   Fix VAAPI encoder

### Core v16.9.0 > v16.9.1

-   Fix v1 import app
-   Fix race condition

### Core v16.8.0 > v16.9.0

-   Add new placeholders and parameters for placeholder
-   Add optional escape character to process placeholder
-   Add experimental SRT connection stats and logs API
-   Add experimental SRT server (datarhei/gosrt)
-   Add trailing slash for routed directories ([#340](https://github.com/datarhei/restreamer/issues/340))
-   Mod allow RTMP server if RTMPS server is enabled
-   Mod create v16 in go.mod
-   Mod allow relative URLs in content in static routes
-   Fix output address validation for tee outputs
-   Fix updating process config
-   Fix hide /config/reload endpoint in reade-only mode
-   Fix data races, tests, lint, and update dependencies

## 2.1.0

-   Fix Dockerfile (bundles frontend, backend and FFmpeg)

### Restreamer UI v1.0.0 > v1.1.0

-   Add "HLS cleanup" as an optional function ([Philipp Trenz](https://github.com/philipptrenz))
-   Add /ui info to / ([#326](https://github.com/datarhei/restreamer/issues/326))
-   Add Russian translation (thx Inthegamelp)
-   Add missed VAAPI encoder
-   Add missed V4L2_M2M encoder
-   Add missed Raspberry Pi 64bit Docker image
-   Mod updates VideoJS
-   Add option to disable playersites share-button (thx Anders Mellgren)
-   Fix hides unset content license on playersite (thx Anders Mellgren)
-   Fix updates V4L2 device-list on select
-   Fix snapshot interval ([#341](https://github.com/datarhei/restreamer/issues/340))
-   Fix reverse proxy issue ([#340](https://github.com/datarhei/restreamer/issues/340))
-   Fix double escape failer ([#336](https://github.com/datarhei/restreamer/issues/336))
-   Fix type in player plugin ([#336](https://github.com/datarhei/restreamer/issues/336))
-   Fix deletes processes with dependencies (thx Patron Ramakrishna Chillara)
-   Fix datarhei Core publication service
-   Fix dependabot alerts
-   Fix code scanning alerts
-   Merge security pr

Preparation for FFmpeg v5.0 (migration will not work)

-   Add FFmpeg v5.0 commands (preparation)
-   Mod allows FFmpeg v5.0 (preparation)

### Core v16.7.2 > v16.8.0

-   Add purge_on_delete function
-   Mod updated dependencies
-   Mod updated API docs
-   Fix disabled session logging
-   Fix FFmpeg skills reload
-   Fix ignores processes with invalid references (thx Patron Ramakrishna Chillara)
-   Fix code scanning alerts

### FFmpeg v4.2.2 > v4.2.2-1

-   Mod enables libv4l2 + v4l2_m2m for all Docker images ([#339](https://github.com/datarhei/restreamer/issues/339))
-   Mod updates packages (freetype, libxml2, VAAPI-Libs (gmmlib, media-driver, media-sdk))
-   Fix cuda Docker image ([#328](https://github.com/datarhei/restreamer/issues/328))
-   Fix VAAPI Docker image

### FFmpeg v5.0.1

-   Add FFmpeg v5.0 JSONSTATS patch (preparation)

### Documentation

-   Add [Basic troubleshooting guide](https://docs.datarhei.com/restreamer/knowledge-base/troubleshooting/basic-troubleshooting)
-   Add [custom playersite guide](https://docs.datarhei.com/restreamer/knowledge-base/user-guides/how-to-integrate-a-website) ([#337](https://github.com/datarhei/restreamer/issues/337))
-   Add [guide for custom RTMP port](https://docs.datarhei.com/restreamer/knowledge-base/user-guides/how-to-change-the-rtmp-port)
-   Add [encoding compatiblity list](https://docs.datarhei.com/restreamer/knowledge-base/troubleshooting/encoding-compatibility-list))
