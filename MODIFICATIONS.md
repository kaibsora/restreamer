# Fork modification notice

This repository contains modified versions of datarhei Restreamer, Restreamer UI,
Core and FFmpeg packaging. CQComber (GitHub: kaibsora) maintains this independent
adaptation. The original authors' copyright and licenses remain in force.

Changes made for this fork include the unified source tree and container build;
updated Go, JavaScript and FFmpeg dependencies; hardware encoding configuration;
V4L2 capability discovery, camera controls and hot-plug handling; source rotation;
HLS playback/startup fixes; LAN relay integrations; wizard labels/translations;
CI, verification tools and documentation. The RC-1 preparation adds CQComber
product branding, original SVG artwork, component notices and release channels.

The Git history records changes by file and date. Individual change notices in
modified files supplement this overview. Vendored third-party source, dependency
licenses, upstream credit and protocol/API identifiers are retained. Product
branding does not transfer authorship of the upstream implementation.

* November 2026: generate the footer codename deterministically from the Core
  application Git commit; rename the accepted branch to main; add native AMD64
  and ARM64 image builds with platform-specific FFmpeg/source images, dual
  native acceptance and a combined OCI index. Add a Raspberry Pi V4L2 deployment
  override, expose M2M codec nodes without listing them as cameras, and bound
  V4L2 M2M buffer defaults for constrained hosts. Original notices are retained.

* November 2026: update new-source metadata and the player-site support label to
  CQComber Restreamer; repair MediaMTX help links after the main branch rename;
  document Pi 5 libavcodec/libx264 CPU encoding with Raspberry Pi's performance
  paper and record successful ARM USB camera testing.
