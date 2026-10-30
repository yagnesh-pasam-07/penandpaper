#!/bin/bash
# Packs what /download offers into public/downloads/: the Chrome extension as a
# zip (load it unpacked) and, on a Mac with Swift, the menu-bar app as a zip.
# Usage: ./scripts/build-downloads.sh        (from anywhere)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/public/downloads"
mkdir -p "$OUT"

echo "→ Chrome extension"
rm -f "$OUT/penandpaper-chrome.zip"
STAGE="$(mktemp -d)/penandpaper-chrome"
mkdir -p "$STAGE"
# Only what the browser loads: no tests, no icon script.
(cd "$ROOT/extension" && cp manifest.json background.js capture.js outbox.js overlay.js share-url.js options.html options.js README.md "$STAGE/" && cp -R icons "$STAGE/")
(cd "$(dirname "$STAGE")" && zip -qr "$OUT/penandpaper-chrome.zip" penandpaper-chrome)

if command -v swift >/dev/null && [ "$(uname)" = "Darwin" ]; then
  echo "→ Mac app"
  "$ROOT/mac/build-app.sh"
  rm -f "$OUT/PenAndPaper-mac.zip"
  # ditto keeps the app's signature and attributes intact, as Finder's Compress does.
  ditto -c -k --keepParent "$ROOT/mac/PenAndPaper.app" "$OUT/PenAndPaper-mac.zip"
else
  echo "  (no Swift on this machine: the Mac app zip is left as it was)"
fi

ls -lh "$OUT"
