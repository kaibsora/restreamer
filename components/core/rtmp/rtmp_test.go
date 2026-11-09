package rtmp

import (
	"bytes"
	"encoding/binary"
	"io"
	"net"
	"net/url"
	"testing"
	"time"

	joyrtmp "github.com/datarhei/joy4/format/rtmp"
	"github.com/stretchr/testify/require"
)

func TestToken(t *testing.T) {
	data := [][]string{
		{"/foo/bar", "/foo", "bar"},
		{"/foo/bar?token=abc", "/foo/bar", "abc"},
		{"/foo/bar/abc", "/foo/bar", "abc"},
	}

	for _, d := range data {
		u, err := url.Parse(d[0])
		require.NoError(t, err)

		path, token := getToken(u)

		require.Equal(t, d[1], path, "url=%s", u.String())
		require.Equal(t, d[2], token, "url=%s", u.String())
	}
}

func TestSimpleHandshakeEchoesC1InS2(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer clientConn.Close()

	deadline := time.Now().Add(2 * time.Second)
	require.NoError(t, serverConn.SetDeadline(deadline))
	require.NoError(t, clientConn.SetDeadline(deadline))

	server := &joyrtmp.Server{}
	result := make(chan error, 1)
	go func() {
		result <- server.HandleNetConn(serverConn)
	}()

	// C0 + C1 for the version-3 simple handshake. The second C1 word is
	// zero, which distinguishes this path from Adobe's complex handshake.
	c0c1 := make([]byte, 1+1536)
	c0c1[0] = 3
	c1 := c0c1[1:]
	binary.BigEndian.PutUint32(c1[0:4], 0x11223344)
	for i := 8; i < len(c1); i++ {
		c1[i] = byte(i)
	}

	_, err := clientConn.Write(c0c1)
	require.NoError(t, err)

	s0s1s2 := make([]byte, 1+1536+1536)
	_, err = io.ReadFull(clientConn, s0s1s2)
	require.NoError(t, err)

	s1 := s0s1s2[1 : 1+1536]
	s2 := s0s1s2[1+1536:]
	require.Equal(t, byte(3), s0s1s2[0])
	require.Equal(t, uint32(0), binary.BigEndian.Uint32(s1[4:8]))
	require.False(t, bytes.Equal(c1[8:], s1[8:]), "S1 must contain server random data")
	require.Equal(t, c1, s2, "S2 must echo C1 for a simple RTMP handshake")

	// Complete C2 so the server exits the handshake and moves on to the
	// connect command. Closing the pipe then ends that read cleanly.
	_, err = clientConn.Write(s1)
	require.NoError(t, err)
	require.NoError(t, clientConn.Close())

	select {
	case <-result:
	case <-time.After(time.Second):
		t.Fatal("RTMP server did not finish after the test client closed")
	}
}
