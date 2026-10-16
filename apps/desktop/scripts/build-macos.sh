#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

die() { echo "Error: $*" >&2; exit 1; }

VERSION=""
ARCH=""
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 --version VERSION --arch arm64|x86_64 --target TARGET"
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -n "$VERSION" && -n "$ARCH" && -n "$TARGET" ]] || die "--version, --arch, and --target are required."
case "$ARCH:$TARGET" in
  arm64:aarch64-apple-darwin|x86_64:x86_64-apple-darwin) ;;
  *) die "Mismatched or unsupported architecture and target: $ARCH / $TARGET" ;;
esac

PACKAGE_VERSION="${VERSION#v}"
[[ "$PACKAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || die "Release tag must be SemVer, optionally prefixed by v."
CARGO_VERSION="$(awk '/^\[workspace.package\]/{found=1; next} found && /^version = /{gsub(/"/, "", $3); print $3; exit}' "$REPO_ROOT/Cargo.toml")"
[[ "$PACKAGE_VERSION" == "$CARGO_VERSION" ]] || die "Release version $PACKAGE_VERSION does not match Cargo workspace version $CARGO_VERSION."

DIST_DIR="$REPO_ROOT/target/dist"
BUILD_DIR="$REPO_ROOT/target/$TARGET/release"
WORK_DIR="$REPO_ROOT/target/macos-package-$ARCH"
APP="$WORK_DIR/Huddle.app"
DMG="$DIST_DIR/Huddle-${VERSION}-macos-${ARCH}.dmg"
ICONSET="$WORK_DIR/Huddle.iconset"
ICON_SOURCE="$REPO_ROOT/crates/desktop/assets/app-icon.png"

rm -rf "$WORK_DIR"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$ICONSET" "$DIST_DIR"

(cd "$REPO_ROOT" && cargo build --release --locked --target "$TARGET" -p huddle-desktop)
install -m 0755 "$BUILD_DIR/huddle-desktop" "$APP/Contents/MacOS/huddle-desktop"

for size in 16 32 128 256 512; do
  inner=$((size * 70 / 100))
  tmp="$ICONSET/icon_${size}x${size}.inner.png"
  sips -z "$inner" "$inner" "$ICON_SOURCE" --out "$tmp" >/dev/null
  "$SCRIPT_DIR/pad-png.py" "$tmp" "$ICONSET/icon_${size}x${size}.png" "$size" "$size"

  double=$((size * 2))
  inner_double=$((double * 70 / 100))
  tmp_double="$ICONSET/icon_${size}x${size}@2x.inner.png"
  sips -z "$inner_double" "$inner_double" "$ICON_SOURCE" --out "$tmp_double" >/dev/null
  "$SCRIPT_DIR/pad-png.py" "$tmp_double" "$ICONSET/icon_${size}x${size}@2x.png" "$double" "$double"
done
rm -f "$ICONSET"/*.inner.png
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Huddle.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Huddle</string>
  <key>CFBundleDisplayName</key><string>Huddle</string>
  <key>CFBundleIdentifier</key><string>com.huddle.desktop</string>
  <key>CFBundleExecutable</key><string>huddle-desktop</string>
  <key>CFBundleIconFile</key><string>Huddle</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${PACKAGE_VERSION%%[-+]*}</string>
  <key>CFBundleVersion</key><string>${PACKAGE_VERSION%%[-+]*}</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
plutil -lint "$APP/Contents/Info.plist"

DMG_ROOT="$WORK_DIR/dmg-root"
mkdir -p "$DMG_ROOT"
ditto "$APP" "$DMG_ROOT/Huddle.app"
ln -s /Applications "$DMG_ROOT/Applications"
rm -f "$DMG"
hdiutil create -volname Huddle -srcfolder "$DMG_ROOT" -ov -format UDZO "$DMG"

rm -rf "$WORK_DIR"
echo "Created $DMG"
