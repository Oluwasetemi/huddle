# Huddle Desktop

Native Rust desktop application for Huddle, scaffolded from `/Users/ojo/r/gpui-starter`.

## Workspace

```text
crates/
  ui/        # Theme + root view (`huddle-ui`)
  desktop/   # Native binary bootstrap (`huddle-desktop`)
```

## Run

```sh
just dev          # debug
just run          # release
just check        # typecheck
```

Or from the repository root:

```sh
pnpm dev:desktop
pnpm check:desktop
pnpm build:desktop
```

## Stack

- Rust 2021
- GPUI Kit fast-mode app stack through `gpui-kit = "=0.7.0"`
- `gpui_kit::application().with_assets(gpui_kit::assets::Assets)` bootstrap
- Kit `Sidebar`, `SidebarMenu`, `SidebarMenuItem`, `Button`, and scrollbar helpers for the Huddle shell

## Releases

Publishing a GitHub release with a SemVer tag matching the Cargo workspace version (for example, `v0.1.0`) runs `.github/workflows/desktop-release.yml`. The workflow builds and attaches:

- unsigned macOS DMGs for Apple silicon and Intel;
- a Windows x64 Inno Setup installer;
- Linux x86_64 tarball, AppImage, DEB, and RPM packages;
- `checksums.txt` containing SHA-256 hashes for every artifact.

No repository variables or secrets are required. Because the macOS application is not signed or notarized, macOS Gatekeeper may warn users when they open a downloaded build.

Packaging can also be exercised locally from `apps/desktop`:

```sh
scripts/build-linux.sh --version v0.1.0 --arch x86_64 \
  --target x86_64-unknown-linux-gnu
```

Release binaries use `cargo build --release --locked`. A tag whose version differs from `[workspace.package].version` fails before packaging.

## Desktop networking constraint

The desktop app must not use polling loops or connection pooling. The current shell has no networking or database dependency; future API integration should use direct user actions and websocket/event-driven updates.
