//go:build !linux

package videohotplug

import "fmt"

func newBackend(source, target string) (backend, error) {
	return nil, fmt.Errorf("USB camera hot-plug requires Linux")
}
