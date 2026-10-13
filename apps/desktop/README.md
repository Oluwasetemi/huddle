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

## Desktop networking constraint

The desktop app must not use polling loops or connection pooling. The current shell has no networking or database dependency; future API integration should use direct user actions and websocket/event-driven updates.
