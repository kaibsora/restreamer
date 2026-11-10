package restream

import "github.com/datarhei/core/v16/ffmpeg"

func (r *restream) inputOptions(options []string) []string {
	return ffmpeg.NormalizeInputOptions(options, r.ffmpeg.Skills().FFmpeg.InputThreadQueueUnsupported)
}
