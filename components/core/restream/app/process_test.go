package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateCommand(t *testing.T) {
	config := &Config{
		Options: []string{"-global", "global"},
		Input: []ConfigIO{
			{Address: "inputAddress", Options: []string{"-input", "inputoption"}},
		},
		Output: []ConfigIO{
			{Address: "outputAddress", Options: []string{"-output", "oututoption"}},
		},
	}

	command := config.CreateCommand()
	require.Equal(t, []string{
		"-global", "global",
		"-input", "inputoption", "-i", "inputAddress",
		"-output", "oututoption", "outputAddress",
	}, command)
}

func TestRuntimeInputCompatibilityPreservesOutputQueue(t *testing.T) {
	config := &Config{
		Input:  []ConfigIO{{Address: "/dev/video0", Options: []string{"-f", "video4linux2", "-thread_queue_size", "512"}}},
		Output: []ConfigIO{{Address: "output.ts", Options: []string{"-thread_queue_size", "32", "-f", "mpegts"}}},
	}
	command := config.CreateCommandWithInputOptions(func(options []string) []string { return options[:2] })
	require.Equal(t, []string{"-f", "video4linux2", "-i", "/dev/video0", "-thread_queue_size", "32", "-f", "mpegts", "output.ts"}, command)
	require.Contains(t, config.Input[0].Options, "-thread_queue_size")
}
