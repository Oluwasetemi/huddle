use gpui_kit::{
    actions, px, size, App, AppContext as _, Bounds, KeyBinding, Menu, MenuItem, QuitMode,
    TitlebarOptions, WindowBackgroundAppearance, WindowBounds, WindowOptions,
};
use huddle_ui::RootView;

actions!(huddle, [Quit]);

fn main() {
    gpui_kit::application()
        .with_assets(gpui_kit::assets::Assets)
        .with_quit_mode(QuitMode::LastWindowClosed)
        .run(|cx: &mut App| {
            gpui_kit::init(cx);

            cx.on_action(|_: &Quit, cx| cx.quit());
            cx.bind_keys([
                KeyBinding::new("cmd-q", Quit, None),
                KeyBinding::new("ctrl-q", Quit, None),
            ]);
            cx.set_menus([Menu::new("Huddle").items([MenuItem::action("Quit Huddle", Quit)])]);

            open_main_window(cx);
            cx.activate(true);
        });
}

fn open_main_window(cx: &mut App) {
    let bounds = Bounds::centered(None, size(px(1120.), px(740.)), cx);

    gpui_kit::open_window(
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            window_min_size: Some(size(px(780.), px(520.))),
            window_background: WindowBackgroundAppearance::Blurred,
            app_id: Some("com.huddle.desktop".into()),
            titlebar: Some(TitlebarOptions {
                title: Some("Huddle".into()),
                appears_transparent: true,
                ..Default::default()
            }),
            ..Default::default()
        },
        cx,
        |window, cx| {
            window.set_background_appearance(WindowBackgroundAppearance::Blurred);
            cx.new(|cx| RootView::new(window, cx))
        },
    )
    .expect("failed to open Huddle window");
}
