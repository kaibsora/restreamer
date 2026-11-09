package skills

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// DevicesV4L returns a list of available V4L devices
func DevicesV4L() ([]HWDevice, error) {
	cmd := exec.Command("v4l2-ctl", "--list-devices")
	cmd.Env = []string{}
	output, commandErr := cmd.Output()

	devices := parseV4LDevices(bytes.NewBuffer(output))
	paths, globErr := filepath.Glob("/dev/video*")
	if globErr == nil {
		devices = addV4LDevicePaths(devices, paths)
	}

	if len(devices) != 0 {
		return devices, nil
	}

	if commandErr != nil {
		return devices, fmt.Errorf("list V4L devices: %w", commandErr)
	}

	return devices, globErr
}

func addV4LDevicePaths(devices []HWDevice, paths []string) []HWDevice {
	reDevice := regexp.MustCompile(`^video[0-9]+$`)
	known := make(map[string]struct{}, len(devices))

	for _, device := range devices {
		known[device.Id] = struct{}{}
	}

	for _, path := range paths {
		path = filepath.Clean(path)
		name := filepath.Base(path)
		if !reDevice.MatchString(name) {
			continue
		}
		if _, ok := known[path]; ok {
			continue
		}

		devices = append(devices, HWDevice{
			Id:    path,
			Name:  "Video device " + name,
			Media: "video",
		})
		known[path] = struct{}{}
	}

	return devices
}

func parseV4LDevices(data *bytes.Buffer) []HWDevice {
	devices := []HWDevice{}

	reName := regexp.MustCompile(`^(.*)\((.*?)\):$`)
	reDevice := regexp.MustCompile(`/dev/video[0-9]+`)

	name := ""
	extra := ""

	scanner := bufio.NewScanner(data)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		line := scanner.Text()

		matches := reDevice.FindStringSubmatch(line)
		if matches == nil {
			matches = reName.FindStringSubmatch(line)
			if matches == nil {
				continue
			}

			name = strings.TrimSpace(matches[1])
			extra = matches[2]

			continue
		}

		if name == "" {
			continue
		}

		device := HWDevice{
			Id:    matches[0],
			Name:  name,
			Extra: extra,
			Media: "video",
		}

		devices = append(devices, device)
	}

	return devices
}
