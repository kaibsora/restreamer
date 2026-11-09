package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	echoSwagger "github.com/swaggo/echo-swagger"
)

func renderSwaggerIndex(t *testing.T, handler echo.HandlerFunc) string {
	t.Helper()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/swagger/index.html", nil)
	rec := httptest.NewRecorder()

	require.NoError(t, handler(e.NewContext(req, rec)))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Header().Get(echo.HeaderContentType), "text/html")

	return rec.Body.String()
}

func TestSwaggerAutoBearerAuth(t *testing.T) {
	t.Run("enabled", func(t *testing.T) {
		body := renderSwaggerIndex(t, echoSwagger.EchoWrapHandler(
			echoSwagger.AutoBearerAuth(true),
		))

		require.Contains(t, body, "requestInterceptor: function(request)")
		require.Contains(t, body, `request.headers[headerName] = "Bearer " + authorization`)
		require.Contains(t, body, `!/^[A-Za-z][A-Za-z0-9+.-]*\s+/.test(authorization)`)
	})

	t.Run("disabled by default", func(t *testing.T) {
		body := renderSwaggerIndex(t, echoSwagger.EchoWrapHandler())

		require.NotContains(t, body, "requestInterceptor: function(request)")
	})
}
