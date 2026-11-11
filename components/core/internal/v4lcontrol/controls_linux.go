package v4lcontrol

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"unsafe"

	"golang.org/x/sys/unix"
)

// Linux videodev2.h: these ioctl layouts are identical on our amd64/arm targets.
const (
	queryCap     = 0x80685600
	queryControl = 0xc0445624
	queryMenu    = 0xc02c5625
	getControl   = 0xc008561b
	setControl   = 0xc008561c
	nextControl  = 0x80000000
)

var controlLock sync.Mutex

func ioctl(fd int, request uintptr, data []byte) error {
	for {
		_, _, errno := unix.Syscall(unix.SYS_IOCTL, uintptr(fd), request, uintptr(unsafe.Pointer(&data[0])))
		if errno == unix.EINTR {
			continue
		}
		if errno != 0 {
			return errno
		}
		return nil
	}
}

func openCamera(path string, write bool) (int, error) {
	if !validPath(path) {
		return -1, fmt.Errorf("expected /dev/videoN or a stable V4L2 alias")
	}
	mode := unix.O_RDONLY
	if write {
		mode = unix.O_RDWR
	}
	fd, err := unix.Open(path, mode|unix.O_NONBLOCK|unix.O_CLOEXEC|unix.O_NOCTTY, 0)
	if err != nil {
		return -1, err
	}
	ok := false
	defer func() {
		if !ok {
			unix.Close(fd)
		}
	}()
	var stat unix.Stat_t
	if err = unix.Fstat(fd, &stat); err != nil {
		return -1, err
	}
	if stat.Mode&unix.S_IFMT != unix.S_IFCHR || unix.Major(stat.Rdev) != 81 {
		return -1, fmt.Errorf("not a V4L2 character device")
	}
	capability := make([]byte, 104)
	if err = ioctl(fd, queryCap, capability); err != nil {
		return -1, err
	}
	flags := binary.NativeEndian.Uint32(capability[84:88])
	if flags&0x80000000 != 0 {
		flags = binary.NativeEndian.Uint32(capability[88:92])
	}
	if err := cameraCapability(flags); err != nil {
		return -1, err
	}
	ok = true
	return fd, nil
}

func cameraCapability(flags uint32) error {
	if flags&0xc000 != 0 {
		return ErrCodecDevice
	}
	if flags&(1|0x1000) == 0 {
		return fmt.Errorf("not a video capture device")
	}
	return nil
}

// IsCodecDevice lets discovery hide M2M devices while preserving the fallback
// for mapped devices that cannot be queried until a later source probe.
func IsCodecDevice(path string) bool {
	fd, err := openCamera(path, false)
	if fd >= 0 {
		unix.Close(fd)
	}
	return errors.Is(err, ErrCodecDevice)
}

func name(data []byte) string   { return string(bytes.SplitN(data, []byte{0}, 2)[0]) }
func integer(data []byte) int64 { return int64(int32(binary.NativeEndian.Uint32(data))) }

func readControl(fd int, query []byte) Control {
	typeID := binary.NativeEndian.Uint32(query[4:8])
	flags := binary.NativeEndian.Uint32(query[56:60])
	c := Control{ID: binary.NativeEndian.Uint32(query[:4]), Name: name(query[8:40]),
		Minimum: integer(query[40:44]), Maximum: integer(query[44:48]), Step: integer(query[48:52]), Default: integer(query[52:56]),
		ReadOnly: flags&4 != 0, Inactive: flags&(2|16) != 0, Choices: []Choice{}}
	types := map[uint32]string{1: "integer", 2: "boolean", 3: "menu", 4: "button", 5: "integer64", 7: "string", 8: "bitmask", 9: "integer_menu"}
	c.Type = types[typeID]
	if c.Type == "" {
		c.Type = "compound"
	}
	c.Supported = typeID == 1 || typeID == 2 || typeID == 3 || typeID == 4 || typeID == 8 || typeID == 9
	if typeID == 8 {
		c.Maximum = int64(binary.NativeEndian.Uint32(query[44:48]))
		c.Step = 0
	}
	if typeID == 3 || typeID == 9 {
		if c.Maximum-c.Minimum > 1024 {
			c.Supported = false
			return c
		}
		for i := c.Minimum; i <= c.Maximum; i++ {
			menu := make([]byte, 44)
			binary.NativeEndian.PutUint32(menu[:4], c.ID)
			binary.NativeEndian.PutUint32(menu[4:8], uint32(i))
			if ioctl(fd, queryMenu, menu) != nil {
				continue
			} // Menu indices may have holes.
			label := name(menu[8:40])
			if typeID == 9 {
				label = strconv.FormatInt(int64(binary.NativeEndian.Uint64(menu[8:16])), 10)
			}
			c.Choices = append(c.Choices, Choice{Value: i, Name: label})
		}
	}
	if c.Supported && typeID != 4 {
		value := make([]byte, 8)
		binary.NativeEndian.PutUint32(value[:4], c.ID)
		if ioctl(fd, getControl, value) == nil {
			v := integer(value[4:8])
			if typeID == 8 {
				v = int64(binary.NativeEndian.Uint32(value[4:8]))
			}
			c.Value = &v
		} else {
			c.Supported = false
		}
	}
	return c
}

func list(fd int) ([]Control, error) {
	controls := []Control{}
	var last uint32
	for n := 0; n < 1024; n++ {
		query := make([]byte, 68)
		binary.NativeEndian.PutUint32(query[:4], last|nextControl)
		if err := ioctl(fd, queryControl, query); err != nil {
			if errors.Is(err, unix.EINVAL) {
				return controls, nil
			}
			return nil, err
		}
		id := binary.NativeEndian.Uint32(query[:4])
		if id <= last {
			return nil, fmt.Errorf("driver returned non-advancing control IDs")
		}
		last = id
		if binary.NativeEndian.Uint32(query[56:60])&1 != 0 || binary.NativeEndian.Uint32(query[4:8]) == 6 {
			continue
		}
		controls = append(controls, readControl(fd, query))
	}
	return nil, fmt.Errorf("camera control enumeration exceeded limit")
}

func List(path string) ([]Control, error) {
	controlLock.Lock()
	defer controlLock.Unlock()
	fd, err := openCamera(path, false)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	return list(fd)
}

func Set(path string, id uint32, value int64) ([]Control, error) {
	controlLock.Lock()
	defer controlLock.Unlock()
	fd, err := openCamera(path, true)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	controls, err := list(fd)
	if err != nil {
		return nil, err
	}
	for _, control := range controls {
		if control.ID != id {
			continue
		}
		if err := validateValue(control, value); err != nil {
			return nil, err
		}
		if control.Type == "button" {
			value = 0
		}
		data := make([]byte, 8)
		binary.NativeEndian.PutUint32(data[:4], id)
		binary.NativeEndian.PutUint32(data[4:8], uint32(value))
		if err := ioctl(fd, setControl, data); err != nil {
			return nil, err
		}
		return list(fd) // Auto modes can change availability of dependent controls.
	}
	return nil, fmt.Errorf("camera does not advertise control %d", id)
}
