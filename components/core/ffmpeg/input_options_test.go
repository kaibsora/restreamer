package ffmpeg

import (
	"reflect"
	"testing"
)

func TestNormalizeLegacyInputQueue(t *testing.T) {
	input := []string{"-f", "video4linux2", "-thread_queue_size", "512", "-framerate", "15"}
	want := []string{"-f", "video4linux2", "-framerate", "15"}
	if got := NormalizeInputOptions(input, true); !reflect.DeepEqual(got, want) {
		t.Fatal(got)
	}
	if input[2] != "-thread_queue_size" {
		t.Fatal("stored input configuration was modified")
	}
	if got := NormalizeInputOptions(input, false); !reflect.DeepEqual(got, input) {
		t.Fatal("older FFmpeg input options changed")
	}
}

func TestNormalizeDoesNotConsumeUnrelatedOptionValue(t *testing.T) {
	input := []string{"-user_agent", "-thread_queue_size", "-f", "video4linux2"}
	if got := NormalizeInputOptions(input, true); !reflect.DeepEqual(got, input) {
		t.Fatal(got)
	}
}
