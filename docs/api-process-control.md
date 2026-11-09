# Start and stop streams through the API

Restreamer exposes process controls for an ingest, snapshot, or publication through
the Core REST API. This is useful when many cameras should release CPU, GPU, USB, or
network resources while they are not being viewed.

The API controls an entire FFmpeg process. It does not pause only one output inside
a multi-output ingest process. Stopping an ingest therefore stops every output
produced by that ingest; stopping a publication affects only that publication.

## Authentication

Set the Restreamer URL once for the examples:

```bash
RESTREAMER_URL=https://restreamer.example.com
```

When API authentication is disabled, omit the `Authorization` header shown below.
When authentication is enabled, exchange the configured Restreamer username and
password for a short-lived access token:

```bash
RESTREAMER_USERNAME=admin
printf 'Restreamer password: ' >&2
read -r -s RESTREAMER_PASSWORD
printf '\n' >&2
export RESTREAMER_PASSWORD

ACCESS_TOKEN="$(
  curl --fail --silent --show-error \
    --request POST "${RESTREAMER_URL}/api/login" \
    --header 'Content-Type: application/json' \
    --data "$(
      jq --null-input \
        --arg username "${RESTREAMER_USERNAME}" \
        --arg password "${RESTREAMER_PASSWORD}" \
        '{username: $username, password: $password}'
    )" \
  | jq --raw-output '.access_token'
)"
unset RESTREAMER_PASSWORD
```

Use TLS for a remotely accessible API. The login request contains the password, and
sending it over plain HTTP would turn authentication into performance art.

For the remaining examples, define a small wrapper:

```bash
restreamer_api() {
  local auth_args=()
  if [[ -n "${ACCESS_TOKEN:-}" ]]; then
    auth_args+=(--header "Authorization: Bearer ${ACCESS_TOKEN}")
  fi

  curl --fail --silent --show-error \
    "${auth_args[@]}" \
    "$@"
}
```

Leave `ACCESS_TOKEN` unset when API authentication is disabled; the wrapper then
omits the authorization header.

## Find a process ID

List the process ID, channel reference, display name, current order, and execution
state:

```bash
restreamer_api \
  "${RESTREAMER_URL}/api/v3/process?filter=state,metadata" \
| jq --raw-output '.[] | [
    .id,
    .reference,
    (.metadata.name // ""),
    (.state.order // ""),
    (.state.exec // "")
  ] | @tsv'
```

Restreamer UI process IDs follow these conventions:

- `restreamer-ui:ingest:<channel UUID>` is the channel ingest;
- `restreamer-ui:ingest:<channel UUID>_snapshot` is its snapshot process;
- `restreamer-ui:egress:<service>:<UUID>` is one publication;
- `reference` contains the channel UUID for its ingest and publications.

To list only publications for a known channel UUID:

```bash
CHANNEL_ID=00000000-0000-0000-0000-000000000000

restreamer_api \
  "${RESTREAMER_URL}/api/v3/process?filter=state,metadata&reference=${CHANNEL_ID}" \
| jq '.[] | select(.id | startswith("restreamer-ui:egress:"))'
```

Use the process `metadata.name` field to distinguish multiple publications of the
same service. Do not derive a publication ID from its position in the web interface;
the UUID is deliberately less imaginative than that.

## Stop, start, restart, or reload

Set the exact process ID returned by the listing call:

```bash
PROCESS_ID='restreamer-ui:egress:rtmp:00000000-0000-0000-0000-000000000000'
```

Stop the process:

```bash
restreamer_api \
  --request PUT \
  --header 'Content-Type: application/json' \
  --data '{"command":"stop"}' \
  "${RESTREAMER_URL}/api/v3/process/${PROCESS_ID}/command"
```

Start it again by changing the command to `start`:

```bash
restreamer_api \
  --request PUT \
  --header 'Content-Type: application/json' \
  --data '{"command":"start"}' \
  "${RESTREAMER_URL}/api/v3/process/${PROCESS_ID}/command"
```

The same endpoint accepts `restart` and `reload`. A command returning HTTP 200 means
the command was accepted; confirm the resulting state rather than assuming FFmpeg
successfully connected to a camera or publication target:

```bash
restreamer_api \
  "${RESTREAMER_URL}/api/v3/process/${PROCESS_ID}/state" \
| jq '{order, exec, last_logline, reconnect_seconds}'
```

The desired state is in `order`; the actual lifecycle is in `exec`. For example,
`order: start` with `exec: failed` or `exec: starting` is not a healthy running
stream. Inspect `/api/v3/process/${PROCESS_ID}/report` when the state does not settle
at `running`.

## Operational cautions

- Stopping a process does not change its `autostart` configuration. An application
  or container restart can start an autostart-enabled process again.
- URL-encode a process ID if it comes from outside Restreamer's normal ID format.
- Keep the API and Swagger UI behind authentication and the reverse proxy. The
  process API can expose camera URLs and command details in its state and reports.
- The interactive API reference is available at `/api/swagger/index.html` on a
  running instance.

