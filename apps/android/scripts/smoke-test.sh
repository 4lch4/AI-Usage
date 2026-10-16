#!/usr/bin/env bash
# Installs the APK on a running emulator, opens the app, then fires the widget's update broadcast
# (which runs the headless widget task), and fails if the app's process crashed along the way.
# Usage: smoke-test.sh <apk> <log dir>
set -uo pipefail

apk=$1
logs=$2
package=com.alcha.aiusage
mkdir -p "$logs"

adb install -r "$apk" || exit 1
adb logcat -c

adb shell monkey -p "$package" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 20
launched=$(adb shell pidof "$package" | tr -d '\r')

# The widget receiver is not exported, so only root may send it the broadcast a launcher would.
adb root >/dev/null && sleep 5 && adb wait-for-device
adb shell am broadcast -a android.appwidget.action.APPWIDGET_UPDATE \
  -n "$package/.widget.Usage" --eia appWidgetIds 1
sleep 15

adb logcat -d -b crash >"$logs/crash.txt"
adb logcat -d >"$logs/logcat.txt"
adb exec-out screencap -p >"$logs/screen.png"

echo '--- crash buffer'
cat "$logs/crash.txt"
echo '--- errors'
grep -E ' E (ReactNativeJS|AndroidRuntime|ReactNative|unknown:ReactNative)|FATAL|libc ' "$logs/logcat.txt" | tail -80

if [ -z "$launched" ]; then
  echo "The app was not running 20 seconds after launch."
  exit 1
fi
if [ -s "$logs/crash.txt" ]; then
  echo 'The app crashed.'
  exit 1
fi
echo 'The app launched and survived the widget update.'
