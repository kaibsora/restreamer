# RC-1 release gate

The maintainer reported full physical acceptance on November 11, 2026, after
successful overnight testing, acceptable local delay, hot-plug and rotation.
The [physical acceptance checklist](rc-1-acceptance.md) records that sign-off.
Branding, attribution/documentation review and release preparation are now unblocked.

Remaining release work:

- Replace product-facing datarhei branding in the UI with **CQComber Restreamer** branding.
  Preserve upstream license notices, copyright and attribution.
- Rewrite the main README as a complete installation and usage guide, including
  image tags, persistent data, ports, reverse proxy configuration, USB devices,
  hot-plug access, LAN delivery, publications and encoder configuration.
- Identify every bundled component, its version/source policy, license and
  original repository. Describe this project as an adaptation that attempts to
  keep upstream components current and provides requested fixes and features.
- Document tested hardware and limitations. Intel VA-API and Quick Sync have
  physical validation; AMD and NVIDIA GPUs are untested as of publication.
  Do not promise universal GPU support or measured optical latency.
- Publish the accepted image as `rc-1` and `latest`. Keep an immutable commit
  tag/digest available for reproducibility and rollback.
- Create `development` from the accepted code for future work. Update workflow
  branch/tag rules so development and testing cannot overwrite the accepted
  public `latest` image. Document how fixes are promoted to the release branch.

Maintainer acceptance is complete. Branding, final documentation and release
promotion remain unfinished; this file does not record a completed RC-1 release.

The unified workflow now publishes candidates only. Its old `publish_latest`
input must remain false. `promote-release.yml` runs only on `2.x`, verifies the
accepted digest/revision/source availability, refuses development images and
conflicting RC tags, then promotes without rebuilding. Scheduled upstream builds
remain candidates. The release also adds bundled dependency notices and a public,
digest-pinned corresponding-source container for the FFmpeg runtime.

CQComber branding, the usage guide and these release guards are implemented;
the final candidate build, deployment verification and promotion must succeed
before this record can be marked published.
