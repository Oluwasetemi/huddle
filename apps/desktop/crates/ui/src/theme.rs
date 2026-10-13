use gpui::{rgb, rgba, transparent_black, Hsla, Rgba};

/// Groknight palette + UI chrome tokens.
#[derive(Clone, Copy, Debug)]
pub struct Theme {
    pub foreground: Hsla,
    pub background: Hsla,
    pub cursor: Hsla,
    pub black: Hsla,
    pub red: Hsla,
    pub green: Hsla,
    pub yellow: Hsla,
    pub blue: Hsla,
    pub magenta: Hsla,
    pub cyan: Hsla,
    pub white: Hsla,
    pub bright_black: Hsla,
    pub bright_red: Hsla,
    pub bright_green: Hsla,
    pub bright_yellow: Hsla,
    pub bright_blue: Hsla,
    pub bright_magenta: Hsla,
    pub bright_cyan: Hsla,
    pub bright_white: Hsla,

    // Chrome
    pub sidebar_bg: Hsla,
    pub main_bg: Hsla,
    pub surface: Hsla,
    pub surface_raised: Hsla,
    pub border: Hsla,
    pub muted: Hsla,
    pub muted_strong: Hsla,
    pub hover: Hsla,
    pub selected: Hsla,
    pub accent: Hsla,
}

impl Theme {
    pub fn groknight() -> Self {
        let foreground = hex(0xe1e1e1);
        let background = hex(0x141414);
        let bright_black = hex(0x787878);
        let blue = hex(0x7aa2f7);

        Self {
            foreground,
            background,
            cursor: hex(0xc8c8c8),
            black: hex(0x0a0a0a),
            red: hex(0xf7768e),
            green: hex(0x9ece6a),
            yellow: hex(0xe0af68),
            blue,
            magenta: hex(0xbb9af7),
            cyan: hex(0x7dcfff),
            white: hex(0xc8c8c8),
            bright_black,
            bright_red: hex(0xff8fa3),
            bright_green: hex(0xb9f27c),
            bright_yellow: hex(0xffc777),
            bright_blue: hex(0x89b4fa),
            bright_magenta: hex(0xcba6f7),
            bright_cyan: hex(0x89ddff),
            bright_white: hex(0xf3f3f3),

            // Translucent chrome so WindowBackgroundAppearance::Blurred shows through.
            sidebar_bg: rgba(0x10101066).into(),
            main_bg: rgba(0x1414144d).into(),
            surface: rgba(0x1a1a1ab3).into(),
            surface_raised: rgba(0x222222cc).into(),
            border: rgba(0x2a2a2a99).into(),
            muted: bright_black,
            muted_strong: hex(0x9a9a9a),
            hover: rgba(0x1e1e1e99).into(),
            selected: rgba(0x252525a6).into(),
            accent: blue,
        }
    }

    /// Root fill must stay fully transparent so the system blur layer is visible.
    pub fn window_fill(self) -> Hsla {
        transparent_black()
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self::groknight()
    }
}

fn hex(value: u32) -> Hsla {
    let Rgba { r, g, b, a } = rgb(value);
    Rgba { r, g, b, a }.into()
}
