package skills

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNoV4LDevices(t *testing.T) {
	data := bytes.NewBufferString(``)

	devices := parseV4LDevices(data)

	require.Equal(t, []HWDevice{}, devices)
}

func TestV4LDevices(t *testing.T) {
	data := bytes.NewBufferString(`mmal service 16.1 (platform:bcm2835-v4l2):
	/dev/video0

Webcam C170: Webcam C170 (usb-3f980000.usb-1.3):
	/dev/video1

`)

	devices := parseV4LDevices(data)

	require.Equal(t, []HWDevice{
		{
			Id:    "/dev/video0",
			Name:  "mmal service 16.1",
			Extra: "platform:bcm2835-v4l2",
			Media: "video",
		},
		{
			Id:    "/dev/video1",
			Name:  "Webcam C170: Webcam C170",
			Extra: "usb-3f980000.usb-1.3",
			Media: "video",
		},
	}, devices)
}

func TestAddV4LDevicePaths(t *testing.T) {
	devices := []HWDevice{
		{
			Id:    "/dev/video0",
			Name:  "Webcam C170",
			Extra: "usb-3f980000.usb-1.3",
			Media: "video",
		},
	}

	devices = addV4LDevicePaths(devices, []string{
		"/dev/video0",
		"/dev/video1",
		"/dev/video2-metadata",
		"/dev/media3",
	})

	require.Equal(t, []HWDevice{
		{
			Id:    "/dev/video0",
			Name:  "Webcam C170",
			Extra: "usb-3f980000.usb-1.3",
			Media: "video",
		},
		{
			Id:    "/dev/video1",
			Name:  "Video device video1",
			Media: "video",
		},
	}, devices)
}
