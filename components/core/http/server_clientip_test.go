package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	mwsession "github.com/datarhei/core/v16/http/middleware/session"
	corenet "github.com/datarhei/core/v16/net"
	coresession "github.com/datarhei/core/v16/session"
	"github.com/labstack/echo/v4"
	"github.com/lithammer/shortuuid/v4"
	"github.com/stretchr/testify/require"
)

func TestClientIPExtractor(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		forwarded  string
		expected   string
	}{
		{
			name:       "direct request",
			remoteAddr: "198.51.100.10:4321",
			expected:   "198.51.100.10",
		},
		{
			name:       "private reverse proxy",
			remoteAddr: "10.0.0.2:4321",
			forwarded:  "203.0.113.40",
			expected:   "203.0.113.40",
		},
		{
			name:       "private reverse proxy chain",
			remoteAddr: "172.20.0.2:4321",
			forwarded:  "203.0.113.40, 10.0.0.3",
			expected:   "203.0.113.40",
		},
		{
			name:       "public peer cannot forge forwarded address",
			remoteAddr: "198.51.100.10:4321",
			forwarded:  "127.0.0.1",
			expected:   "198.51.100.10",
		},
		{
			name:       "malformed chain falls back to immediate peer",
			remoteAddr: "10.0.0.2:4321",
			forwarded:  "not-an-ip",
			expected:   "10.0.0.2",
		},
	}

	extract := clientIPExtractor()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/memfs/live.m3u8", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.forwarded != "" {
				req.Header.Set("X-Forwarded-For", tt.forwarded)
			}

			require.Equal(t, tt.expected, extract(req))
		})
	}
}

func TestForwardedClientControlsHLSViewerIgnoreList(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		forwarded  string
		ignore     string
		collected  bool
	}{
		{
			name:       "ignored private proxy does not hide public viewer",
			remoteAddr: "10.0.0.2:4321",
			forwarded:  "203.0.113.40",
			ignore:     "10.0.0.0/8",
			collected:  true,
		},
		{
			name:       "public peer cannot forge an ignored loopback viewer",
			remoteAddr: "198.51.100.10:4321",
			forwarded:  "127.0.0.1",
			ignore:     "127.0.0.0/8",
			collected:  true,
		},
		{
			name:       "forwarded ignored viewer remains ignored",
			remoteAddr: "10.0.0.2:4321",
			forwarded:  "203.0.113.40",
			ignore:     "203.0.113.0/24",
			collected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter, err := corenet.NewIPLimiter([]string{tt.ignore}, nil)
			require.NoError(t, err)

			collector := coresession.NewCollector(coresession.CollectorConfig{
				Limiter:         limiter,
				SessionTimeout:  time.Second,
				InactiveTimeout: time.Second,
			})
			defer collector.Stop()

			e := echo.New()
			e.IPExtractor = clientIPExtractor()
			e.Use(mwsession.NewHLSWithConfig(mwsession.HLSConfig{
				EgressCollector: collector,
			}))
			e.GET("/*", func(c echo.Context) error {
				return c.String(http.StatusOK, "#EXTM3U\n#EXTINF:1,\nlive.ts\n")
			})

			sessionID := shortuuid.New()
			req := httptest.NewRequest(http.MethodGet, "/memfs/live.m3u8?session="+sessionID, nil)
			req.RemoteAddr = tt.remoteAddr
			req.Header.Set("X-Forwarded-For", tt.forwarded)
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, tt.collected, collector.IsKnownSession(sessionID))
		})
	}
}
