package parse

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLevelPrefixedTelemetry(t *testing.T) {
	for _, prefix := range []string{"", "[info] "} {
		t.Run(prefix, func(t *testing.T) {
			p := New(Config{}).(*parser)
			p.Parse(prefix + `ffmpeg.inputs:[{"index":0,"stream":0,"type":"video","codec":"wrapped_avframe","format":"lavfi","width":1920,"height":1080}]`)
			p.Parse(prefix + `ffmpeg.outputs:[{"index":0,"stream":0,"type":"video","codec":"h264","coder":"h264_vaapi","format":"hls","width":1920,"height":1080}]`)
			p.Parse(prefix + `ffmpeg.progress:{"inputs":[{"index":0,"stream":0,"frame":251,"packet":251}],"outputs":[{"index":0,"stream":0,"frame":250,"packet":250}],"frame":250,"packet":250,"time":"0h0m10.0s","speed":1.02}`)
			progress := p.Progress()
			require.EqualValues(t, 250, progress.Frame)
			require.Len(t, progress.Input, 1)
			require.Len(t, progress.Output, 1)
		})
	}
}
