#!/usr/bin/env bash
# Installs the debug APK on the running emulator and captures real screenshots of each screen.
set -u
PKG=in.co.gara.rajgarludo
ACT=$PKG/com.gara.rajgarludo.MainActivity
OUT=${1:-shots}
mkdir -p "$OUT/diag"
pip install -q websocket-client 2>/dev/null || pip install -q --break-system-packages websocket-client
adb install -r -g app-debug.apk
# Clean status bar: 12:00, full battery, full signal, no notifications.
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1200 >/dev/null
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e level 4 -e datatype none >/dev/null
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null

shot () {  # name  page  wait-seconds
  adb shell am start -S -n "$ACT" --es page "'$2'" >/dev/null
  sleep "$3"
  adb exec-out screencap -p > "$OUT/$1.png"
  echo "captured $1 ($2)"
  pid=$(adb shell pidof $PKG | tr -d '\r')
  adb forward --remove-all >/dev/null 2>&1
  adb forward tcp:9222 localabstract:webview_devtools_remote_$pid >/dev/null && timeout 40 python3 tools/diag.py "$OUT/diag/$1" || echo "diag $1 failed"
}
shot 00-launch index.html 1          # splash / first frame
shot 01-home index.html 6
shot 02-ludo-setup ludo.html 5
shot 03-ludo-play 'ludo.html?demo=1' 14
shot 04-snakes-play 'snakes.html?demo=1' 14
shot 05-carrom-play 'carrom.html?demo=1' 12
shot 06-shop 'index.html?sheet=shop' 6
shot 07-premium 'index.html?sheet=premium' 6
shot 08-codes 'index.html?sheet=codes' 6
shot 09-profile 'index.html?sheet=profile' 6
adb logcat -d -s chromium:I AndroidRuntime:E RGWeb:I > "$OUT/logcat.txt" 2>/dev/null || true
