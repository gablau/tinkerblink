# TinkerBlink

TinkerBlink is a mobile app for self-hosted **Blynk Legacy** servers (blynk-server 0.41.x and 0.50.x). It shows your
projects and dashboards, controls your devices and lets you edit dashboards, widgets, projects and devices
directly on the phone.

It is meant for people who still run their own legacy server for home automation and hobby projects and need
a maintained app to talk to it.

> TinkerBlink is an independent project, not affiliated with or endorsed by Blynk Inc. "Blynk" is a trademark of
> its respective owners and is used here only to describe compatibility.

## Features

- Login to your own server (address, email, password); if you choose to remember it, the password is kept in the
  Android keystore.
- Live dashboards over a single WebSocket connection, with tabs, themes, device status and automatic
  reconnection.
- Widgets:
  - controls: Button, Styled Button, Slider and Vertical Slider, Step, RGB, Joystick, Menu, Segmented Switch,
    Text Input, Numeric Input, Time Input, Timer;
  - displays: Value Display, Labeled Value, LED, Gauge, Level H/V, LCD, Terminal, Table, Image Gallery;
  - SuperChart with history paging, live data and a saved period;
  - Map (Leaflet and OpenStreetMap), Video (RTSP), Music Player, WebPage Button;
  - phone sensors (accelerometer, gravity, light, proximity, barometer, humidity, temperature) and GPS Stream /
    GPS Trigger (with the app open).
- Dashboard editor: Widget Box, widget settings, pin picker with the pins of 96 boards, move and resize on the
  grid, duplicate and delete.
- Projects and devices: create, rename, change theme, start/stop, delete; device tokens (hidden by default).
- Projects shared with you by the administrator (on servers that support it) are shown read-only.
- Italian and English, following the phone language. Wide screens show the dashboard in side-by-side columns.

## Download

