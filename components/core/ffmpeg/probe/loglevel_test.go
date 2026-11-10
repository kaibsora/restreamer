package probe

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLevelPrefixedTelemetry(t *testing.T) {
	p := New(Config{}).(*prober)
	p.Parse(`[info] ffmpeg.inputs:[{"index":0,"stream":0,"type":"video","codec":"h264","format":"rtsp","width":1920,"height":1080}]`)
	p.ResetStats()
	require.Len(t, p.inputs, 1)
	require.Equal(t, "h264", p.inputs[0].Codec)
}
