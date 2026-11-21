# Installing a Blynk Legacy server on Debian or Ubuntu

This guide installs the maintained fork of the server, [blynk-server 0.50.x](https://github.com/gablau/blynk-server),
on a fresh Debian or Ubuntu machine, so that TinkerBlink and your boards can use it. It takes about twenty minutes.
The same steps run the TinkerBlink demo server.

What you get at the end:

- the server running as a service, with its own unprivileged user;
- a free Let's Encrypt certificate on port 9443, renewed automatically;
- the admin panel reachable only from the server itself or your LAN;
- an account to log in from TinkerBlink, and the device tokens for your boards.

Already running 0.41.17? Follow the fork's migration guide instead:
[Moving to production](https://github.com/gablau/blynk-server/blob/master/docs/DEPLOY.md). Your data stays
compatible.

## What you need

- **A Linux machine** with Debian 12 or 13, or Ubuntu 22.04 or 24.04, **64-bit** (x86_64, or ARM64 such as a
  Raspberry Pi 4 or 5 with a 64-bit system). 512 MB of free RAM is enough for a home installation.
- **A domain name** pointing to the machine, for example `myserver.example.com` (a subdomain of your domain, or a free
  dynamic DNS name). Replace `myserver.example.com` with yours everywhere below.
- **Ports 80 and 9443** reachable from the Internet if you want to use the app outside your home: on a home server,
  forward them on the router. Port 80 is used only by Let's Encrypt to check that the domain is yours.
- A user with `sudo`.

## 1. Java 21

The server needs Java 21 (it does not start on older versions).

**Debian 13, Ubuntu 24.04**: it is in the system repositories.

```bash
sudo apt update
sudo apt install -y openjdk-21-jre-headless
```

**Debian 12, Ubuntu 22.04**: install it from the Adoptium (Eclipse Temurin) repository.

```bash
sudo apt install -y wget apt-transport-https gpg
wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg
echo "deb https://packages.adoptium.net/artifactory/deb $(. /etc/os-release; echo $VERSION_CODENAME) main" \
  | sudo tee /etc/apt/sources.list.d/adoptium.list
sudo apt update
sudo apt install -y temurin-21-jre
```

Then find the full path of the `java` 21 command, used by the service in step 6:

```bash
ls -d /usr/lib/jvm/*21*/bin/java
```

It is something like `/usr/lib/jvm/java-21-openjdk-amd64/bin/java` or
`/usr/lib/jvm/temurin-21-jre-amd64/bin/java` (`arm64` instead of `amd64` on ARM).

> **Other Java versions on the same machine.** If another program needs the `java` command to stay on an older
> version, pin it *before* installing Java 21, for example
> `sudo update-alternatives --set java /usr/lib/jvm/java-11-openjdk-amd64/bin/java`. The `legacy-server` service
> uses the full path above, so it does not depend on the default.

## 2. User and folders

```bash
sudo useradd --system --home-dir /var/lib/legacy-server --shell /usr/sbin/nologin legacy-server
sudo install -d -o legacy-server -g legacy-server -m 750 /opt/legacy-server /var/lib/legacy-server
```

- `/opt/legacy-server`: the server jar, its `server.properties`, the `logs/` and `static/` folders it creates.
- `/var/lib/legacy-server`: the data (users, projects, history). This is the folder to back up.

## 3. Download the server

Take the latest release from <https://github.com/gablau/blynk-server/releases> (0.50.0 in this example) and check
its SHA-256 checksum:

```bash
cd /opt/legacy-server
sudo -u legacy-server wget https://github.com/gablau/blynk-server/releases/download/v0.50.0/server-0.50.0.jar
sudo -u legacy-server wget https://github.com/gablau/blynk-server/releases/download/v0.50.0/server-0.50.0.jar.sha256
sha256sum -c server-0.50.0.jar.sha256
sudo -u legacy-server ln -sf server-0.50.0.jar server.jar
```

The last command must print `server-0.50.0.jar: OK`. The `server.jar` link lets you update later without touching
the service.

## 4. Let's Encrypt certificate

The phone must trust the server certificate, so use a real one. Install certbot:

```bash
sudo apt install -y certbot
```

The server runs as the `legacy-server` user, which cannot read the certificates in `/etc/letsencrypt` (they belong
to root). A small script copies them into `/etc/legacy-server/tls` and restarts the server; certbot runs it after
every renewal.

```bash
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/legacy-server.sh >/dev/null <<'EOF'
#!/bin/sh
# Copies the Let's Encrypt certificate for the Blynk server and restarts it.
set -e
DOMAIN=myserver.example.com
install -d -o root -g legacy-server -m 750 /etc/legacy-server/tls
install -o root -g legacy-server -m 640 /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/legacy-server/tls/fullchain.pem
install -o root -g legacy-server -m 640 /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/legacy-server/tls/privkey.pem
systemctl try-restart legacy-server
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/legacy-server.sh
```

Edit `DOMAIN=` in the script, then request the certificate and copy it the first time:

```bash
sudo certbot certonly --standalone -d myserver.example.com
sudo /etc/letsencrypt/renewal-hooks/deploy/legacy-server.sh
```

`--standalone` needs port 80 free. If a web server (nginx, Apache) already uses it, use its plugin instead, for
example `sudo certbot certonly --nginx -d myserver.example.com`. Renewals then happen by themselves
(`systemctl list-timers certbot.timer`).

## 5. Configuration

Write `/opt/legacy-server/server.properties` with only the values you change; everything else keeps the defaults
inside the jar
([list of properties](https://github.com/gablau/blynk-server/blob/master/server/core/src/main/resources/server.properties)).

```bash
sudo -u legacy-server tee /opt/legacy-server/server.properties >/dev/null <<'EOF'
# Blynk server: only the values that differ from the defaults in the jar.
# 9443: apps, devices over TLS, HTTPS API, admin panel. 8080: devices in plain TCP and the HTTP API.
https.port=9443
http.port=8080
# Device tokens travel in clear text on 8080: keep it on the LAN address of this machine (or 127.0.0.1).
http.listen.address=192.168.1.10
server.ssl.cert=/etc/legacy-server/tls/fullchain.pem
server.ssl.key=/etc/legacy-server/tls/privkey.pem
server.host=myserver.example.com
share.qr.host=myserver.example.com
share.qr.port=9443
allow.registration=false
admin.email=you@example.com
EOF
sudo chmod 600 /opt/legacy-server/server.properties
```

- `http.listen.address`: the LAN address of the machine (`hostname -I` shows it), so that boards at home can use
  plain port 8080 while it stays unreachable from the Internet. On a VPS with no boards in the same network, use
  `127.0.0.1` and connect the boards over TLS on 9443.
- `admin.email`: the login of the administrator created at the first start. Leave `admin.pass` out: the server
  generates a random password and prints it once (step 6).
- `allow.registration=false`: nobody can create an account from the app; you create accounts from the admin panel.

## 6. Service

```bash
sudo tee /etc/systemd/system/legacy-server.service >/dev/null <<'EOF'
[Unit]
Description=Blynk Legacy server (fork 0.50.x)
After=network-online.target
Wants=network-online.target

[Service]
User=legacy-server
Group=legacy-server
WorkingDirectory=/opt/legacy-server
# Full path of java 21 (step 1)
ExecStart=/usr/lib/jvm/java-21-openjdk-amd64/bin/java -Xmx256m -jar /opt/legacy-server/server.jar -dataFolder /var/lib/legacy-server
Restart=on-failure
RestartSec=10
SuccessExitStatus=143
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/legacy-server /var/lib/legacy-server

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now legacy-server
```

Put your path of `java` in `ExecStart`. Then check that it started and read the administrator password, printed
only at the first start:

```bash
systemctl status legacy-server --no-pager
sudo journalctl -u legacy-server --no-pager | grep -iA3 "admin"
sudo ss -ltnp | grep java
```

`ss` must show port 9443 on all addresses and 8080 on the address you chose. Keep the password in a password
manager. Server logs are in `/opt/legacy-server/logs/blynk.log`; a warning about the certificate means
`server.ssl.*` points to missing or unreadable files (go back to step 4).

## 7. Firewall

With `ufw` (on Debian `sudo apt install -y ufw` first):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp                                    # Let's Encrypt
sudo ufw allow 9443/tcp                                  # apps and devices over TLS
sudo ufw allow from 192.168.1.0/24 to any port 8080 proto tcp   # boards in plain TCP, LAN only
sudo ufw enable
```

Do not open 8080 to the Internet. On a home server, forward only 80 and 9443 on the router.

## 8. Admin panel and your account

The admin panel answers only to the server itself and to private networks (`allowed.administrator.ips`).

- **Home server**: open `https://<LAN address>:9443/admin` from a PC in the same network (the browser warns that
  the certificate is for `myserver.example.com`: you can use `https://myserver.example.com:9443/admin` if your router
  resolves it inside the LAN).
- **VPS**: open an SSH tunnel from your PC, then browse to `https://localhost:9443/admin` and accept the certificate
  warning:

  ```bash
  ssh -L 9443:127.0.0.1:9443 user@myserver.example.com
  ```

Log in with `admin.email` and the password from step 6, then:

1. **Users → New user**: create the account you will use in the app (email and a password of at least 8
   characters). Keep the administrator for the panel only.
2. After you create projects and devices in the app, the panel shows their **device tokens** (Users → the user →
   projects), and lets you regenerate them.

## 9. Connect TinkerBlink and your boards

**TinkerBlink**: on the login screen enter

- Server: `myserver.example.com:9443`
- Email and password: the account created in step 8.

The certificate icon next to the Server field shows whether the phone trusts the certificate (tap it for the
details). Then create a project, add a device (board and connection type) and copy its token from the project settings.

**Boards** (Blynk legacy library, for example 0.6.1 on ESP8266):

```cpp
// In the same LAN, plain TCP on 8080:
Blynk.begin(auth, ssid, pass, IPAddress(192, 168, 1, 10), 8080);
// From anywhere, TLS on 9443 (BlynkSimpleEsp8266_SSL.h, BlynkSimpleEsp32_SSL.h):
Blynk.begin(auth, ssid, pass, "myserver.example.com", 9443);
```

**Node-RED**: [node-red-contrib-blynk-ws](https://flows.nodered.org/node/node-red-contrib-blynk-ws) connects as a
device to `wss://myserver.example.com:9443/websockets` (or `ws://192.168.1.10:8080/websockets` in the LAN).

**HTTP API**: `https://myserver.example.com:9443/<token>/update/V1?value=42`, `.../get/V1`,
`.../isHardwareConnected`.

## Optional: TinkerBlink on port 443 behind nginx

If the machine already runs nginx on 443, it can also serve the server there, so that in TinkerBlink you type only
`myserver.example.com`. Apps over WebSocket, the HTTP API and Node-RED (`wss://myserver.example.com/websockets`)
work through nginx; **boards keep using 9443 or 8080**, because their protocol is not HTTP.

```nginx
server {
    listen 443 ssl;
    server_name myserver.example.com;
    ssl_certificate     /etc/letsencrypt/live/myserver.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myserver.example.com/privkey.pem;

    # The admin panel must never be reachable through the proxy.
    location /admin { return 404; }

    location / {
        proxy_pass https://127.0.0.1:9443;
        proxy_ssl_verify off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;   # real client address, for the failed login limit
        proxy_read_timeout 1h;
    }
}
```

With nginx on the same machine, use `sudo certbot certonly --nginx -d myserver.example.com` in step 4. If only nginx
needs to be reachable (no boards from outside), you can also bind the server to the loopback
(`listen.address=127.0.0.1`) and close 9443 in the firewall.

## Backup and updates

- **Backup**: copy `/var/lib/legacy-server` (and `/opt/legacy-server/server.properties`). The `.user` files contain
  password hashes: keep the backup as safe as a password.
- **Update**: download the new jar and its checksum into `/opt/legacy-server` as in step 3, point the link to it and
  restart:

  ```bash
  sudo -u legacy-server ln -sf server-0.50.1.jar /opt/legacy-server/server.jar
  sudo systemctl restart legacy-server
  ```

  Read the [changelog](https://github.com/gablau/blynk-server/blob/master/CHANGELOG.md) first. The previous jar stays
  in the folder: to go back, point the link to it again.

## Troubleshooting

| Problem | What to check |
|---|---|
| The service stops right after the start | `sudo journalctl -u legacy-server -n 50`: wrong `java` path, Java older than 21, port 9443 already used, unreadable certificate |
| TinkerBlink says the certificate is not trusted | `server.ssl.*` points to the files of step 4; the domain in the Server field is the one of the certificate |
| TinkerBlink cannot connect | port 9443 open in the firewall and forwarded on the router; the domain resolves to the right address |
| Login refused after some attempts | 5 failed logins in 10 minutes block the address for 10 minutes |
| The admin panel does not open | it answers only from the server (SSH tunnel) and private networks, never through nginx |
| A board does not connect on 8080 | `http.listen.address` is the LAN address, and the board is in that network |
