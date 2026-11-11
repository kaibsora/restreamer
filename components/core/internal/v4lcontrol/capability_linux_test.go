package v4lcontrol

import (
	"errors"
	"testing"
)

func TestCameraCapabilityRejectsCodecAndMetadataNodes(t *testing.T) {
	for _, flags := range []uint32{0x4000, 0x8000, 0x4001, 0x9000} {
		if !errors.Is(cameraCapability(flags), ErrCodecDevice) {
			t.Fatalf("codec capabilities %#x advertised as a camera", flags)
		}
	}
	for _, flags := range []uint32{1, 0x1000} {
		if err := cameraCapability(flags); err != nil {
			t.Fatal(err)
		}
	}
	if cameraCapability(0x800000) == nil {
		t.Fatal("metadata-only node advertised as a camera")
	}
}
