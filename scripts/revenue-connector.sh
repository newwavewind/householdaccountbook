#!/usr/bin/env bash
# Private revenue connector keeper — binds 127.0.0.1:4001 only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT/server"
PID_FILE="$ROOT/.revenue-cache/connector.pid"
LOG_FILE="${REVENUE_LOG:-/tmp/revenue-server.log}"
PORT="${REVENUE_PORT:-4001}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
NPX_BIN="${NPX_BIN:-$(command -v npx || true)}"
LABEL="com.householdaccountbook.revenue"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

# Shell ASC_* often poisons dotenv; clear before start.
unset_poison() {
  unset ASC_KEY_ID ASC_ISSUER_ID ASC_PRIVATE_KEY_PATH ASC_VENDOR_NUMBER ASC_APP_NAME \
    GOOGLE_PLAY_PACKAGE_NAME GOOGLE_APPLICATION_CREDENTIALS \
    GOOGLE_CLOUD_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_REPORT_PREFIX PLAY_REPORTS_DIR \
    ASC_KEY_PATH ASC_FINANCE_KEY_PATH ASC_APPS_KEY_PATH GOOGLE_PLAY_SA_JSON || true
}

mkdir -p "$ROOT/.revenue-cache"
chmod 700 "$ROOT/.revenue-cache" 2>/dev/null || true

is_listening() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

pid_of_listener() {
  lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

health() {
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 \
    "http://127.0.0.1:${PORT}/api/app-revenue/status" 2>/dev/null || echo 000
}

start_once() {
  if is_listening; then
    echo "already listening on ${PORT} (pid $(pid_of_listener))"
    return 0
  fi
  unset_poison
  cd "$SERVER_DIR"
  nohup env -u ASC_KEY_ID -u ASC_ISSUER_ID \
    "$NPX_BIN" tsx src/revenueServer.ts >>"$LOG_FILE" 2>&1 </dev/null &
  echo $! >"$PID_FILE"
  disown || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if is_listening; then
      echo "started pid=$(pid_of_listener) log=$LOG_FILE"
      return 0
    fi
    sleep 0.4
  done
  echo "failed to start — see $LOG_FILE" >&2
  return 1
}

stop_all() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  echo "stopped"
}

status() {
  local code listen
  listen=$(is_listening && echo yes || echo no)
  code=$(health)
  echo "listening=$listen http=$code pid=$(pid_of_listener || echo -) log=$LOG_FILE"
  [ "$listen" = yes ] && [[ "$code" =~ ^(200|401)$ ]]
}

# Keep process alive; exits only on SIGTERM/INT.
keep() {
  echo "keeper watching :$PORT (log $LOG_FILE)"
  trap 'stop_all; exit 0' INT TERM
  while true; do
    if ! is_listening; then
      echo "$(date '+%F %T') reconnecting…" >>"$LOG_FILE"
      start_once || true
    fi
    sleep 3
  done
}

install_launchagent() {
  if [ -z "${NODE_BIN}" ] || [ -z "${NPX_BIN}" ]; then
    echo "node/npx not found" >&2
    return 1
  fi
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${ROOT}/scripts/revenue-connector.sh</string>
    <string>keep</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${SERVER_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin</string>
    <key>NODE_BIN</key>
    <string>${NODE_BIN}</string>
    <key>NPX_BIN</key>
    <string>${NPX_BIN}</string>
  </dict>
</dict>
</plist>
EOF
  local uid
  uid="$(id -u)"
  launchctl bootout "gui/${uid}/${LABEL}" 2>/dev/null || true
  launchctl bootstrap "gui/${uid}" "$PLIST"
  launchctl enable "gui/${uid}/${LABEL}" 2>/dev/null || true
  launchctl kickstart -k "gui/${uid}/${LABEL}"
  echo "LaunchAgent installed: $PLIST"
  status || true
}

uninstall_launchagent() {
  local uid
  uid="$(id -u)"
  launchctl bootout "gui/${uid}/${LABEL}" 2>/dev/null || true
  rm -f "$PLIST"
  stop_all
  echo "LaunchAgent removed"
}

case "${1:-start}" in
  start) start_once ;;
  stop) stop_all ;;
  restart) stop_all; start_once ;;
  status) status ;;
  keep) keep ;;
  install-launchagent) install_launchagent ;;
  uninstall-launchagent) uninstall_launchagent ;;
  *)
    echo "usage: $0 {start|stop|restart|status|keep|install-launchagent|uninstall-launchagent}" >&2
    exit 2
    ;;
esac
