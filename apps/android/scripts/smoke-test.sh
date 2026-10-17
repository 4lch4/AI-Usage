#!/usr/bin/env bash
# Installs the APK on a running emulator, opens the app, fires the widget's update broadcast
# (which runs the headless widget task), then places the widget through the launcher. Fails if the
# app crashed or the widget does not stay on the home screen.
# Usage: smoke-test.sh <apk> <log dir>
set -uo pipefail

apk=$1
logs=$2
package=com.alcha.aiusage
mkdir -p "$logs"

# The Galaxy S22 Ultra's default screen density; the size comes from the emulator's skin.
adb shell wm density 450

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

adb logcat -c
python3 "$(dirname "$0")/add-widget.py" "$logs/widget"
placed=$?
adb logcat -d >"$logs/widget/logcat.txt"
echo '--- widget log'
grep -iE 'appwidget|RNWidget|ReactNativeJS|widget|AndroidRuntime|com\.alcha\.aiusage' "$logs/widget/logcat.txt" |
  grep -v 'Access denied' | tail -150
exit $placed
