#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
die() { echo "Error: $*" >&2; exit 1; }

VERSION=""
ARCH=""
TARGET=""
FORMAT="tarball"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --format) FORMAT="${2:-}"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 --version VERSION --arch x86_64 --target TARGET [--format tarball|appimage|deb|rpm]"
      exit 0
      ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -n "$VERSION" && -n "$ARCH" && -n "$TARGET" ]] || die "--version, --arch, and --target are required."
[[ "$ARCH:$TARGET" == "x86_64:x86_64-unknown-linux-gnu" ]] || die "Only x86_64 Linux is currently packaged."
PACKAGE_VERSION="${VERSION#v}"
[[ "$PACKAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || die "Release tag must be SemVer, optionally prefixed by v."
CARGO_VERSION="$(awk '/^\[workspace.package\]/{found=1; next} found && /^version = /{gsub(/"/, "", $3); print $3; exit}' "$REPO_ROOT/Cargo.toml")"
[[ "$PACKAGE_VERSION" == "$CARGO_VERSION" ]] || die "Release version $PACKAGE_VERSION does not match Cargo workspace version $CARGO_VERSION."

DIST_DIR="$REPO_ROOT/target/dist"
BINARY="$REPO_ROOT/target/$TARGET/release/huddle-desktop"
ICON="$REPO_ROOT/crates/desktop/assets/app-icon.png"
DESKTOP_FILE="$REPO_ROOT/packaging/linux/com.huddle.desktop.desktop"
mkdir -p "$DIST_DIR"

(cd "$REPO_ROOT" && cargo build --release --locked --target "$TARGET" -p huddle-desktop)
[[ -x "$BINARY" ]] || die "Binary not found at $BINARY"

stage_root() {
  local root="$1"
  mkdir -p "$root/usr/bin" "$root/usr/lib/huddle" \
    "$root/usr/share/applications" "$root/usr/share/icons/hicolor/512x512/apps"
  install -m 0755 "$BINARY" "$root/usr/lib/huddle/huddle-desktop"
  ln -s ../lib/huddle/huddle-desktop "$root/usr/bin/huddle"
  install -m 0644 "$DESKTOP_FILE" "$root/usr/share/applications/com.huddle.desktop.desktop"
  install -m 0644 "$ICON" "$root/usr/share/icons/hicolor/512x512/apps/com.huddle.desktop.png"
}

case "$FORMAT" in
  tarball)
    work="$REPO_ROOT/target/linux-tarball-$ARCH"
    output="$DIST_DIR/Huddle-${VERSION}-linux-${ARCH}.tar.gz"
    rm -rf "$work" "$output"
    mkdir -p "$work/Huddle"
    install -m 0755 "$BINARY" "$work/Huddle/huddle"
    install -m 0644 "$ICON" "$work/Huddle/huddle.png"
    cp "$DESKTOP_FILE" "$work/Huddle/com.huddle.desktop.desktop"
    tar -czf "$output" -C "$work" Huddle
    rm -rf "$work"
    ;;
  appimage)
    tool="${APPIMAGETOOL:-appimagetool}"
    [[ "$tool" == */* ]] && [[ -x "$tool" ]] || command -v "$tool" >/dev/null || die "appimagetool is required."
    work="$REPO_ROOT/target/linux-appimage-$ARCH"
    appdir="$work/Huddle.AppDir"
    output="$DIST_DIR/Huddle-${VERSION}-linux-${ARCH}.AppImage"
    rm -rf "$work" "$output"
    stage_root "$appdir"
    cp "$DESKTOP_FILE" "$appdir/com.huddle.desktop.desktop"
    cp "$ICON" "$appdir/com.huddle.desktop.png"
    cat > "$appdir/AppRun" <<'RUN'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$HERE/usr/lib/huddle/huddle-desktop" "$@"
RUN
    chmod +x "$appdir/AppRun"
    if [[ "$tool" == *.AppImage ]]; then
      ARCH="$ARCH" "$tool" --appimage-extract-and-run "$appdir" "$output"
    else
      ARCH="$ARCH" "$tool" "$appdir" "$output"
    fi
    rm -rf "$work"
    ;;
  deb)
    work="$REPO_ROOT/target/linux-deb-$ARCH"
    root="$work/root"
    output="$DIST_DIR/Huddle-${VERSION}-linux-${ARCH}.deb"
    package_version="$(printf '%s' "$PACKAGE_VERSION" | sed -e 's/-/~/' -e 's/-/./g')"
    rm -rf "$work" "$output"
    stage_root "$root"
    mkdir -p "$root/DEBIAN"
    installed_size="$(du -sk "$root/usr" | cut -f1)"
    cat > "$root/DEBIAN/control" <<CONTROL
Package: huddle-desktop
Version: $package_version
Architecture: amd64
Maintainer: Oluwasetemi <Oluwasetemi@users.noreply.github.com>
Installed-Size: $installed_size
Depends: libc6, libgcc-s1, libfontconfig1, libxcb1, libwayland-client0, libxkbcommon0, libxkbcommon-x11-0, libvulkan1
Section: net
Priority: optional
Homepage: https://github.com/Oluwasetemi/huddle
Description: Huddle collaboration desktop client
 A native GPUI client for Huddle channels and messaging.
CONTROL
    dpkg-deb --root-owner-group --build "$root" "$output"
    rm -rf "$work"
    ;;
  rpm)
    work="$REPO_ROOT/target/linux-rpm-$ARCH"
    root="$work/root"
    top="$work/rpmbuild"
    output="$DIST_DIR/Huddle-${VERSION}-linux-${ARCH}.rpm"
    package_version="$(printf '%s' "$PACKAGE_VERSION" | sed -e 's/-/~/' -e 's/-/./g')"
    rm -rf "$work" "$output"
    stage_root "$root"
    mkdir -p "$top"/{BUILD,BUILDROOT,RPMS,SPECS,SOURCES,SRPMS}
    cat > "$top/SPECS/huddle-desktop.spec" <<SPEC
%global __os_install_post %{nil}
%global debug_package %{nil}
Name: huddle-desktop
Version: $package_version
Release: 1
Summary: Huddle collaboration desktop client
License: UNLICENSED
URL: https://github.com/Oluwasetemi/huddle
AutoReqProv: no
%description
A native GPUI client for Huddle channels and messaging.
%install
cp -a "$root/." "%{buildroot}/"
%files
/usr/bin/huddle
/usr/lib/huddle/huddle-desktop
/usr/share/applications/com.huddle.desktop.desktop
/usr/share/icons/hicolor/512x512/apps/com.huddle.desktop.png
SPEC
    rpmbuild -bb --define "_topdir $top" --target "$ARCH" "$top/SPECS/huddle-desktop.spec"
    built="$top/RPMS/$ARCH/huddle-desktop-$package_version-1.$ARCH.rpm"
    [[ -f "$built" ]] || die "RPM was not created at $built"
    cp "$built" "$output"
    rm -rf "$work"
    ;;
  *) die "Unknown format: $FORMAT" ;;
esac

[[ -f "$output" ]] || die "Expected artifact was not created: $output"
echo "Created $output"
