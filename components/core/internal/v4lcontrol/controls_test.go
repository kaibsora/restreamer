package v4lcontrol

import "testing"

func TestCameraPaths(t *testing.T) {
	for _, path := range []string{"/dev/video0", "/dev/video12", "/dev/v4l/by-id/usb-test-video-index0", "/dev/v4l/by-path/pci-0000:00-video-index0"} {
		if !validPath(path) {
			t.Errorf("valid camera path rejected: %s", path)
		}
	}
	for _, path := range []string{"/dev/null", "/etc/passwd", "/dev/video0/../sda", "/dev/v4l/by-id/..", "/dev/v4l/by-path/.", "/dev/video0;id", "video0", "/host/dev/video0"} {
		if validPath(path) {
			t.Errorf("unsafe path accepted: %s", path)
		}
	}
}

func TestControlValidation(t *testing.T) {
	integer := Control{Supported: true, Type: "integer", Minimum: -10, Maximum: 10, Step: 2}
	for _, value := range []int64{-10, 0, 10} {
		if err := validateValue(integer, value); err != nil {
			t.Fatal(err)
		}
	}
	for _, value := range []int64{-11, 1, 12} {
		if validateValue(integer, value) == nil {
			t.Fatalf("accepted invalid value %d", value)
		}
	}
	menu := Control{Supported: true, Type: "menu", Minimum: 0, Maximum: 3, Step: 1, Choices: []Choice{{Value: 0}, {Value: 3}}}
	if validateValue(menu, 1) == nil || validateValue(menu, 3) != nil {
		t.Fatal("menu holes must be rejected")
	}
	mask := Control{Supported: true, Type: "bitmask", Maximum: 5}
	if validateValue(mask, 2) == nil || validateValue(mask, 5) != nil {
		t.Fatal("unsupported mask bits accepted")
	}
	for _, blocked := range []Control{{Supported: false}, {Supported: true, ReadOnly: true}, {Supported: true, Inactive: true}} {
		if validateValue(blocked, 0) == nil {
			t.Fatal("unavailable control accepted")
		}
	}
}
