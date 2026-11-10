package v4lcontrol

import (
	"encoding/binary"
	"testing"

	"golang.org/x/sys/unix"
)

func TestCaptureModeEnumeration(t *testing.T) {
	call := func(request uintptr, data []byte) error {
		index := binary.NativeEndian.Uint32(data[:4])
		switch request {
		case enumFormat:
			if index != 0 {
				return unix.EINVAL
			}
			copy(data[12:44], "Camera H.264")
			binary.NativeEndian.PutUint32(data[44:48], uint32('H')|uint32('2')<<8|uint32('6')<<16|uint32('4')<<24)
			binary.NativeEndian.PutUint32(data[8:12], 1)
		case enumFrameSize:
			if index > 1 {
				return unix.EINVAL
			}
			binary.NativeEndian.PutUint32(data[8:12], 1)
			binary.NativeEndian.PutUint32(data[12:16], 640+index*640)
			binary.NativeEndian.PutUint32(data[16:20], 480+index*240)
		case enumFrameInterval:
			if index > 0 {
				return unix.EINVAL
			}
			binary.NativeEndian.PutUint32(data[16:20], 1)
			binary.NativeEndian.PutUint32(data[20:24], 1001)
			binary.NativeEndian.PutUint32(data[24:28], 30000)
		default:
			t.Fatalf("unexpected ioctl: %x", request)
		}
		return nil
	}
	formats, err := enumerateModes(call)
	if err != nil || len(formats) != 1 {
		t.Fatalf("%+v %v", formats, err)
	}
	f := formats[0]
	if f.FourCC != "H264" || f.InputFormat != "h264" || !f.Compressed || len(f.Sizes) != 2 || f.Sizes[1].Width != 1280 || f.Sizes[1].Height != 720 || f.Sizes[0].FrameRates[0] != "30000/1001" {
		t.Fatalf("%+v", f)
	}
}

func TestStepwiseCaptureSizes(t *testing.T) {
	sizes, r, err := captureSizes(func(request uintptr, data []byte) error {
		if request != enumFrameSize {
			t.Fatal("invented a discrete size from a range")
		}
		binary.NativeEndian.PutUint32(data[8:12], 3)
		for index, value := range []uint32{160, 1920, 16, 120, 1080, 8} {
			binary.NativeEndian.PutUint32(data[12+index*4:], value)
		}
		return nil
	}, 0)
	if err != nil || len(sizes) != 0 || r.MinimumWidth != 160 || r.MaximumHeight != 1080 || r.StepWidth != 16 || r.StepHeight != 8 {
		t.Fatalf("%+v %v", r, err)
	}
}

func TestFrameRateFractions(t *testing.T) {
	for _, test := range []struct {
		n, d uint32
		rate string
	}{{1, 30, "30"}, {2, 60, "30"}, {1001, 30000, "30000/1001"}, {0, 30, ""}, {1, 0, ""}} {
		if got := frameRate(test.n, test.d); got != test.rate {
			t.Fatal(got, test.rate)
		}
	}
	if inputFormat("H264") != "h264" || inputFormat("MJPG") != "mjpeg" || inputFormat("XXXX") != "" {
		t.Fatal("invalid FFmpeg format mapping")
	}
}
