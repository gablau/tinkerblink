# App ↔ server protocol (Blynk Legacy)

This page describes the protocol between a mobile app and a **Blynk Legacy server** (blynk-server 0.41.x), as
implemented by the server and by `@tinkerblink/protocol` (`protocol/src`). The server source is the only
reference: class names below are from [blynk-server](https://github.com/blynkkk/blynk-server) v0.41.17
(fork: [gablau/blynk-server](https://github.com/gablau/blynk-server)), mostly under
`server/core/.../protocol` and `server/tcp-app-server/.../handlers/main/logic`.

All integers are **big-endian**. Message bodies are UTF-8 strings whose fields are separated by `\0`
(`StringUtils.BODY_SEPARATOR`). A target is written `<dashId>-<deviceId>` (`DEVICE_SEPARATOR` is `-`).

## Transports

| Transport | Where | Header | Server classes |
|---|---|---|---|
| TCP + TLS | `https.port` (default **9443**) | 7 bytes | `MobileMessageDecoder` / `MobileMessageEncoder` |
| WebSocket | `wss://<host>:9443/dashws`, or behind a reverse proxy on 443 | 3 bytes | `WSMessageDecoder` / `WSMessageEncoder` |
| Hardware TCP | `http.port` (default 8080), plain | 5 bytes | `MessageDecoder` / `MessageEncoder` |

`MobileAndHttpsServer` serves TLS app connections, HTTPS, the admin panel and WebSockets on the same port, and
chooses the pipeline from the first bytes / the HTTP path: `/dashws` (`WEBSOCKET_WEB_PATH`) is the **app**
WebSocket; `/websocket` and `/websockets` are hardware WebSockets (5-byte header), used for example by Node-RED
clients.

TinkerBlink uses the `/dashws` WebSocket (`WebSocketTransport`), because it works through an ordinary HTTPS
reverse proxy and in browsers. `@tinkerblink/protocol` also has a TCP transport for Node (`transport-node.ts`).

### TCP: 7-byte header

| Offset | Size | Field |
|---|---|---|
| 0 | u8 | command |
| 1 | u16 | message id |
| 3 | u32 | body length, or the **status code** when command = `RESPONSE` (0) |
| 7 | n | body (absent for `RESPONSE`) |

The server rejects bodies longer than 10,000,000 bytes (`MobileMessageDecoder.validateLength`).

### WebSocket `/dashws`: 3-byte header

One message per **binary** frame: `[command u8][msgId u16][body]`; the length is the frame length. A
`RESPONSE` is `[0][msgId u16][code u32]`. After login the same `MobileHandler` serves TCP and WebSocket
clients, so commands and bodies are identical.

### Hardware: 5-byte header

Like the TCP header but the length is a **u16**. Apps never use it; it is mentioned only because hardware
clients share the same commands (`HARDWARE`, `SET_WIDGET_PROPERTY`, …).

## Login

`LOGIN` (2), body `email\0hash\0os\0version\0appName` (`MobileLoginHandler`):

- `email`: trimmed and lower-cased.
- `hash = Base64(SHA-256(passwordUtf8 || SHA-256(lowerCaseEmailUtf8)))`, standard Base64 with padding
  (`SHA256Util`; `protocol/src/hash.ts`). The server compares it **as is** with the `pass` field of the user.
- `os`: `Android` or `iOS` (`OsType.parse`); used for push notifications.
- `version`: `x.y.z`. The server only uses it in `Version.isOutdated()`, which is true for `1.1.1` alone and
  then sends `OUTDATED_APP_NOTIFICATION` (72). TinkerBlink sends its own version.
- `appName`: must be **`Blynk`** (`AppNameUtil.BLYNK`). Users are stored by email **and** app name, so any
  other value looks up a different (usually missing) user. With only 2–4 fields the server assumes `Blynk`;
  `facebook` selects the Facebook login.

Replies: `RESPONSE` `200` OK, `3` USER_NOT_REGISTERED, `5` USER_NOT_AUTHENTICATED (wrong password), `22`
FACEBOOK_USER_LOGIN_WITH_PASS. On success the server sends `acon` (`BLYNK_INTERNAL`) to the devices of every
active dashboard with `isAppConnectedOn`; when the last app disconnects it sends `adis`
(`MobileChannelStateHandler`).

The newer fork server also answers `6` NOT_ALLOWED (closed registration, Facebook login removed, IP blocked
after too many failed logins). A client must not retry automatically after `5` or `6`, or it keeps itself
blocked; TinkerBlink goes back to the login screen.

## Response codes (`Response.java`)

| Code | Name | | Code | Name |
|---|---|---|---|---|
| 200 | OK | | 9 | INVALID_TOKEN |
| 1 | QUOTA_LIMIT | | 11 | ILLEGAL_COMMAND_BODY |
| 2 | ILLEGAL_COMMAND | | 13–15 | NOTIFICATION_INVALID_BODY / NOT_AUTHORIZED / ERROR |
| 3 | USER_NOT_REGISTERED | | 17 | NO_DATA |
| 4 | USER_ALREADY_REGISTERED | | 19 | SERVER_ERROR |
| 5 | USER_NOT_AUTHENTICATED | | 21 | ENERGY_LIMIT |
| 6 | NOT_ALLOWED | | 22 | FACEBOOK_USER_LOGIN_WITH_PASS |
| 7 | DEVICE_NOT_IN_NETWORK | | | |
| 8 | NO_ACTIVE_DASHBOARD | | | |

## Commands used by the client (`Command.java`, `protocol/src/commands.ts`)

| Code | Command | Body sent | Reply |
|---|---|---|---|
| 2 | LOGIN | see above | `RESPONSE` |
| 6 | PING | empty | `RESPONSE 200` |
| 24 | LOAD_PROFILE_GZIPPED | empty, or `dashId` | binary, compressed JSON |
| 25 | APP_SYNC | `dashId` or `dashId-deviceId` | `RESPONSE 200`, then `APP_SYNC` messages |
| 20 | HARDWARE | `dashId-deviceId\0vw\0pin\0value[\0value…]` | only errors |
| 60 | GET_ENHANCED_GRAPH_DATA | `dashId[-deviceId]\0widgetId\0period[\0page]` | binary, or `NO_DATA` |
| 21 | CREATE_DASH | dashboard JSON | `RESPONSE` |
| 23 | DELETE_DASH | `dashId` | `RESPONSE` |
| 38 | UPDATE_PROJECT_SETTINGS | `dashId\0settingsJson` | `RESPONSE` |
| 7 / 8 | ACTIVATE_DASHBOARD / DEACTIVATE_DASHBOARD | `dashId` | `RESPONSE` |
| 33 | CREATE_WIDGET | `dashId\0widgetJson` | `RESPONSE` |
| 34 | UPDATE_WIDGET | `dashId\0widgetJson` | `RESPONSE` |
| 35 | DELETE_WIDGET | `dashId\0widgetId` | `RESPONSE` |
| 42 | CREATE_DEVICE | `dashId\0deviceJson` | `CREATE_DEVICE` with the device JSON (and its token) |
| 43 / 44 | UPDATE_DEVICE / DELETE_DEVICE | `dashId\0deviceJson` / `dashId\0deviceId` | `RESPONSE` |
| 45 | GET_DEVICES | `dashId` | JSON array of devices |
| 36 | GET_ENERGY | empty | the energy balance as text |
| 70 | GET_WIDGET | `dashId\0widgetId` | widget JSON |

Messages the server sends on its own (their msgId does not belong to a client request):

| Code | Command | Body |
|---|---|---|
| 20 | HARDWARE | `dashId-deviceId\0vw\0pin\0value[\0value…]`: a device wrote a pin |
| 25 | APP_SYNC | same format: another app of the same account wrote a pin |
| 19 | SET_WIDGET_PROPERTY | `dashId-deviceId\0pin\0property\0value` (virtual pins only, `SetWidgetPropertyLogic`) |
| 4 | HARDWARE_CONNECTED | `dashId-deviceId` (`HardwareLoginHandler`) |
| 71 | DEVICE_OFFLINE | `dashId-deviceId`, msgId 0 |
| 72 | OUTDATED_APP_NOTIFICATION | a text message |

Requests and replies are matched by msgId (1–65535, then wrapping). `@tinkerblink/protocol` treats a message as
a reply only if it is a `RESPONSE` or has the same command as the pending request; anything else goes to the
`onMessage` listeners.

## Profile

`LOAD_PROFILE_GZIPPED` with an empty body returns the whole profile (`MobileLoadProfileGzippedLogic`); with a
`dashId` it returns one dashboard. Despite the name the data is **zlib** (`DeflaterOutputStream` in
`JsonParser.gzipProfile`); `fflate.decompressSync` detects the format.

The JSON is `{ dashBoards: [...], pinsStorage: {...} }` (`Profile`). Every dashboard holds its widgets with
their **last value** (`value`, or per-pin values for multi-pin widgets) and its devices with status
(`status`, `connectTime`, `disconnectTime`, …), so a dashboard can be drawn before any other request.
`pinsStorage` maps `"<dashId>-<deviceId>-v<pin>"` to the last value of pins without a dedicated widget. The
server omits empty arrays: the client normalizes missing `widgets`/`devices` to `[]`.

## Live values and pin writes

After login the server forwards **every** pin update of the user's active dashboards, without subscriptions:
`HARDWARE` from devices, `APP_SYNC` from other apps, `SET_WIDGET_PROPERTY` and device status messages.
Multi-value writes append more fields, for example a Map point: `dashId-deviceId\0vw\0pin\0index\0lat\0lon\0name`.

A write from the app (`MobileHardwareLogic`) is `HARDWARE` with body
`dashId-deviceId\0vw\0pin\0value[\0value…]` (`dw`/`aw` for digital and analog pins):

- if the dashboard is **not active** the server ignores it silently;
- the server stores the value in the profile, forwards it to the devices and to the other apps of the
  account (as `APP_SYNC`, same body), but **not** back to the sender: the app updates its own UI;
- there is **no reply** on success; on failure a `RESPONSE` with the same msgId, for example `7`
  DEVICE_NOT_IN_NETWORK when no device is connected (not sent if the dashboard has `isNotificationsOff`). The
  fork server answers `6` NOT_ALLOWED on read-only assigned projects.

`LegacyClient.writePin()` sends without waiting (`send()`) and returns the msgId so that a later error can be
matched to the widget.

## Dashboard sync: `APP_SYNC` (25)

Sent by the app with body `dashId` (or `dashId-deviceId`) after login and after every reconnection
(`MobileSyncLogic`). The server replies `200`, then sends one `APP_SYNC` per widget value and per stored pin,
all with msgId **1111** (`MobileSyncWidget.SYNC_DEFAULT_MESSAGE_ID`), in the same format as `HARDWARE`.

Widgets that keep several values use the operation **`vm`** instead of `vw`
(`MultiPinStorageValue`, `Terminal`): `dashId-deviceId\0vm\0pin\0v1\0v2…`. For the Terminal the values are its
last lines, which the server keeps only in memory (`Terminal.lastCommands`): a sync is the only way to get them
back. `APP_SYNC` messages with a msgId other than 1111 are live writes from other apps.

## SuperChart history: `GET_ENHANCED_GRAPH_DATA` (60)

Request (`MobileGetEnhancedGraphDataLogic`): `dashId[-deviceId]\0widgetId\0period[\0page]`.

- `deviceId` only for charts bound to a Device Selector or Device Tiles.
- `period` is a `GraphPeriod` name: `LIVE`, `ONE_HOUR`, `SIX_HOURS`, `DAY`, `WEEK`, `MONTH`, `N_WEEK`,
  `N_MONTH`, `ONE_YEAR`, … Each has a number of points and a granularity (minute, hour, day); see
  `protocol/src/graph.ts`.
- `page` N skips N × (points of the period), to scroll back in time.

Reply: a binary message compressed with zlib (`ByteUtils.compress`): `int32 dashId`, then for each data stream
of the widget, in the order of `dataStreams`, `int32 count` followed by `count` records of 16 bytes
(`float64 value`, `int64 timestamp in ms`). With no data at all the reply is `RESPONSE 17` NO_DATA. Streams can
have gaps: a chart must not assume one point per minute. `LIVE` comes from an in-memory cache, the other periods
from the files on disk (`ReportingDiskDao`).

## Editing

- `UPDATE_WIDGET` replaces the widget with the same id; only the current value is kept. Send the **complete**
  widget JSON, starting from the profile JSON, so that fields the client does not know are not lost.
- `CREATE_WIDGET` rejects ids already used and charges the widget energy (`21` ENERGY_LIMIT). It also accepts
  `dashId\0widgetId\0templateId\0json` to add a widget to a Device Tiles template.
- `DELETE_WIDGET` returns the energy. Deleting the Tabs widget also deletes the widgets of every tab after the
  first.
- `CREATE_DASH` rejects existing ids (`NOT_ALLOWED`) and too many projects (`QUOTA_LIMIT`) and generates the
  device tokens: reload the profile to read them. `DELETE_DASH` also removes timers, tokens and pin history.
- `ACTIVATE_DASHBOARD` always activates the dashboard; it replies `7` when no device is connected (`200` with
  notifications off). `DEACTIVATE_DASHBOARD` with an **empty body stops every dashboard**: `LegacyClient`
  never sends it.

`LegacyClient` is read-only by default and lets the app opt in: `allowHardwareWrites` for `HARDWARE`,
`editableDashIds` / `allowEditing()` for editing commands on given dashboards, `allowCreateDash` for
`CREATE_DASH`.

## Keep-alive and reconnection

The server closes an idle app connection after `app.socket.idle.timeout` (default 300 s, `Limits`). The client
sends `PING` every 10 s; if a ping gets no reply within the request timeout (15 s) the connection is considered
dead even if the socket is still open, and `onDisconnect` fires. TinkerBlink then reconnects with a backoff
(2, 5, 10, 30 s), logs in again, reloads the profile and syncs the active dashboards. It also closes the
connection when the app goes to the background, which makes the server send `adis` to the devices.

## Assigned projects (fork server)

The [gablau/blynk-server](https://github.com/gablau/blynk-server) fork lets an administrator assign another
user's projects to a viewer. In the profile such a dashboard has an extra field:

```json
"assigned": { "owner": "owner@example.com", "control": true }
```

Devices come without token or connection details. Every editing command on an assigned project answers `6`
NOT_ALLOWED; with `control: false` `HARDWARE` does too. Reading commands (`APP_SYNC`, history, `GET_DEVICES`)
work as usual. When the assignment changes the server closes the viewer's connection, and the app reconnects
and reloads the profile. TinkerBlink shows these projects with their owner, never allows editing them, and with
`control: false` disables the control widgets; a rejected `HARDWARE` restores the previous widget value.
