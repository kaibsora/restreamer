// Package videohotplug mirrors capture devices from a read-only host /dev mount.
package videohotplug

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

type node struct {
	Minor      uint32
	GID        uint32
	Generation string
}

type snapshot struct {
	Nodes   map[string]node
	Aliases map[string]string
}

func empty() snapshot { return snapshot{Nodes: map[string]node{}, Aliases: map[string]string{}} }

type backend interface {
	scan(snapshot) (snapshot, error)
	ensureNode(string) (bool, error)
	removeNode(string) error
	ensureAlias(string, string) (bool, error)
	removeAlias(string, string) error
}

type watcher struct {
	backend   backend
	owned     snapshot
	statefile string
	dirty     bool
}

// Start performs the first synchronization before Core probes devices or starts
// channels. Subsequent checks run inside Core, without a subprocess or host agent.
// The returned function stops the watcher and waits for it to exit.
func Start(source string, report func(string, error)) (func(), error) {
	if source == "" {
		return func() {}, nil
	}
	if report == nil {
		report = func(string, error) {}
	}
	b, err := newBackend(source, "/dev")
	if err != nil {
		return nil, err
	}
	w := &watcher{backend: b, owned: empty(), statefile: "/run/restreamer-video-hotplug.json"}
	if data, err := os.ReadFile(w.statefile); err == nil {
		if err := json.Unmarshal(data, &w.owned); err != nil {
			return nil, fmt.Errorf("read camera state: %w", err)
		}
		if w.owned.Nodes == nil {
			w.owned.Nodes = map[string]node{}
		}
		if w.owned.Aliases == nil {
			w.owned.Aliases = map[string]string{}
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	if _, err := w.sync(); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	report(fmt.Sprintf("USB camera hot-plug enabled: %d capture devices", len(w.owned.Nodes)), nil)
	go func() {
		defer close(done)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		lastError := ""
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				changed, err := w.sync()
				if err != nil {
					if err.Error() != lastError {
						report("USB camera synchronization failed; retrying", err)
					}
					lastError = err.Error()
				} else {
					if changed || lastError != "" {
						report(fmt.Sprintf("USB cameras synchronized: %d capture devices", len(w.owned.Nodes)), nil)
					}
					lastError = ""
				}
			}
		}
	}()
	return func() { cancel(); <-done }, nil
}

func (w *watcher) sync() (bool, error) {
	desired, err := w.backend.scan(w.owned)
	if err != nil {
		return false, err
	} // Never remove devices after a failed scan.
	changed := false
	var failures []error
	for name, target := range w.owned.Aliases {
		if desired.Aliases[name] == target {
			continue
		}
		if err := w.backend.removeAlias(name, target); err != nil {
			failures = append(failures, err)
			continue
		}
		delete(w.owned.Aliases, name)
		changed = true
	}
	for name := range w.owned.Nodes {
		if _, found := desired.Nodes[name]; found {
			continue
		}
		if err := w.backend.removeNode(name); err != nil {
			failures = append(failures, err)
			continue
		}
		delete(w.owned.Nodes, name)
		changed = true
	}
	for name, current := range desired.Nodes {
		previous, found := w.owned.Nodes[name]
		updated, err := w.backend.ensureNode(name)
		if err != nil {
			failures = append(failures, err)
			continue
		}
		w.owned.Nodes[name] = current
		changed = changed || updated || !found || previous != current
	}
	for name, target := range desired.Aliases {
		current, found := w.owned.Nodes[target]
		wanted, desiredNode := desired.Nodes[target]
		if !desiredNode || !found || current != wanted {
			continue
		}
		// A changed alias must first be removed with its old ownership checked.
		if old, found := w.owned.Aliases[name]; found && old != target {
			continue
		}
		updated, err := w.backend.ensureAlias(name, target)
		if err != nil {
			failures = append(failures, err)
			continue
		}
		changed = changed || updated || w.owned.Aliases[name] != target
		w.owned.Aliases[name] = target
	}
	w.dirty = w.dirty || changed
	if w.dirty && w.statefile != "" {
		data, err := json.Marshal(w.owned)
		if err == nil {
			var f *os.File
			f, err = os.CreateTemp(filepath.Dir(w.statefile), ".video-hotplug-*")
			if err == nil {
				tmp := f.Name()
				_, err = f.Write(data)
				closeErr := f.Close()
				if err == nil {
					err = closeErr
				}
				if err == nil {
					err = os.Rename(tmp, w.statefile)
				}
				if err != nil {
					os.Remove(tmp)
				}
			}
		}
		if err != nil {
			failures = append(failures, fmt.Errorf("save camera state: %w", err))
		} else {
			w.dirty = false
		}
	}
	sort.Slice(failures, func(i, j int) bool { return failures[i].Error() < failures[j].Error() })
	return changed, errors.Join(failures...)
}
