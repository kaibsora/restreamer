package main

import (
	"testing"

	"github.com/datarhei/core/v16/log"
	"github.com/datarhei/core/v16/restream/app"
	"github.com/stretchr/testify/require"
)

func TestCurrentFFmpegMigration(t *testing.T) {
	for _, version := range []string{"7.1.1", "8.0.0", "9.0.2", "10.0.0"} {
		t.Run(version, func(t *testing.T) {
			config := app.Config{FFVersion: "^" + version}
			changed, err := migrateProcessConfig(log.New("test"), &config, version)
			require.NoError(t, err)
			require.False(t, changed, "same-version restart must preserve configuration")
			require.Equal(t, "^"+version, config.FFVersion)
		})
	}
}

func TestLegacyRTSPMigrationToCurrentFFmpeg(t *testing.T) {
	config := app.Config{FFVersion: "^4.4.0", Input: []app.ConfigIO{{
		Address: "rtsp://camera.local/stream",
		Options: []string{"-stimeout", "5000000"},
	}}}
	changed, err := migrateProcessConfig(log.New("test"), &config, "9.0.2")
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, []string{"-timeout", "5000000"}, config.Input[0].Options)
	require.Equal(t, "^9.0.2", config.FFVersion)
}
