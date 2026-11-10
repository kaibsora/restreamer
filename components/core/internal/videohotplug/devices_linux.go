package videohotplug

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"unsafe"

	"golang.org/x/sys/unix"
)

var videoName = regexp.MustCompile(`^video[0-9]+$`)
var aliasName = regexp.MustCompile(`^[A-Za-z0-9_.:+-]+$`)

type linuxBackend struct{ source, target string }

func newBackend(source, target string) (backend, error) {
	if !filepath.IsAbs(source) || filepath.Clean(source) == filepath.Clean(target) {
		return nil, fmt.Errorf("camera discovery requires a separate absolute host-device mount")
	}
	for _, path := range []string{source, target} {
		info, err := os.Lstat(path)
		if err != nil {
			return nil, err
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("device directory is not a real directory: %s", path)
		}
	}
	return &linuxBackend{source: filepath.Clean(source), target: filepath.Clean(target)}, nil
}

func statNode(path string) (node, error) {
	var s unix.Stat_t
	if err := unix.Lstat(path, &s); err != nil {
		return node{}, err
	}
	if s.Mode&unix.S_IFMT != unix.S_IFCHR || unix.Major(s.Rdev) != 81 {
		return node{}, fmt.Errorf("refusing non-V4L2 device: %s", path)
	}
	return node{Minor: unix.Minor(s.Rdev), GID: s.Gid, Generation: fmt.Sprintf("%d:%d:%d", s.Ino, s.Ctim.Sec, s.Ctim.Nsec)}, nil
}

// Linux struct v4l2_capability and VIDIOC_QUERYCAP (104-byte _IOR('V', 0)).
type capability struct {
	Driver                            [16]byte
	Card                              [32]byte
	Bus                               [32]byte
	Version, Capabilities, DeviceCaps uint32
	Reserved                          [3]uint32
}

func captureCaps(c capability) bool {
	flags := c.Capabilities
	if flags&0x80000000 != 0 {
		flags = c.DeviceCaps
	}
	return flags&(0x00000001|0x00001000) != 0 // capture / multiplanar capture
}

func captureDevice(path string, expected node) bool {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	var s unix.Stat_t
	if unix.Fstat(fd, &s) != nil || s.Mode&unix.S_IFMT != unix.S_IFCHR || unix.Major(s.Rdev) != 81 || unix.Minor(s.Rdev) != expected.Minor {
		return false
	}
	var c capability
	_, _, errno := unix.Syscall(unix.SYS_IOCTL, uintptr(fd), uintptr(0x80685600), uintptr(unsafe.Pointer(&c)))
	return errno == 0 && captureCaps(c)
}

func validAlias(name string) bool { return name != "." && name != ".." && aliasName.MatchString(name) }

func (b *linuxBackend) scan(previous snapshot) (snapshot, error) {
	entries, err := os.ReadDir(b.source)
	if err != nil {
		return snapshot{}, err
	}
	current := empty()
	for _, entry := range entries {
		name := entry.Name()
		if !videoName.MatchString(name) {
			continue
		}
		path := filepath.Join(b.source, name)
		n, err := statNode(path)
		if err != nil {
			continue
		}
		// Don't reopen a busy capture device every second. Reprobe when the
		// host inode changes, including a fast replug with the same minor.
		if old, found := previous.Nodes[name]; found && old == n || captureDevice(path, n) {
			current.Nodes[name] = n
		}
	}
	aliases := filepath.Join(b.source, "v4l", "by-id")
	entries, err = os.ReadDir(aliases)
	if err != nil && !os.IsNotExist(err) {
		return snapshot{}, err
	}
	for _, entry := range entries {
		if !validAlias(entry.Name()) {
			continue
		}
		target, err := os.Readlink(filepath.Join(aliases, entry.Name()))
		if err != nil || filepath.IsAbs(target) {
			continue
		}
		resolved := filepath.Clean(filepath.Join(aliases, target))
		name := filepath.Base(resolved)
		if resolved != filepath.Join(b.source, name) {
			continue
		}
		if _, found := current.Nodes[name]; found {
			current.Aliases[entry.Name()] = name
		}
	}
	return current, nil
}

func (b *linuxBackend) devicePath(name string) (string, error) {
	if !videoName.MatchString(name) {
		return "", fmt.Errorf("invalid video device name: %q", name)
	}
	return filepath.Join(b.target, name), nil
}

func (b *linuxBackend) ensureNode(name string, wanted node, replace bool) (bool, error) {
	path, err := b.devicePath(name)
	if err != nil {
		return false, err
	}
	current, err := statNode(path)
	if err == nil {
		if current.Minor != wanted.Minor {
			return false, fmt.Errorf("refusing to replace unexpected device: %s", path)
		}
		if !replace {
			return false, nil
		}
		if err := os.Remove(path); err != nil {
			return false, err
		}
	} else if !os.IsNotExist(err) {
		return false, err
	}
	if err := unix.Mknod(path, unix.S_IFCHR|0660, int(unix.Mkdev(81, wanted.Minor))); err != nil {
		return false, err
	}
	if err := os.Chown(path, 0, int(wanted.GID)); err != nil {
		os.Remove(path)
		return false, err
	}
	return true, nil
}

func (b *linuxBackend) removeNode(name string, expected node) error {
	path, err := b.devicePath(name)
	if err != nil {
		return err
	}
	n, err := statNode(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if n.Minor != expected.Minor {
		return fmt.Errorf("device changed ownership: %s", path)
	}
	return os.Remove(path)
}

func (b *linuxBackend) aliasPath(name string) (string, error) {
	if !validAlias(name) {
		return "", fmt.Errorf("invalid camera alias: %q", name)
	}
	parent := b.target
	for _, part := range []string{"v4l", "by-id"} {
		parent = filepath.Join(parent, part)
		if err := os.Mkdir(parent, 0755); err != nil && !os.IsExist(err) {
			return "", err
		}
		info, err := os.Lstat(parent)
		if err != nil {
			return "", err
		}
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("refusing unsafe camera alias directory: %s", parent)
		}
	}
	return filepath.Join(parent, name), nil
}

func (b *linuxBackend) ensureAlias(name, target string) (bool, error) {
	if !videoName.MatchString(target) {
		return false, fmt.Errorf("invalid camera alias target: %q", target)
	}
	path, err := b.aliasPath(name)
	if err != nil {
		return false, err
	}
	wanted := "../../" + target
	current, err := os.Readlink(path)
	if err == nil && current == wanted {
		return false, nil
	}
	if !os.IsNotExist(err) {
		return false, fmt.Errorf("refusing to overwrite camera alias: %s", path)
	}
	return true, os.Symlink(wanted, path)
}

func (b *linuxBackend) removeAlias(name, expected string) error {
	if !videoName.MatchString(expected) {
		return fmt.Errorf("invalid previous alias target")
	}
	path, err := b.aliasPath(name)
	if err != nil {
		return err
	}
	current, err := os.Readlink(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if current != "../../"+expected {
		return fmt.Errorf("camera alias changed ownership: %s", path)
	}
	return os.Remove(path)
}
