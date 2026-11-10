# RC-1 release gate

Camera controls and encoded image rotation are being prepared for physical
acceptance testing. Do not publish RC-1 or change the UI branding until the
maintainer has tested and accepted the core features on physical hardware.
Track that testing using the [physical acceptance checklist](rc-1-acceptance.md).

After acceptance:

- Replace product-facing datarhei branding in the UI with kaibsora branding.
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

Maintainer acceptance is pending. This file records release intent, not a
completed release or a claim that all core features have passed physical tests.

Candidate builds no longer update `latest` automatically. The unified workflow
requires the explicit manual `publish_latest` input, which defaults to false and
is disabled on `development`. Scheduled builds still build updated upstream
sources into candidate tags without silently promoting them to the accepted
public image. RC-1 tagging and release-branch promotion remain pending acceptance.
