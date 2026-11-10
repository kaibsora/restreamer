package v4lcontrol

import (
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"

	"golang.org/x/sys/unix"
)

const (
	enumFormat        = 0xc0405602
	enumFrameSize     = 0xc02c564a
	enumFrameInterval = 0xc034564b
)

type modeQuery func(uintptr, []byte) error

func frameRate(numerator, denominator uint32) string {
	if numerator == 0 || denominator == 0 {
		return ""
	}
	a, b := numerator, denominator
	for b != 0 {
		a, b = b, a%b
	}
	if numerator/a == 1 {
		return strconv.FormatUint(uint64(denominator/a), 10)
	}
	return fmt.Sprintf("%d/%d", denominator/a, numerator/a)
}

func frameIntervals(call modeQuery, pixelFormat, width, height uint32) ([]string, *IntervalRange, error) {
	rates := []string{}
	for index := uint32(0); index < 256; index++ {
		data := make([]byte, 52)
		for offset, value := range map[int]uint32{0: index, 4: pixelFormat, 8: width, 12: height} {
			binary.NativeEndian.PutUint32(data[offset:offset+4], value)
		}
		if err := call(enumFrameInterval, data); err != nil {
			if errors.Is(err, unix.EINVAL) || errors.Is(err, unix.ENOTTY) {
				return rates, nil, nil
			}
			return nil, nil, err
		}
		switch binary.NativeEndian.Uint32(data[16:20]) {
		case 1:
			if rate := frameRate(binary.NativeEndian.Uint32(data[20:24]), binary.NativeEndian.Uint32(data[24:28])); rate != "" {
				rates = append(rates, rate)
			}
		case 2, 3:
			r := &IntervalRange{}
			for offset, target := range map[int]*[2]uint32{20: &r.Minimum, 28: &r.Maximum, 36: &r.Step} {
				target[0] = binary.NativeEndian.Uint32(data[offset : offset+4])
				target[1] = binary.NativeEndian.Uint32(data[offset+4 : offset+8])
			}
			return rates, r, nil
		default:
			return nil, nil, fmt.Errorf("unknown frame interval type")
		}
	}
	return nil, nil, fmt.Errorf("frame interval enumeration exceeded limit")
}

func captureSizes(call modeQuery, pixelFormat uint32) ([]CaptureSize, *SizeRange, error) {
	sizes := []CaptureSize{}
	for index := uint32(0); index < 256; index++ {
		data := make([]byte, 44)
		binary.NativeEndian.PutUint32(data[:4], index)
		binary.NativeEndian.PutUint32(data[4:8], pixelFormat)
		if err := call(enumFrameSize, data); err != nil {
			if errors.Is(err, unix.EINVAL) || errors.Is(err, unix.ENOTTY) {
				return sizes, nil, nil
			}
			return nil, nil, err
		}
		switch binary.NativeEndian.Uint32(data[8:12]) {
		case 1:
			size := CaptureSize{Width: binary.NativeEndian.Uint32(data[12:16]), Height: binary.NativeEndian.Uint32(data[16:20])}
			var err error
			size.FrameRates, size.IntervalRange, err = frameIntervals(call, pixelFormat, size.Width, size.Height)
			if err != nil {
				return nil, nil, err
			}
			sizes = append(sizes, size)
		case 2, 3:
			values := []uint32{}
			for offset := 12; offset < 36; offset += 4 {
				values = append(values, binary.NativeEndian.Uint32(data[offset:offset+4]))
			}
			return sizes, &SizeRange{values[0], values[1], values[2], values[3], values[4], values[5]}, nil
		default:
			return nil, nil, fmt.Errorf("unknown frame size type")
		}
	}
	return nil, nil, fmt.Errorf("frame size enumeration exceeded limit")
}

func enumerateModes(call modeQuery) ([]CaptureFormat, error) {
	formats := []CaptureFormat{}
	for index := uint32(0); index < 128; index++ {
		data := make([]byte, 64)
		binary.NativeEndian.PutUint32(data[:4], index)
		binary.NativeEndian.PutUint32(data[4:8], 1) // VIDEO_CAPTURE, as used by FFmpeg's V4L2 input.
		if err := call(enumFormat, data); err != nil {
			if errors.Is(err, unix.EINVAL) {
				return formats, nil
			}
			return nil, err
		}
		pixelFormat := binary.NativeEndian.Uint32(data[44:48])
		fourcc := string([]byte{byte(pixelFormat), byte(pixelFormat >> 8), byte(pixelFormat >> 16), byte(pixelFormat >> 24)})
		format := CaptureFormat{FourCC: fourcc, Name: name(data[12:44]), InputFormat: inputFormat(fourcc), Compressed: binary.NativeEndian.Uint32(data[8:12])&1 != 0}
		var err error
		format.Sizes, format.SizeRange, err = captureSizes(call, pixelFormat)
		if err != nil {
			return nil, err
		}
		formats = append(formats, format)
	}
	return nil, fmt.Errorf("capture format enumeration exceeded limit")
}

// Modes enumerates driver capabilities without starting capture or changing the
// active mode. See Linux VIDIOC_ENUM_FMT/FRAMESIZES/FRAMEINTERVALS documentation.
func Modes(path string) ([]CaptureFormat, error) {
	controlLock.Lock()
	defer controlLock.Unlock()
	fd, err := openCamera(path, false)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	remaining := 8192
	return enumerateModes(func(request uintptr, data []byte) error {
		remaining--
		if remaining < 0 {
			return fmt.Errorf("camera mode query exceeded budget")
		}
		return ioctl(fd, request, data)
	})
}
