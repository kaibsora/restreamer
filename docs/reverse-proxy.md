# Reverse proxy and TLS

Restreamer should normally listen on its private HTTP port while a reverse proxy
terminates TLS. Use a dedicated hostname, such as `restream.example.com`, and proxy
that hostname's complete path space to port 8080.

The UI, API, player, and storage routes use root-relative paths including `/ui/`,
`/api/`, `/memfs/`, and `/data/`. Publishing Restreamer below a path such as
`https://example.com/restreamer/` is therefore unsupported. Rewriting only the HTML
request produces an attractive login page whose API calls escape to `/api`; apparently
the browser remains unwilling to infer the rest of the configuration telepathically.

Forward the original `Host` header and the client/protocol forwarding headers. Do not
replace `Origin` or `Referer` with the private upstream address. Those headers describe
the public browser origin and falsifying them can break authentication, CORS, and HLS
session accounting.

## NGINX

The following server blocks redirect clear-text requests and proxy a dedicated HTTPS
hostname. Replace the certificate paths and hostname for the deployment:

```nginx
server {
    listen 80;
    server_name restream.example.com;
    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name restream.example.com;

    ssl_certificate     /etc/letsencrypt/live/restream.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/restream.example.com/privkey.pem;

    # Loop-source uploads may be large. Keep a finite site-specific limit if the
    # proxy is exposed to untrusted uploaders.
    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

The public player uses HLS, so the proxy must not cache live `.m3u8` playlists unless
its cache rules explicitly understand live media. A CDN may cache immutable segments,
but playlist caching can turn a live printer into a historical documentary.

## Caddy

Caddy obtains and renews a public certificate automatically when DNS and ports 80/443
reach the server:

```caddyfile
restream.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Set an explicit request-body limit only if local policy requires one. Caddy preserves
the original host and supplies the normal `X-Forwarded-*` headers by default.

## IIS with Application Request Routing

Install URL Rewrite and Application Request Routing (ARR), enable proxying, bind the
site to its own hostname, set **Preserve host header** to `true`, and allow the
`HTTP_X_FORWARDED_PROTO` server variable at the IIS server level. The rewrite rule must
match the site root rather than a `/restreamer/` prefix:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <proxy enabled="true" preserveHostHeader="true" />
    <rewrite>
      <rules>
        <rule name="Restreamer" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:8080/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Do not add rules that replace `HTTP_ORIGIN` or `HTTP_REFERER` with
`http://127.0.0.1:8080`. If IIS returns a 403 while direct access succeeds, first
confirm that `/api`, `/api/login`, `/ui/`, `/memfs/`, and `/data/` all reach the same
Restreamer upstream and that ARR is not applying Windows authentication to API paths.

## Security boundary

- Enable Restreamer's API/JWT authentication before exposing the admin UI.
- Restrict `/ui/` at the proxy or firewall when only the public player should be
  internet-accessible.
- Do not expose MediaMTX RTSP, RTP, RTCP, API, metrics, or WebRTC ICE ports through
  the public proxy. Those ports belong on the trusted printer LAN.
- Preserve real client addresses in proxy logs and apply rate limits there.
- Verify `https://restream.example.com/ping`, `/ui/`, and `/api` after deployment.

The image also defines a Docker health check against `/ping`. `docker inspect
restreamer --format '{{.State.Health.Status}}'` should report `healthy`; this tests the
Core HTTP listener independently of the external proxy and makes it considerably less
tempting to debug certificates when the application simply has not started.