- **Google Play**: in closed testing, coming soon.
- **APK**: signed APKs for every release on [GitHub Releases](https://github.com/gablau/tinkerblink/releases)
  (`arm64-v8a` fits most phones; `universal` works everywhere). Both are signed with the same key, so you can
  switch between them without uninstalling.

Privacy: TinkerBlink collects no data for the developer and talks only to the server you choose. See the
[privacy policy](https://gablau.github.io/tinkerblink/privacy).

## Compatible servers

- **blynk-server 0.41.x** (last release 0.41.17), the open-source legacy server (GPL-3.0).
- **blynk-server 0.50.x**, the maintained fork at [gablau/blynk-server](https://github.com/gablau/blynk-server)
  (Java 21, new admin panel, closed registration, security fixes). TinkerBlink supports its additions: login
  errors, projects assigned by the administrator (read-only) and rejected commands. The fork is recommended for
  new installations: see [Installing a Blynk Legacy server on Debian or Ubuntu](docs/server-install.md).
- The app connects to `wss://<host>/dashws`, on the server's HTTPS port (9443 by default) or through a reverse proxy
  on 443. The certificate must be trusted by the phone: a public certificate (for example Let's Encrypt) is the
  simplest choice.

The protocol is described in [docs/protocol.md](docs/protocol.md), widget values and layout in
[docs/widgets.md](docs/widgets.md).

## Repository layout

```
app/        the Expo / React Native app (Android and web)
protocol/   @tinkerblink/protocol: TypeScript client for the Blynk Legacy app protocol (Node and React Native)
patches/    patches applied by patch-package after npm install (expo-video: RTSP with RTP over TCP)
docs/       protocol and widget notes
```

## Build

Requirements: a current LTS release of Node.js, JDK 17, the Android SDK (Android Studio), an emulator or a phone with USB
debugging.

```sh
npm install                       # installs both workspaces and applies the patches
npm run typecheck -w app
npm run selftest -w @tinkerblink/protocol

cd app
npx expo prebuild --platform android --no-install   # generates app/android (not versioned)
npx expo run:android              # development build on the emulator or phone
npm run web                       # web version in the browser
```

The app uses local native modules (`app/modules/tinkerblink-sensors`) and a patched expo-video, so it needs a
development build: Expo Go is not enough.

### Release APK

```sh
npm run build:apk                 # add -- --prebuild to regenerate app/android first
```

`app/scripts/build-release.js` runs the release build with one APK per ABI and signs the APKs with the key in
`keys/` (not versioned). It writes them to `dist/<version>/` (not versioned, one folder per release), ready to
attach to a GitHub release:

| File                                     | For                                         |
| ---------------------------------------- | ------------------------------------------- |
| `tinkerblink-<version>-arm64-v8a.apk`    | most phones and tablets (64-bit ARM)        |
| `tinkerblink-<version>-armeabi-v7a.apk`  | older 32-bit ARM phones                     |
| `tinkerblink-<version>-x86_64.apk`       | emulators and x86 Chromebooks               |
| `tinkerblink-<version>-universal.apk`    | any device, larger                          |
| `SHA256SUMS.txt`                         | checksums of the APKs                       |

The version is `expo.version` in `app/app.json`; `expo.android.versionCode` must grow at every release (Android
and Google Play refuse an update with a lower or equal versionCode). `keys/keystore.properties` contains
`storeFile`, `keyAlias`, `storePassword` and `keyPassword`. Keep a copy of your key: updates only install over an
app signed with the same key. `app/scripts/sign-release.js` alone signs again the APKs of the last Gradle build.

### Google Play bundle

```sh
npm run build:aab
```

writes `dist/<version>/tinkerblink-<version>.aab`, signed by Gradle with the same key, to upload to Google Play.
The script prints the SHA-256 of the signing certificate and stops if the bundle is still signed with the debug
key.

On Windows the native release build can exceed the 260-character path limit: the config plugin
`app/plugins/withShortCxxPath.js` moves the CMake build folder to `C:\bl-cxx`.

## Project status

TinkerBlink is in daily use on **Android** with a self-hosted server, and works in the browser.

**iOS has never been tested.** Most of the app is cross-platform React Native and Expo code, but these parts need
work or at least testing before an iPhone or iPad release:

- **RTSP video**: works thanks to a patch of expo-video for Android (Media3, RTP over TCP). AVPlayer on iOS does
  not support RTSP, so iOS needs another player (for example one based on libVLC or FFmpeg).
- **Phone sensors**: the local native module `tinkerblink-sensors` exists only in Kotlin; the iOS part (Core
  Motion and the environmental sensors where available) still has to be written.
- **GPS Stream and GPS Trigger**: expo-location supports iOS; the location permission text
  (`locationWhenInUsePermission`) is already in app.json.
- **Network and certificates**: `app/plugins/withNetworkSecurityConfig.js` (user certificates and cleartext traffic
  in debug builds) is Android-only. On iOS, App Transport Security applies, and a private CA must be installed and
  trusted in the device settings.
- **Build and signing**: `withShortCxxPath.js` and `sign-release.js` are for Android; iOS needs EAS Build or Xcode
  and an Apple Developer Program membership.
- **App Review**: an app that connects to a private server may need a working demo account for the reviewers.
- **Everything else** (grid, widgets, editor, SuperChart, map in a WebView, secure storage, returning from the
  background) has not been verified on iPhone or iPad.

Contributions and test reports are welcome.

## Use of AI

TinkerBlink was developed with an AI coding assistant: **Claude** by Anthropic, used through
**[Claude Code](https://claude.com/claude-code)**.

- **The author** set the goals and the requirements, made the design decisions (features, behaviour, user
  interface, license), tested the app every day with real devices on a self-hosted server, and reviewed the
  results.
- **Claude** studied the blynk-server source to describe the protocol and the data model, and wrote most of the
  code, the comments, the documentation in [docs/](docs/), the icons (as SVG code) and the commit messages. It
  also ran the type checks, the protocol self-test and many tests on the Android emulator against a local
  test server.

AI-written code can contain mistakes like any other code: bug reports are welcome.

## License

TinkerBlink is free software, released under the **GNU General Public License v3.0 or later** ([LICENSE](LICENSE)),
with an **additional permission** that allows distribution through app stores such as the Apple App Store and
Google Play ([LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md)).

The protocol package in [protocol/](protocol/) is released under the **MIT License**
([protocol/LICENSE](protocol/LICENSE)), so it can be reused in any project.

Board definitions and widget documentation by Blynk Inc. are included under the MIT License: see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). The credits page of the app lists libraries, fonts and map
services.
