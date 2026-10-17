"""Places the AI Usage widget on an emulator's home screen through the launcher, the way a person
would, then reports whether Android still has it bound. Run with the emulator already up.

Usage: python3 add-widget.py <log dir>
Exit codes: 0 placed and still there, 1 placed but gone, 2 could not drive the launcher.
"""

import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.alcha.aiusage'
APP_LABEL = 'AI Usage'
WIDGET_LABEL = 'OpenCode Go usage'
logs = Path(sys.argv[1])
logs.mkdir(parents=True, exist_ok=True)
step = 0


def adb(*args: str) -> str:
    return subprocess.run(['adb', *args], capture_output=True, text=True).stdout


def snapshot(name: str) -> ET.Element:
    """Saves the screen and its view tree, and returns the tree."""
    global step
    step += 1
    prefix = logs / f'{step:02d}-{name}'
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    xml = adb('exec-out', 'cat', '/sdcard/ui.xml')
    prefix.with_suffix('.xml').write_text(xml)
    with open(prefix.with_suffix('.png'), 'wb') as png:
        png.write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
    try:
        return ET.fromstring(xml[xml.index('<'):])
    except (ValueError, ET.ParseError):
        return ET.Element('hierarchy')


def find(tree: ET.Element, pattern: str):
    """The centre of the first node whose text or description matches, or None."""
    regex = re.compile(pattern, re.IGNORECASE)
    for node in tree.iter('node'):
        label = f"{node.get('text', '')} {node.get('content-desc', '')}"
        if regex.search(label):
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def labels(tree: ET.Element) -> list[str]:
    return [t for n in tree.iter('node') for t in (n.get('text'), n.get('content-desc')) if t]


def give_up(why: str, tree: ET.Element) -> None:
    print(f'Could not drive the launcher: {why}')
    print('Visible labels:', labels(tree)[:60])
    sys.exit(2)


def bound_widgets() -> list[str]:
    dump = adb('shell', 'dumpsys', 'appwidget')
    return [line.strip() for line in dump.splitlines() if f'{PACKAGE}/' in line]


width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1])
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
time.sleep(3)

# A long press on empty home screen opens the menu that holds "Widgets".
adb('shell', 'input', 'swipe', *map(str, (width // 2, height // 2, width // 2, height // 2, 1500)))
time.sleep(2)
tree = snapshot('home-menu')
spot = find(tree, r'^\s*widgets\s*$')
if not spot:
    give_up('no "Widgets" option after a long press', tree)
adb('shell', 'input', 'tap', *map(str, spot))
time.sleep(3)

# Scroll the picker until the app's entry shows, then open it to see its widgets.
for attempt in range(12):
    tree = snapshot(f'picker-{attempt}')
    spot = find(tree, rf'^\s*{re.escape(WIDGET_LABEL)}') or find(tree, rf'^\s*{re.escape(APP_LABEL)}\b')
    if spot:
        break
    adb('shell', 'input', 'swipe', *map(str, (width // 2, height * 3 // 4, width // 2, height // 4, 400)))
    time.sleep(1)
else:
    give_up(f'"{APP_LABEL}" never appeared in the widget picker', tree)

if not find(tree, rf'^\s*{re.escape(WIDGET_LABEL)}'):
    adb('shell', 'input', 'tap', *map(str, spot))
    time.sleep(2)
    tree = snapshot('app-entry')
spot = find(tree, rf'^\s*{re.escape(WIDGET_LABEL)}')
if not spot:
    give_up(f'no "{WIDGET_LABEL}" widget under "{APP_LABEL}"', tree)

# Android 14's launcher offers an "Add" button after a tap on the preview; older ones need a drag.
adb('shell', 'input', 'tap', *map(str, spot))
time.sleep(2)
tree = snapshot('preview-tapped')
add = find(tree, r'^\s*add( to home screen)?\s*$')
if add:
    adb('shell', 'input', 'tap', *map(str, add))
else:
    adb('shell', 'input', 'draganddrop', *map(str, (*spot, width // 2, height // 3, 1500)))
time.sleep(5)
snapshot('just-added')
placed = bound_widgets()
print('Bound right after adding:', placed)

time.sleep(20)
snapshot('after-20s')
still = bound_widgets()
print('Bound 20 seconds later:', still)

if not placed and not still:
    print('The widget was never bound.')
    sys.exit(1)
if not still:
    print('The widget was bound, then removed.')
    sys.exit(1)
print('The widget is on the home screen.')
