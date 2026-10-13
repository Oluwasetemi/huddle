# Repository Guidelines

This file explains how humans and coding agents should work in **Huddle Desktop**. Start with the beginner workflow if the project is unfamiliar; use the advanced guidance when changing architecture, state, reusable components, or window behavior.

## Project at a Glance

Huddle Desktop is a small Rust 2021 workspace for a native desktop application built with [GPUI](https://www.gpui.rs/).

```text
.
├── Cargo.toml                 # Workspace members and shared dependencies
├── justfile                   # Short development commands
├── crates/
│   ├── desktop/               # Native application bootstrap
│   │   ├── assets/            # Application icon files
│   │   └── src/main.rs        # Application, menu, keybindings, and window setup
│   └── ui/                    # Reusable UI and application state
│       ├── src/lib.rs         # Public API and RootView
│       ├── src/button.rs      # Button component and variants
│       ├── src/theme.rs       # Runtime theme tokens
│       └── themes/groknight.json # Bundled/reference Groknight palette
└── README.md                  # Short project overview
```

The workspace contains two crates:

| Crate | Package | Responsibility |
| --- | --- | --- |
| `crates/desktop` | `huddle-desktop` | Starts GPUI, registers global actions, configures the native window, and mounts the root view. |
| `crates/ui` | `huddle-ui` | Owns views, components, local UI state, styling, and theme tokens. |

**Ownership rule:** put behavior in the crate that owns it. Window and application lifecycle code belongs in `desktop`; reusable visual behavior belongs in `ui`. Expose cross-crate APIs through the owning crate's `src/lib.rs` instead of reaching into private modules.

## Beginner Quick Start

### Prerequisites

Install:

- A current stable Rust toolchain through [rustup](https://rustup.rs/).
- [`just`](https://github.com/casey/just) for the repository shortcuts.
- The native build tools required by Rust and GPUI for your operating system.

Confirm the tools are available:

```sh
rustc --version
cargo --version
just --version
```

### Run the application

```sh
just dev
```

The app opens a `960 × 640` window containing the Huddle desktop shell. Quit with **⌘Q** on macOS or **Ctrl+Q** on other supported platforms.

### Make a first change

A safe first change is editing the empty-state label in `crates/ui/src/lib.rs`:

```rust
let status: SharedString = if self.clicks == 0 {
    "Choose a button".into()
} else {
    format!("Clicked {n}×", n = self.clicks).into()
};
```

Then format, check, and run the app:

```sh
cargo fmt --all
just check
just dev
```

For a visible change, manually verify normal, hover, active, and click behavior before considering the work complete.

## Development Commands

| Command | Purpose | When to use it |
| --- | --- | --- |
| `just dev` | Run `huddle-desktop` in debug mode. | Normal development and visual checks. |
| `just run` | Run the optimized release build. | Confirm release-mode behavior or performance. |
| `just build` | Build the desktop binary in release mode. | Produce or validate an optimized binary. |
| `just check` | Type-check both workspace crates. | Fast validation after Rust changes. |
| `cargo fmt --all` | Format all Rust code. | Before finishing any Rust edit. |
| `cargo fmt --all -- --check` | Verify formatting without changing files. | CI-style validation. |
| `cargo clippy --workspace --all-targets` | Run Rust lints across the workspace. | Before a PR or after non-trivial changes. |
| `cargo test --workspace` | Run workspace tests and test builds. | When behavior changes or tests are added. |

Use package-specific Cargo commands when iterating on one crate:

```sh
cargo check -p huddle-ui
cargo check -p huddle-desktop
```

Do not claim a command passed unless you actually ran it. If a command cannot run because of the local environment, report the command and the exact blocker.

## Recommended Workflow

1. **Read before editing.** Inspect the target module, its crate's `Cargo.toml`, and nearby patterns.
2. **Choose the owning crate.** Keep native lifecycle concerns in `desktop` and reusable UI concerns in `ui`.
3. **Make the smallest coherent change.** Avoid unrelated refactors, speculative abstractions, or new dependencies.
4. **Format and type-check.** Run `cargo fmt --all` and at least `just check`.
5. **Run focused validation.** Add tests for meaningful logic; run `cargo clippy --workspace --all-targets` for non-trivial work.
6. **Inspect the UI.** Run `just dev` for changes to layout, colors, interaction, window options, or rendering.
7. **Summarize precisely.** State what changed, why, what was validated, and any remaining limitations.

## Coding Style

Follow standard Rust and `rustfmt` conventions:

- Four-space indentation; never hand-align code against `rustfmt`.
- `snake_case` for modules, functions, variables, and tests.
- `PascalCase` for structs, enums, and traits.
- `SCREAMING_SNAKE_CASE` for constants.
- Prefer explicit, domain-specific names over abbreviations.
- Keep functions focused and place helpers near the behavior they support.
- Use comments to explain constraints or intent, not to restate the code.
- Avoid `unwrap()` in recoverable application paths. At process boundaries, use an error message that explains the failed operation.
- Do not add dependencies when GPUI, the standard library, or a small local helper already solves the problem clearly.

### Imports and public APIs

Let `rustfmt` normalize imports. In `crates/ui/src/lib.rs`, keep modules private unless callers need the module itself, and re-export the smallest useful API:

```rust
mod status_badge;

pub use status_badge::{StatusBadge, StatusKind};
```

This allows the desktop crate to use `gpui_starter_ui::StatusBadge` without depending on the UI crate's internal file layout.

## Advanced GPUI Guidance

### Mental model

GPUI code in this repository follows a few important patterns:

- `RootView` owns application UI state such as `clicks`.
- `impl Render for RootView` derives the current element tree from that state.
- Reusable, value-like components such as `Button` use `#[derive(IntoElement)]` and `RenderOnce`.
- Event handlers that mutate a view should be created with `cx.listener(...)`.
- After mutating render-relevant state, call `cx.notify()` to request another render.
- Stable element IDs are important for interactive elements.
- The root fill remains transparent because the desktop window uses `WindowBackgroundAppearance::Blurred`.

### State update example

Use the existing listener pattern when an event changes `RootView` state:

```rust
Button::new("save-button", "Save")
    .theme(theme)
    .on_click(cx.listener(|this, _, _, cx| {
        this.clicks += 1;
        cx.notify();
    }))
```

If `cx.notify()` is omitted, the state may change without the visible UI updating.

### Reusable component example

Builder-style component APIs should provide sensible defaults and keep call sites readable:

```rust
Button::new("delete-button", "Delete")
    .variant(ButtonVariant::Danger)
    .theme(theme)
    .on_click(cx.listener(|this, _, _, cx| {
        this.clicks += 1;
        cx.notify();
    }))
```

When adding a component:

1. Put it in a focused module under `crates/ui/src/`.
2. Keep internal styling details private.
3. Expose only the types and methods consumers need.
4. Re-export the public surface from `crates/ui/src/lib.rs`.
5. Demonstrate or consume it in `RootView` when appropriate.
6. Verify all interaction states in the running app.

## Theme and Visual Changes

Runtime theme values live in `crates/ui/src/theme.rs`. The palette in `crates/ui/themes/groknight.json` is bundled/reference theme data and currently mirrors the base Groknight colors. If a shared palette color changes, check whether both files should stay aligned.

Preserve these visual constraints unless the task explicitly changes the design:

- `Theme::window_fill()` must remain fully transparent for system blur to show through.
- Chrome surfaces use translucent colors rather than opaque replacements.
- Components should use `Theme` tokens instead of scattering unrelated color literals.
- Interactive components should define normal, hover, active, and disabled states when applicable.
- Text and controls should retain readable contrast on the blurred dark background.

When adding a new semantic color, prefer a named theme token over repeating the same raw color in several components.

## Desktop and Window Changes

Edit `crates/desktop/src/main.rs` for:

- App startup and shutdown behavior.
- Global actions and keybindings.
- Native menus.
- Window size, titlebar, background appearance, or application ID.
- Mounting the root GPUI view.

Keep product UI and reusable controls out of `main.rs`. The desktop crate should bootstrap the app, not become a second UI implementation.

When adding a keybinding, define an action first and register both the action handler and keybinding:

```rust
actions!(gpui_starter, [Quit]);

cx.on_action(|_: &Quit, cx| cx.quit());
cx.bind_keys([KeyBinding::new("cmd-q", Quit, None)]);
```

Consider cross-platform shortcuts when the feature is expected to work outside macOS.

## Testing and Validation

The repository currently has little pure logic, so visual validation is important. Still, extract and test logic when it can be checked without opening a window.

Use this validation matrix:

| Change | Minimum validation |
| --- | --- |
| Documentation only | Read the rendered Markdown and verify commands/paths. |
| Rust implementation | `cargo fmt --all -- --check` and `just check`. |
| Component behavior | Rust checks plus `just dev` and manual interaction. |
| Theme or layout | Rust checks plus visual review at the default and minimum window sizes. |
| Window/bootstrap | Rust checks plus launch, quit shortcut, and window-behavior verification. |
| New logic or bug fix | Add focused tests where practical, then run `cargo test --workspace`. |
| Broad or release-facing work | All of the above plus `cargo clippy --workspace --all-targets` and `just build`. |

Good tests protect behavior rather than restating implementation details. Prefer testing conversions, state transitions, parsing, and invariants over snapshotting trivial builder chains.

## Common Mistakes

- Putting reusable UI code in `crates/desktop/src/main.rs`.
- Making a UI module public instead of re-exporting a small API from `lib.rs`.
- Mutating view state without calling `cx.notify()`.
- Using duplicate or unstable IDs for clickable elements.
- Replacing transparent window fills with opaque backgrounds and accidentally disabling blur.
- Updating `theme.rs` while forgetting the corresponding bundled palette, or vice versa.
- Running only `cargo check` and skipping visual verification for a visible change.
- Introducing an abstraction for a single simple use case before a real reuse pattern exists.

## Commit and Pull Request Guidelines

Use short, imperative commit subjects, optionally scoped:

```text
ui: add warning button state
desktop: refine quit keybindings
docs: expand contributor guide
```

Keep commits focused. A pull request should include:

- **Motivation:** what problem or user need prompted the change.
- **Summary:** the important implementation decisions.
- **Validation:** exact commands and manual checks performed.
- **Visual evidence:** screenshots or a short recording for visible GPUI changes.
- **Follow-ups:** known limitations or intentionally deferred work.

Do not mix formatting churn, unrelated cleanup, and feature work in one change.

## Resources

### Project-specific

- [GPUI official site and guide](https://www.gpui.rs/)
- [GPUI documentation and examples](https://www.gpui.rs/docs/)
- [GPUI API documentation](https://docs.rs/gpui/)
- [GPUI source in the Zed repository](https://github.com/zed-industries/zed/tree/main/crates/gpui)
- [Zed repository](https://github.com/zed-industries/zed) for production GPUI patterns

Because this workspace tracks GPUI from Zed's Git repository rather than a pinned crates.io release, APIs may differ from older tutorials. Treat the checked-out dependency and current compiler errors as authoritative.

### Rust fundamentals

- [The Rust Programming Language](https://doc.rust-lang.org/book/)
- [The Cargo Book](https://doc.rust-lang.org/cargo/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- [Clippy lint documentation](https://rust-lang.github.io/rust-clippy/master/)
- [`rustfmt` documentation](https://github.com/rust-lang/rustfmt)

When framework documentation and repository code disagree, prefer this repository's locked dependency version and existing local patterns, then update the guide if the project intentionally adopts a newer API.