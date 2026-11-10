package videohotplug

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

type fakeBackend struct {
	desired                snapshot
	actual                 snapshot
	scanError, createError error
}

func TestDisabledWatcherNeedsNoHostMount(t *testing.T) {
	stop, err := Start("", nil)
	if err != nil || stop == nil {
		t.Fatal("disabled watcher must allow ordinary startup", err)
	}
	stop()
}

func fake() *fakeBackend                               { return &fakeBackend{desired: empty(), actual: empty()} }
func (b *fakeBackend) scan(snapshot) (snapshot, error) { return b.desired, b.scanError }
func (b *fakeBackend) ensureNode(name string) (bool, error) {
	if b.createError != nil {
		return false, b.createError
	}
	_, found := b.actual.Nodes[name]
	b.actual.Nodes[name] = b.desired.Nodes[name]
	return !found, nil
}
func (b *fakeBackend) removeNode(name string) error { delete(b.actual.Nodes, name); return nil }
func (b *fakeBackend) ensureAlias(name, target string) (bool, error) {
	changed := b.actual.Aliases[name] != target
	b.actual.Aliases[name] = target
	return changed, nil
}
func (b *fakeBackend) removeAlias(name, _ string) error { delete(b.actual.Aliases, name); return nil }
func mustSync(t *testing.T, w *watcher) {
	t.Helper()
	if _, err := w.sync(); err != nil {
		t.Fatal(err)
	}
}

func TestReconnectMovesStableAliasAndOnlyRemovesManagedNodes(t *testing.T) {
	b := fake()
	b.actual.Nodes["unmanaged"] = node{}
	w := &watcher{backend: b, owned: empty()}
	b.desired.Nodes["video0"] = node{Minor: 0, Generation: "first"}
	b.desired.Aliases["usb-camera"] = "video0"
	mustSync(t, w)
	b.desired = empty()
	mustSync(t, w)
	if len(b.actual.Aliases) != 0 || len(b.actual.Nodes) != 1 {
		t.Fatal("unplug failed or unrelated node was removed", b.actual)
	}
	b.desired.Nodes["video2"] = node{Minor: 2, Generation: "second"}
	b.desired.Aliases["usb-camera"] = "video2"
	mustSync(t, w)
	if b.actual.Aliases["usb-camera"] != "video2" {
		t.Fatal("stable alias did not follow replug")
	}
}

func TestFastReplugReusingMinorTracksNewHostGeneration(t *testing.T) {
	b := fake()
	w := &watcher{backend: b, owned: empty()}
	b.desired.Nodes["video0"] = node{Generation: "old"}
	mustSync(t, w)
	b.desired.Nodes["video0"] = node{Generation: "new"}
	mustSync(t, w)
	if w.owned.Nodes["video0"].Generation != "new" {
		t.Fatal("host inode change was not recorded")
	}
	if changed, err := w.sync(); changed || err != nil {
		t.Fatal("unchanged snapshot should be idle", changed, err)
	}
}

func TestScanFailurePreservesExistingDevices(t *testing.T) {
	b := fake()
	w := &watcher{backend: b, owned: empty()}
	b.desired.Nodes["video0"] = node{}
	mustSync(t, w)
	b.desired = empty()
	b.scanError = errors.New("host device mount unavailable")
	if _, err := w.sync(); err == nil {
		t.Fatal("scan failure was ignored")
	}
	if _, found := b.actual.Nodes["video0"]; !found {
		t.Fatal("scan failure removed live device")
	}
}

func TestFailedDeviceCreationRetriesWithoutPublishingAlias(t *testing.T) {
	b := fake()
	w := &watcher{backend: b, owned: empty()}
	b.desired.Nodes["video0"] = node{}
	b.desired.Aliases["usb-camera"] = "video0"
	b.createError = errors.New("mknod denied")
	if _, err := w.sync(); err == nil {
		t.Fatal("permission failure was ignored")
	}
	if len(b.actual.Aliases) != 0 {
		t.Fatal("alias published without capture node")
	}
	b.createError = nil
	mustSync(t, w)
	if b.actual.Aliases["usb-camera"] != "video0" {
		t.Fatal("retry did not recover")
	}
}

func TestRestartRepairsMissingNodesAndRemovesStaleSavedDevices(t *testing.T) {
	b := fake()
	statefile := filepath.Join(t.TempDir(), "state.json")
	w := &watcher{backend: b, owned: empty(), statefile: statefile}
	b.desired.Nodes["video0"] = node{Generation: "same host node"}
	b.desired.Nodes["video2"] = node{Minor: 2}
	mustSync(t, w)
	data, err := os.ReadFile(statefile)
	if err != nil {
		t.Fatal(err)
	}
	var saved snapshot
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatal(err)
	}
	// Docker restarted, resetting /dev; one host camera also disappeared.
	b.actual = empty()
	delete(b.desired.Nodes, "video2")
	restarted := &watcher{backend: b, owned: saved, statefile: statefile}
	mustSync(t, restarted)
	if _, found := b.actual.Nodes["video0"]; !found {
		t.Fatal("restart failed to recreate capture node")
	}
	if _, found := restarted.owned.Nodes["video2"]; found {
		t.Fatal("stale camera persisted after restart")
	}
}

func TestFailedStateWriteIsRetriedEvenWithoutDeviceChanges(t *testing.T) {
	b := fake()
	directory := filepath.Join(t.TempDir(), "later")
	w := &watcher{backend: b, owned: empty(), statefile: filepath.Join(directory, "state.json")}
	b.desired.Nodes["video0"] = node{}
	if _, err := w.sync(); err == nil {
		t.Fatal("missing state directory should fail")
	}
	if err := os.Mkdir(directory, 0700); err != nil {
		t.Fatal(err)
	}
	mustSync(t, w)
	if _, err := os.Stat(w.statefile); err != nil {
		t.Fatal("state was not retried", err)
	}
}
