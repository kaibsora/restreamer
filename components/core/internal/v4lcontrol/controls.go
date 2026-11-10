// Package v4lcontrol exposes driver-reported camera controls without spawning
// external programs. Controls change the physical device, not FFmpeg options.
package v4lcontrol

import (
	"errors"
	"fmt"
	"regexp"
)

var ErrUnsupported = errors.New("V4L2 controls require Linux")
var devicePath = regexp.MustCompile(`^/dev/(video[0-9]+|v4l/by-(id|path)/[A-Za-z0-9_.:+-]+)$`)

type Choice struct {
	Value int64  `json:"value"`
	Name  string `json:"name"`
}

type Control struct {
	ID        uint32   `json:"id"`
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Minimum   int64    `json:"minimum"`
	Maximum   int64    `json:"maximum"`
	Step      int64    `json:"step"`
	Default   int64    `json:"default"`
	Value     *int64   `json:"value"`
	ReadOnly  bool     `json:"read_only"`
	Inactive  bool     `json:"inactive"`
	Supported bool     `json:"supported"`
	Choices   []Choice `json:"choices"`
}

func validPath(path string) bool {
	return devicePath.MatchString(path) && path != "/dev/v4l/by-id/." && path != "/dev/v4l/by-id/.." && path != "/dev/v4l/by-path/." && path != "/dev/v4l/by-path/.."
}

func validateValue(c Control, value int64) error {
	if !c.Supported || c.ReadOnly || c.Inactive {
		return fmt.Errorf("control is unsupported, read-only, or currently inactive")
	}
	if c.Type == "button" {
		return nil
	}
	if value < c.Minimum || value > c.Maximum {
		return fmt.Errorf("value must be between %d and %d", c.Minimum, c.Maximum)
	}
	if c.Type == "bitmask" && value & ^c.Maximum != 0 {
		return fmt.Errorf("value contains unsupported bits")
	}
	if c.Step > 0 && (value-c.Minimum)%c.Step != 0 {
		return fmt.Errorf("value must follow step %d", c.Step)
	}
	if c.Type == "menu" || c.Type == "integer_menu" {
		for _, choice := range c.Choices {
			if choice.Value == value {
				return nil
			}
		}
		return fmt.Errorf("value is not an available menu choice")
	}
	return nil
}
