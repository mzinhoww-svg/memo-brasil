#!/bin/bash
# usage: cap.sh <name>  -> screenshot + visible texts
export PATH=$HOME/Library/Android/sdk/platform-tools:$PATH
S=~/Downloads/Memo_Reverse/docs/reverse-engineering/screenshots
A=~/Downloads/Memo_Reverse/docs/reverse-engineering/analysis/ui
mkdir -p $A
adb exec-out screencap -p > $S/$1.png
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
adb exec-out cat /sdcard/ui.xml > $A/$1.xml
python3 -I - "$A/$1.xml" <<'PY'
import sys,re
x=open(sys.argv[1]).read()
for m in re.finditer(r'<node [^>]*>',x):
    n=m.group(0)
    t=re.search(r' text="([^"]*)"',n); d=re.search(r'content-desc="([^"]*)"',n); b=re.search(r'bounds="([^"]*)"',n)
    c=re.search(r'clickable="true"',n)
    if (t and t.group(1)) or (d and d.group(1)):
        print(('[C] ' if c else '    ')+(t.group(1) if t and t.group(1) else d.group(1)), b.group(1))
PY
