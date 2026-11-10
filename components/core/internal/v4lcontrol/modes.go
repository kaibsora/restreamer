package v4lcontrol

type SizeRange struct {
	MinimumWidth  uint32 `json:"minimum_width"`
	MaximumWidth  uint32 `json:"maximum_width"`
	StepWidth     uint32 `json:"step_width"`
	MinimumHeight uint32 `json:"minimum_height"`
	MaximumHeight uint32 `json:"maximum_height"`
	StepHeight    uint32 `json:"step_height"`
}

type IntervalRange struct {
	Minimum [2]uint32 `json:"minimum"` // numerator/denominator, in seconds
	Maximum [2]uint32 `json:"maximum"`
	Step    [2]uint32 `json:"step"`
}

type CaptureSize struct {
	Width         uint32         `json:"width"`
	Height        uint32         `json:"height"`
	FrameRates    []string       `json:"frame_rates"` // Exact FFmpeg rational rates.
	IntervalRange *IntervalRange `json:"interval_range,omitempty"`
}

type CaptureFormat struct {
	FourCC      string        `json:"fourcc"`
	Name        string        `json:"name"`
	InputFormat string        `json:"input_format"`
	Compressed  bool          `json:"compressed"`
	Sizes       []CaptureSize `json:"sizes"`
	SizeRange   *SizeRange    `json:"size_range,omitempty"`
}

func inputFormat(fourcc string) string {
	return map[string]string{"MJPG": "mjpeg", "JPEG": "mjpeg", "H264": "h264", "HEVC": "hevc", "YUYV": "yuyv422", "UYVY": "uyvy422", "NV12": "nv12", "NV21": "nv21", "YU12": "yuv420p", "RGB3": "rgb24", "BGR3": "bgr24", "GREY": "gray"}[fourcc]
}
