package skills

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFormatsFlagColumns(t *testing.T) {
	for _, data := range []string{
		" DE flv FLV\n  E rtsp RTSP\n D  mov,mp4 QuickTime\n",
		" DE  flv FLV\n  E  rtsp RTSP\n D   mov,mp4 QuickTime\n",
	} {
		formats := parseFormats([]byte(data))
		require.Equal(t, []Format{{Id: "flv", Name: "FLV"}, {Id: "rtsp", Name: "RTSP"}}, formats.Muxers)
		require.Equal(t, []Format{{Id: "flv", Name: "FLV"}, {Id: "mov", Name: "QuickTime"}}, formats.Demuxers)
	}
}

func TestDeviceFlagColumn(t *testing.T) {
	data := []byte(" DEd testdevice Test device\n")
	formats := parseFormats(data)
	require.Equal(t, []Format{{Id: "testdevice", Name: "Test device"}}, formats.Muxers)
	require.Equal(t, formats.Muxers, formats.Demuxers)
	devices := parseDevices(data, "")
	require.Equal(t, []Device{{Id: "testdevice", Name: "Test device"}}, devices.Muxers)
	require.Equal(t, devices.Muxers, devices.Demuxers)
}
