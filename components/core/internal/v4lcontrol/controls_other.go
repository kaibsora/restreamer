//go:build !linux

package v4lcontrol

func IsNonCameraDevice(path string) bool { return false }

func Modes(path string) ([]CaptureFormat, error) { return nil, ErrUnsupported }

func List(path string) ([]Control, error)                        { return nil, ErrUnsupported }
func Set(path string, id uint32, value int64) ([]Control, error) { return nil, ErrUnsupported }
