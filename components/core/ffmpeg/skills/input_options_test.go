package skills

import "testing"

func TestInputQueueScopeDetectionDoesNotTrustVersionBanner(t *testing.T) {
	for _, test := range []struct {
		help        string
		unsupported bool
	}{
		{"Advanced per-file options (input and output):\n-thread_queue_size  queue packets", false},
		{"Advanced per-file options (input-only):\n-thread_queue_size  queue packets", false},
		{"Advanced per-file options (output-only):\n-thread_queue_size  queue packets per stream on the muxer", true},
		{"unrecognized custom help output", false},
	} {
		if got := parseInputThreadQueueUnsupported(test.help); got != test.unsupported {
			t.Fatalf("%q: %v", test.help, got)
		}
	}
}
