package videohotplug

import (
	"os"
	"path/filepath"
	"testing"
	"unsafe"

	"golang.org/x/sys/unix"
)

func TestCaptureCapabilityFiltersMetadataAndHonorsDeviceCaps(t *testing.T) {
	if unsafe.Sizeof(capability{}) != 104 {
		t.Fatal("incorrect V4L2 ioctl structure size")
	}
	for _, test := range []struct {
		c       capability
		capture bool
	}{
		{capability{Capabilities: 1}, true},
		{capability{Capabilities: 0x1000}, true},
		{capability{Capabilities: 0x800000}, false},
		{capability{Capabilities: 0x80000001, DeviceCaps: 0x800000}, false},
		{capability{Capabilities: 0x80000000, DeviceCaps: 1}, true},
	} {
		if captureCaps(test.c) != test.capture {
			t.Fatalf("incorrect capture classification: %+v", test)
		}
	}
}

func TestRefusesUnrelatedFilesAndEscapingPaths(t *testing.T) {
	source, target := t.TempDir(), t.TempDir()
	b := &linuxBackend{source: source, target: target}
	path := filepath.Join(target, "video0")
	if err := os.WriteFile(path, []byte("preserve me"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := b.ensureNode("video0"); err == nil {
		t.Fatal("regular file was replaced")
	}
	if err := b.removeNode("video0"); err == nil {
		t.Fatal("regular file was removed")
	}
	for _, name := range []string{"../sda", "video0/../../etc/passwd", "/dev/video0"} {
		if _, err := b.ensureNode(name); err == nil {
			t.Fatal("unsafe device path accepted", name)
		}
	}
	for _, name := range []string{"..", ".", "../../passwd", "/etc/passwd"} {
		if _, err := b.ensureAlias(name, "video0"); err == nil {
			t.Fatal("unsafe alias accepted", name)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "preserve me" {
		t.Fatal("unrelated file modified")
	}
}

func TestDeviceLinkFollowsFastReplugWithoutRecreatingPrivateInode(t *testing.T) {
	b := &linuxBackend{source: t.TempDir(), target: t.TempDir()}
	host := filepath.Join(b.source, "video0")
	if err := os.WriteFile(host, []byte("first"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := b.ensureNode("video0"); err != nil {
		t.Fatal(err)
	}
	private := filepath.Join(b.target, "video0")
	before, err := os.Lstat(private)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(host); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(host, []byte("second"), 0600); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(private)
	if err != nil || string(data) != "second" {
		t.Fatal("link retained the old host inode", err)
	}
	after, err := os.Lstat(private)
	if err != nil || !os.SameFile(before, after) {
		t.Fatal("private link was unexpectedly recreated")
	}
	if err := b.removeNode("video0"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(host); err != nil {
		t.Fatal("removing private link modified host file", err)
	}
}

func TestAliasDirectoriesCannotRedirectWritesOutsideDev(t *testing.T) {
	b := &linuxBackend{target: t.TempDir()}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(b.target, "v4l")); err != nil {
		t.Fatal(err)
	}
	if _, err := b.ensureAlias("usb-camera", "video0"); err == nil {
		t.Fatal("symlink directory accepted")
	}
	entries, err := os.ReadDir(outside)
	if err != nil || len(entries) != 0 {
		t.Fatal("write escaped device directory")
	}
}

func TestForeignAliasIsPreserved(t *testing.T) {
	b := &linuxBackend{target: t.TempDir()}
	if _, err := b.ensureAlias("usb-camera", "video0"); err != nil {
		t.Fatal(err)
	}
	if err := b.removeAlias("usb-camera", "video2"); err == nil {
		t.Fatal("foreign alias was removed")
	}
	if _, err := b.ensureAlias("usb-camera", "video2"); err == nil {
		t.Fatal("foreign alias was overwritten")
	}
}

// Opt-in acceptance check for a real Linux Docker host; CI has no cameras.
func TestHardwareInitialSync(t *testing.T) {
	source := os.Getenv("RESTREAMER_VIDEO_HOTPLUG_SOURCE")
	if source == "" {
		t.Skip("requires a read-only host /dev mount and V4L2 cgroup access")
	}
	b, err := newBackend(source, "/dev")
	if err != nil {
		t.Fatal(err)
	}
	wanted, err := b.scan(empty())
	if err != nil || len(wanted.Nodes) == 0 {
		t.Fatal("no capture cameras discovered", err)
	}
	stop, err := Start(source, func(message string, err error) { t.Log(message, err) })
	if err != nil {
		t.Fatal(err)
	}
	defer stop()
	for name, n := range wanted.Nodes {
		fd, err := unix.Open(filepath.Join("/dev", name), unix.O_RDWR|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
		if err != nil {
			t.Fatal("capture link cannot be opened read/write", name, err)
		}
		var actual unix.Stat_t
		err = unix.Fstat(fd, &actual)
		unix.Close(fd)
		if err != nil || unix.Major(actual.Rdev) != 81 || unix.Minor(actual.Rdev) != n.Minor || actual.Gid != n.GID {
			t.Fatal("capture link points to incorrect device", name, err)
		}
	}
	for name, target := range wanted.Aliases {
		actual, err := os.Readlink(filepath.Join("/dev/v4l/by-id", name))
		if err != nil || actual != "../../"+target {
			t.Fatal("stable alias not mirrored", name, actual, err)
		}
	}
	t.Logf("verified %d capture nodes and %d stable aliases", len(wanted.Nodes), len(wanted.Aliases))
}
