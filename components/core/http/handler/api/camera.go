package api

import (
	"net/http"

	"github.com/datarhei/core/v16/http/api"
	"github.com/datarhei/core/v16/http/handler/util"
	"github.com/datarhei/core/v16/internal/v4lcontrol"
	"github.com/labstack/echo/v4"
)

// CameraControls reads the selected capture device's driver-reported controls.
// This endpoint is registered in the authenticated v3 group.
func (h *RestreamHandler) CameraControls(c echo.Context) error {
	controls, err := v4lcontrol.List(c.QueryParam("device"))
	if err != nil {
		return api.Err(http.StatusBadRequest, "Cannot read camera controls", "%s", err)
	}
	return c.JSON(http.StatusOK, controls)
}

func (h *RestreamHandler) SetCameraControl(c echo.Context) error {
	var request struct {
		Device string `json:"device"`
		ID     uint32 `json:"id"`
		Value  *int64 `json:"value"`
	}
	if err := util.ShouldBindJSON(c, &request); err != nil || request.Value == nil {
		return api.Err(http.StatusBadRequest, "Expected a camera device, control ID and integer value")
	}
	controls, err := v4lcontrol.Set(request.Device, request.ID, *request.Value)
	if err != nil {
		return api.Err(http.StatusBadRequest, "Cannot change camera control", "%s", err)
	}
	return c.JSON(http.StatusOK, controls)
}
