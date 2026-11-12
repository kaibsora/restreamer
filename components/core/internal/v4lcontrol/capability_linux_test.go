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

func TestStandaloneCameraDiscovery(t *testing.T) {
	for _, device := range []struct {
		driver string
		flags  uint32
	}{
		{"uvcvideo", 0x04200001},
		{"bcm2835-v4l2", 1},
		{"vivid", 0x1000}, // Valid multiplanar capture must remain supported.
	} {
		if err := cameraDeviceCapability(device.driver, device.flags); err != nil {
			t.Fatalf("valid camera %s rejected: %v", device.driver, err)
		}
	}
	for _, flags := range []uint32{2, 0x2000, 0x800000, 0x8000000, 0x20000001, 0x20001000} {
		if !errors.Is(cameraDeviceCapability("other", flags), ErrNotCameraDevice) {
			t.Fatalf("non-standalone camera capabilities %#x advertised as a camera", flags)
		}
	}
	for _, flags := range []uint32{1, 0x1000} {
		if !errors.Is(cameraDeviceCapability("pispbe", flags), ErrNotCameraDevice) {
			t.Fatal("PiSP processing queue advertised as a standalone camera")
		}
	}
}
