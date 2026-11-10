package ffmpeg

import "strconv"

// NormalizeInputOptions removes the obsolete input queue flag only when the
// running binary advertises it as output-only. Do not change stored configs or
// output options, where the same flag remains valid.
func NormalizeInputOptions(options []string, unsupported bool) []string {
	if !unsupported {
		return options
	}
	result := make([]string, 0, len(options))
	for i := 0; i < len(options); i++ {
		if options[i] == "-thread_queue_size" && i+1 < len(options) {
			if _, err := strconv.Atoi(options[i+1]); err == nil {
				i++
				continue
			}
		}
		result = append(result, options[i])
	}
	return result
}
