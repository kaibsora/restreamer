# Live camera controls (development)

The authenticated channel dashboard now exposes **Camera controls** below the
player for the physical V4L2 video inputs used by that channel. This feature is
on `development`; it is not included in the published 1.0.0 image.

Expand the panel to read the camera's controls. Drag the brightness, exposure,
focus, zoom or other supported integer sliders. Their ranges and increments come
from the camera driver. Changes are sent while you move the thumb, at most once
every 150 ms during a continuous drag; releasing it flushes the final position.
Only one write is in flight per camera, and pending positions are replaced by the
newest value. Keyboard arrows also work. A slow response does not snap the thumb
back over a newer pending position.

Automatic-mode and menu selections apply immediately. Action controls still have
an explicit **Run** button; bitmasks and controls without a usable slider range
retain their numeric field and **Apply** button. The setup editor retains its
existing controls. Failed writes display the driver error and read the actual
values back rather than retrying continuously.

These changes do not stop/restart capture or save a new stream configuration.
The live preview reflects them after its normal playback buffer; HLS does not
become a low-latency preview.

Use **Refresh controls** to read changes made by another client. Automatic modes
may disable dependent manual controls, and some controls cannot change while the
camera is streaming. Read-only, inactive and unsupported controls stay disabled;
the driver decides which features a particular camera supports. Controls act on
the physical camera, so other streams using that camera also see the change.
Settings may reset after reconnect/reboot and are not automatically reapplied.

Capture format, resolution, frame rate, encoded rotation and encoder settings
still belong in the stream editor: those changes require reconfiguring the
capture/encoding pipeline. Network and virtual inputs do not offer local USB
controls; this is not an ONVIF/IP-camera control implementation. The public
viewer does not gain camera-control permissions.
