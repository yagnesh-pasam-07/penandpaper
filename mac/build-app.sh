#!/bin/bash
# Builds PenAndPaper.app next to this script: release build, icon, Info.plist, ad-hoc signature.
# Usage: ./mac/build-app.sh                 (from anywhere; Apple silicon only)
#        UNIVERSAL=1 ./mac/build-app.sh     (one app for Apple silicon and Intel Macs)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
APP="$HERE/PenAndPaper.app"
VERSION="0.1.0"

cd "$HERE"
echo "→ swift build (release)"
if [ "${UNIVERSAL:-0}" = "1" ]; then
  # Both architectures in one binary. Not yet tried on an Intel Mac.
  ARCHS=(--arch arm64 --arch x86_64)
else
  ARCHS=(--arch arm64)
fi
swift build -c release "${ARCHS[@]}" >/dev/null
BIN="$(swift build -c release "${ARCHS[@]}" --show-bin-path)/PenAndPaperCapture"

echo "→ assembling PenAndPaper.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/PenAndPaperCapture"

# The icon: the pen mark from the browser extension, scaled into an .icns.
SRC="$ROOT/extension/icons/128.png"
if [ -f "$SRC" ]; then
  SET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$SET"
  for size in 16 32 64 128 256 512; do
    sips -z "$size" "$size" "$SRC" --out "$SET/icon_${size}x${size}.png" >/dev/null
  done
  cp "$SET/icon_32x32.png"   "$SET/icon_16x16@2x.png"
  cp "$SET/icon_64x64.png"   "$SET/icon_32x32@2x.png"
  cp "$SET/icon_256x256.png" "$SET/icon_128x128@2x.png"
  cp "$SET/icon_512x512.png" "$SET/icon_256x256@2x.png"
  cp "$SET/icon_512x512.png" "$SET/icon_512x512@2x.png"
  rm "$SET/icon_64x64.png"
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns"
else
  echo "  (no icon found at $SRC, building without one)"
fi

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>PenAndPaperCapture</string>
  <key>CFBundleIdentifier</key><string>app.penandpaper.capture</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Pen &amp; Paper Capture</string>
  <key>CFBundleDisplayName</key><string>Pen &amp; Paper Capture</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Pen &amp; Paper listens only while you hold the talk shortcut, to turn what you say into a note.</string>
  <key>NSSpeechRecognitionUsageDescription</key><string>Pen &amp; Paper turns what you say into text while you hold the talk shortcut. On most languages this happens on your Mac.</string>
</dict>
</plist>
PLIST

echo "→ signing (ad-hoc)"
codesign --force --deep -s - "$APP" 2>&1 | grep -v "replacing existing signature" || true
codesign --verify --deep --strict "$APP" && echo "  signature ok"

echo "✓ $APP"
echo "  First launch: right-click the app → Open (it is ad-hoc signed, not notarized)."
