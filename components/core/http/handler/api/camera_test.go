package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

func TestCameraRejectsNonCameraPath(t *testing.T) {
	e := echo.New()
	h := &RestreamHandler{}
	req := httptest.NewRequest(http.MethodGet, "/camera/controls?device=/etc/passwd", nil)
	err := h.CameraControls(e.NewContext(req, httptest.NewRecorder()))
	require.Error(t, err)
	require.Error(t, h.CameraModes(e.NewContext(req, httptest.NewRecorder())))
}

func TestCameraControlRejectsInvalidValues(t *testing.T) {
	for _, body := range []string{`{}`, `{"device":"/dev/video0","id":1,"value":1.5}`, `{"device":"/dev/null","id":1,"value":0}`} {
		e := echo.New()
		req := httptest.NewRequest(http.MethodPut, "/camera/controls", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		require.Error(t, (&RestreamHandler{}).SetCameraControl(e.NewContext(req, httptest.NewRecorder())))
	}
}
