mod api;

use api::{ApiMessage, LoadedWorkspace, WebSocketEvent};
use gpui_kit::component::{
    button::{Button, ButtonVariants as _},
    input::{Input, InputContentType, InputEvent, InputState},
    message_scroller::{MessageScroller, MessageScrollerState},
    sidebar::{Sidebar, SidebarCollapsible, SidebarMenu, SidebarMenuItem},
    Disableable as _, Selectable as _, Sizable as _,
};
use gpui_kit::{
    div, prelude::FluentBuilder as _, px, rgba, AppContext as _, AsyncApp, Context, Entity,
    FontWeight, Hsla, InteractiveElement as _, IntoElement, ParentElement as _, Render,
    SharedString, Styled as _, Subscription, WeakEntity, Window,
};
use serde::Deserialize;

#[derive(Clone)]
struct Channel {
    id: usize,
    name: String,
    summary: String,
    unread: u8,
}

#[derive(Clone)]
struct Message {
    id: usize,
    author: String,
    time: String,
    body: String,
    mine: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum AuthMode {
    Login,
    Register,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SocketMessageFrame {
    #[serde(rename = "type")]
    kind: String,
    channel_id: Option<usize>,
    message: Option<ApiMessage>,
}

pub struct RootView {
    auth_mode: AuthMode,
    signed_in: bool,
    selected_channel: usize,
    channels: Vec<Channel>,
    messages: Vec<Message>,
    message_scroller: Entity<MessageScrollerState>,
    loading: bool,
    posting: bool,
    status: String,
    api_base: String,
    token: Option<String>,
    socket_generation: u64,
    socket_connected: bool,
    _subscriptions: Vec<Subscription>,
    name_input: Entity<InputState>,
    email_input: Entity<InputState>,
    password_input: Entity<InputState>,
    composer_input: Entity<InputState>,
}

impl RootView {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let messages = sample_messages();
        let message_count = messages.len();
        let name_input = cx.new(|cx| InputState::new(window, cx).placeholder("Name"));
        let email_input = cx.new(|cx| InputState::new(window, cx).placeholder("Email"));
        let password_input = cx.new(|cx| InputState::new(window, cx).placeholder("Password"));
        let composer_input =
            cx.new(|cx| InputState::new(window, cx).placeholder("Write a message…"));
        let subscriptions = vec![cx.subscribe_in(
            &composer_input,
            window,
            |this, _, event: &InputEvent, window, cx| {
                if matches!(
                    event,
                    InputEvent::PressEnter {
                        secondary: false,
                        ..
                    }
                ) {
                    this.post_message(window, cx);
                }
            },
        )];

        Self {
            auth_mode: AuthMode::Login,
            signed_in: false,
            selected_channel: 0,
            channels: sample_channels(),
            messages,
            message_scroller: cx.new(|cx| MessageScrollerState::new(message_count, cx)),
            loading: false,
            posting: false,
            status: format!(
                "Sign in with your Huddle API account at {}.",
                api::default_api_base()
            ),
            api_base: api::default_api_base(),
            token: None,
            socket_generation: 0,
            socket_connected: false,
            _subscriptions: subscriptions,
            name_input,
            email_input,
            password_input,
            composer_input,
        }
    }

    fn submit_auth(&mut self, cx: &mut Context<Self>) {
        let name = self.name_input.read(cx).value().trim().to_string();
        let email = self.email_input.read(cx).value().trim().to_string();
        let password = self.password_input.read(cx).value().to_string();
        let auth_mode = self.auth_mode;

        if email.is_empty() || password.is_empty() {
            self.status = "Email and password are required.".to_string();
            cx.notify();
            return;
        }

        if auth_mode == AuthMode::Register && name.is_empty() {
            self.status = "Name is required to create an account.".to_string();
            cx.notify();
            return;
        }

        self.loading = true;
        self.status = match auth_mode {
            AuthMode::Login => "Signing in and loading channels…".to_string(),
            AuthMode::Register => "Creating account and loading channels…".to_string(),
        };
        cx.notify();

        cx.spawn(move |this: WeakEntity<RootView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let result = cx
                    .background_spawn(async move {
                        match auth_mode {
                            AuthMode::Login => api::login_and_load(email, password),
                            AuthMode::Register => api::register_and_load(name, email, password),
                        }
                    })
                    .await;
                this.update(&mut cx, |this, cx| {
                    this.apply_workspace_result(result, cx);
                    if this.signed_in {
                        this.start_channel_socket(cx);
                    }
                    cx.notify();
                })
                .ok();
            }
        })
        .detach();
    }

    fn set_auth_mode(&mut self, mode: AuthMode, cx: &mut Context<Self>) {
        self.auth_mode = mode;
        self.status = match mode {
            AuthMode::Login => format!(
                "Sign in with your Huddle API account at {}.",
                api::default_api_base()
            ),
            AuthMode::Register => format!(
                "Create a Huddle API account at {}.",
                api::default_api_base()
            ),
        };
        cx.notify();
    }

    fn start_channel_socket(&mut self, cx: &mut Context<Self>) {
        let Some(channel) = self.channels.get(self.selected_channel).cloned() else {
            return;
        };
        let api_base = self.api_base.clone();
        let generation = self.socket_generation.wrapping_add(1);
        self.socket_generation = generation;
        self.socket_connected = false;
        self.status = format!("Opening websocket for #{}…", channel.name);
        cx.notify();

        cx.spawn(move |this: WeakEntity<RootView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let socket_result = cx
                    .background_spawn(
                        async move { api::connect_channel_socket(&api_base, channel.id) },
                    )
                    .await;
                let mut socket = match socket_result {
                    Ok(socket) => socket,
                    Err(error) => {
                        this.update(&mut cx, |this, cx| {
                            if this.socket_generation == generation {
                                this.socket_connected = false;
                                this.status =
                                    format!("Websocket for #{} failed: {error}", channel.name);
                                cx.notify();
                            }
                        })
                        .ok();
                        return;
                    }
                };

                this.update(&mut cx, |this, cx| {
                    if this.socket_generation == generation {
                        this.socket_connected = true;
                        this.status = format!("Websocket live for #{}.", channel.name);
                        cx.notify();
                    }
                })
                .ok();

                loop {
                    let read_result = cx
                        .background_spawn(async move {
                            let event = socket.read_event();
                            (socket, event)
                        })
                        .await;
                    let (next_socket, event) = read_result;
                    socket = next_socket;

                    let should_continue = this
                        .update(&mut cx, |this, cx| {
                            if this.socket_generation != generation {
                                return false;
                            }

                            let keep_alive =
                                this.apply_socket_event(event, channel.id, &channel.name, cx);
                            cx.notify();
                            keep_alive
                        })
                        .unwrap_or(false);

                    if !should_continue {
                        break;
                    }
                }
            }
        })
        .detach();
    }

    fn apply_socket_event(
        &mut self,
        event: Result<WebSocketEvent, String>,
        channel_id: usize,
        channel_name: &str,
        cx: &mut Context<Self>,
    ) -> bool {
        match event {
            Ok(WebSocketEvent::Text(text)) => {
                let Ok(frame) = serde_json::from_str::<SocketMessageFrame>(&text) else {
                    return true;
                };

                match frame.kind.as_str() {
                    "connected" => {
                        self.socket_connected = true;
                        self.status = format!("Websocket live for #{channel_name}.");
                    }
                    "ping" => {
                        self.socket_connected = true;
                    }
                    "message.created" => {
                        if frame.channel_id != Some(channel_id) {
                            return true;
                        }
                        if let Some(message) = frame.message {
                            if !self
                                .messages
                                .iter()
                                .any(|existing| existing.id == message.id)
                            {
                                self.append_message(api_message_to_message(message), cx);
                            }
                            self.socket_connected = true;
                            self.status = format!("Realtime message received in #{channel_name}.");
                        }
                    }
                    _ => {}
                }
                true
            }
            Ok(WebSocketEvent::Ping) => {
                self.socket_connected = true;
                true
            }
            Ok(WebSocketEvent::Closed) => {
                self.socket_connected = false;
                self.status = format!("Websocket closed for #{channel_name}.");
                false
            }
            Err(error) => {
                self.socket_connected = false;
                self.status = format!("Websocket for #{channel_name} stopped: {error}");
                false
            }
        }
    }

    fn load_selected_channel(&mut self, cx: &mut Context<Self>) {
        self.socket_generation = self.socket_generation.wrapping_add(1);
        self.socket_connected = false;
        let Some(token) = self.token.clone() else {
            return;
        };
        let Some(channel) = self.channels.get(self.selected_channel).cloned() else {
            return;
        };
        let api_base = self.api_base.clone();

        self.loading = true;
        self.status = format!("Loading #{}…", channel.name);
        cx.notify();

        cx.spawn(move |this: WeakEntity<RootView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let result = cx
                    .background_spawn(
                        async move { api::list_messages(&api_base, &token, channel.id) },
                    )
                    .await;
                this.update(&mut cx, |this, cx| {
                    this.loading = false;
                    match result {
                        Ok(messages) => {
                            let messages =
                                messages.into_iter().map(api_message_to_message).collect();
                            this.replace_messages(messages, cx);
                            this.status =
                                format!("Loaded #{} from {}.", channel.name, this.api_base);
                            this.start_channel_socket(cx);
                        }
                        Err(error) => {
                            this.status = format!("Could not load #{}: {error}", channel.name);
                        }
                    }
                    cx.notify();
                })
                .ok();
            }
        })
        .detach();
    }

    fn post_message(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(token) = self.token.clone() else {
            self.status = "Sign in before posting a message.".to_string();
            cx.notify();
            return;
        };
        let Some(channel) = self.channels.get(self.selected_channel).cloned() else {
            return;
        };
        let text = self.composer_input.read(cx).value().trim().to_string();
        if text.is_empty() {
            self.status = "Write a message before sending.".to_string();
            cx.notify();
            return;
        }

        self.composer_input.update(cx, |state, cx| {
            state.set_value("", window, cx);
        });
        self.posting = true;
        self.status = format!("Posting to #{}…", channel.name);
        cx.notify();

        let api_base = self.api_base.clone();
        cx.spawn(move |this: WeakEntity<RootView>, cx: &mut AsyncApp| {
            let mut cx = cx.clone();
            async move {
                let result = cx
                    .background_spawn(async move {
                        api::post_message(&api_base, &token, channel.id, &text)
                    })
                    .await;
                this.update(&mut cx, |this, cx| {
                    this.posting = false;
                    match result {
                        Ok(message) => {
                            if !this
                                .messages
                                .iter()
                                .any(|existing| existing.id == message.id)
                            {
                                this.append_message(api_message_to_message(message), cx);
                            } else {
                                this.scroll_to_latest(cx);
                            }
                            this.status = format!("Posted to #{}.", channel.name);
                        }
                        Err(error) => {
                            this.status = format!("Could not post to #{}: {error}", channel.name);
                        }
                    }
                    cx.notify();
                })
                .ok();
            }
        })
        .detach();
    }

    fn replace_messages(&mut self, messages: Vec<Message>, cx: &mut Context<Self>) {
        let count = messages.len();
        self.messages = messages;
        self.message_scroller.update(cx, |state, cx| {
            state.reset(count, cx);
            state.scroll_to_end(cx);
        });
    }

    fn append_message(&mut self, message: Message, cx: &mut Context<Self>) {
        self.messages.push(message);
        self.message_scroller.update(cx, |state, cx| {
            let _ = state.append(1, cx);
            state.scroll_to_end(cx);
        });
    }

    fn scroll_to_latest(&mut self, cx: &mut Context<Self>) {
        self.message_scroller.update(cx, |state, cx| {
            state.scroll_to_end(cx);
        });
    }

    fn apply_workspace_result(
        &mut self,
        result: Result<LoadedWorkspace, String>,
        cx: &mut Context<Self>,
    ) {
        self.loading = false;

        match result {
            Ok(workspace) => {
                self.signed_in = true;
                self.api_base = workspace.api_base;
                self.token = Some(workspace.token);
                self.channels = workspace
                    .channels
                    .into_iter()
                    .enumerate()
                    .map(|(index, channel)| Channel {
                        id: channel.id,
                        summary: if index == 0 {
                            "Team-wide chat".to_string()
                        } else {
                            "Synced from API".to_string()
                        },
                        name: channel.name,
                        unread: 0,
                    })
                    .collect();
                let messages = workspace
                    .messages
                    .into_iter()
                    .map(api_message_to_message)
                    .collect();
                self.replace_messages(messages, cx);
                self.selected_channel = 0;
                self.status = format!(
                    "Connected to {} · {} channels · {} messages",
                    self.api_base,
                    self.channels.len(),
                    self.messages.len()
                );
            }
            Err(error) => {
                self.status = match self.auth_mode {
                    AuthMode::Login => format!("Sign in failed: {error}"),
                    AuthMode::Register => format!("Create account failed: {error}"),
                };
            }
        }
    }
}

impl Render for RootView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.signed_in {
            return self.render_login(window, cx);
        }

        div()
            .size_full()
            .bg(app_bg())
            .text_color(text())
            .font_family("Inter")
            .child(
                div()
                    .flex()
                    .size_full()
                    .bg(rgba(0xf6f2eaff))
                    .child(self.render_sidebar(cx))
                    .child(self.render_channel_panel(cx)),
            )
    }
}

impl RootView {
    fn render_login(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> gpui_kit::Div {
        let is_register = self.auth_mode == AuthMode::Register;

        div()
            .size_full()
            .bg(app_bg())
            .text_color(text())
            .font_family("Inter")
            .flex()
            .items_center()
            .justify_center()
            .p(px(34.))
            .child(
                div()
                    .w(px(620.))
                    .p(px(48.))
                    .rounded(px(34.))
                    .border_1()
                    .border_color(border())
                    .bg(surface())
                    .shadow_lg()
                    .child(eyebrow("HUDDLE DESKTOP"))
                    .child(
                        div()
                            .mt(px(10.))
                            .text_size(px(48.))
                            .font_weight(FontWeight::BOLD)
                            .child("Bring the team back into one calm room."),
                    )
                    .child(
                        div()
                            .mt(px(18.))
                            .text_size(px(16.))
                            .text_color(muted())
                            .child(if is_register {
                                "Create an account, then Huddle will load channels and realtime messages."
                            } else {
                                "Sign in with your Huddle API credentials to load channels and post messages."
                            }),
                    )
                    .child(
                        div()
                            .mt(px(24.))
                            .flex()
                            .gap_2()
                            .p(px(5.))
                            .rounded(px(18.))
                            .border_1()
                            .border_color(border())
                            .bg(rgba(0xffffff91))
                            .child(
                                Button::new("auth-login-tab")
                                    .ghost()
                                    .large()
                                    .selected(!is_register)
                                    .label("Log in")
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.set_auth_mode(AuthMode::Login, cx);
                                    })),
                            )
                            .child(
                                Button::new("auth-register-tab")
                                    .ghost()
                                    .large()
                                    .selected(is_register)
                                    .label("Create account")
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.set_auth_mode(AuthMode::Register, cx);
                                    })),
                            ),
                    )
                    .child(
                        div()
                            .mt(px(24.))
                            .flex()
                            .flex_col()
                            .gap_3()
                            .when(is_register, |this| {
                                this.child(field_label(
                                    "Name",
                                    Input::new(&self.name_input)
                                        .large()
                                        .content_type(InputContentType::Name),
                                ))
                            })
                            .child(field_label(
                                "Email",
                                Input::new(&self.email_input)
                                    .large()
                                    .content_type(InputContentType::EmailAddress),
                            ))
                            .child(field_label(
                                "Password",
                                Input::new(&self.password_input)
                                    .large()
                                    .content_type(if is_register {
                                        InputContentType::NewPassword
                                    } else {
                                        InputContentType::Password
                                    })
                                    .mask_toggle(),
                            ))
                            .child(
                                Button::new("auth-submit")
                                    .primary()
                                    .large()
                                    .label(match (is_register, self.loading) {
                                        (true, true) => "Creating account…",
                                        (true, false) => "Create Huddle account",
                                        (false, true) => "Signing in…",
                                        (false, false) => "Sign in",
                                    })
                                    .disabled(self.loading)
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.submit_auth(cx);
                                    })),
                            )
                            .child(
                                div()
                                    .text_size(px(12.))
                                    .text_color(muted())
                                    .child(SharedString::from(self.status.clone())),
                            ),
                    ),
            )
    }

    fn render_sidebar(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let menu = SidebarMenu::new().children(self.channels.iter().enumerate().map(
            |(index, channel)| {
                SidebarMenuItem::new(format!("#{}", channel.name))
                    .active(index == self.selected_channel)
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.selected_channel = index;
                        this.load_selected_channel(cx);
                    }))
                    .suffix({
                        let unread = channel.unread;
                        move |_, _| unread_badge(unread)
                    })
            },
        ));

        Sidebar::new("huddle-sidebar")
            .collapsible(SidebarCollapsible::None)
            .w(px(320.))
            .bg(rgba(0xfffbf5ee))
            .border_color(border())
            .header(
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .p(px(12.))
                    .child(eyebrow("HUDDLE"))
                    .child(
                        div()
                            .text_size(px(36.))
                            .font_weight(FontWeight::BOLD)
                            .child("Huddle"),
                    )
                    .child(
                        div()
                            .text_size(px(13.))
                            .text_color(muted())
                            .child("Native channel workspace"),
                    ),
            )
            .child(menu)
            .footer(
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .w_full()
                    .p(px(10.))
                    .child(status_card(
                        &self.status,
                        self.loading || self.posting,
                        self.token.is_some(),
                        self.socket_connected,
                    ))
                    .child(
                        Button::new("logout")
                            .ghost()
                            .small()
                            .label("Log out")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.signed_in = false;
                                this.token = None;
                                this.socket_generation = this.socket_generation.wrapping_add(1);
                                this.socket_connected = false;
                                this.status =
                                    "Signed out. Enter your credentials to reconnect.".to_string();
                                cx.notify();
                            })),
                    ),
            )
    }

    fn render_channel_panel(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        let channel = self
            .channels
            .get(self.selected_channel)
            .cloned()
            .unwrap_or(Channel {
                id: 1,
                name: "general".to_string(),
                summary: "Team-wide chat".to_string(),
                unread: 0,
            });

        div()
            .flex()
            .flex_col()
            .flex_1()
            .h_full()
            .p(px(28.))
            .gap_5()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .min_h_0()
                    .rounded(px(34.))
                    .border_1()
                    .border_color(border())
                    .bg(surface())
                    .shadow_lg()
                    .overflow_hidden()
                    .child(channel_header(
                        &channel,
                        self.token.is_some(),
                        self.socket_connected,
                    ))
                    .child(self.message_scroller())
                    .child(self.composer(cx)),
            )
    }

    fn composer(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .items_center()
            .gap_3()
            .p(px(20.))
            .border_t_1()
            .border_color(border())
            .bg(rgba(0xffffff57))
            .child(Input::new(&self.composer_input).large().flex_1())
            .child(
                Button::new("send-message")
                    .primary()
                    .label(if self.posting { "Sending…" } else { "Send" })
                    .disabled(self.posting || self.loading)
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.post_message(window, cx);
                    })),
            )
    }
}

fn field_label(label: &'static str, input: impl IntoElement) -> impl IntoElement {
    div()
        .flex()
        .flex_col()
        .gap_1()
        .child(
            div()
                .text_size(px(12.))
                .font_weight(FontWeight::BOLD)
                .text_color(muted())
                .child(label),
        )
        .child(input)
}

fn channel_header(channel: &Channel, connected: bool, socket_connected: bool) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .justify_between()
        .gap_4()
        .px(px(28.))
        .py(px(24.))
        .border_b_1()
        .border_color(border())
        .child(
            div()
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .text_size(px(32.))
                        .font_weight(FontWeight::BOLD)
                        .child(SharedString::from(format!("#{}", channel.name))),
                )
                .child(
                    div()
                        .text_size(px(13.))
                        .text_color(muted())
                        .child(SharedString::from(format!(
                            "{} · API channel {}",
                            channel.summary, channel.id
                        ))),
                ),
        )
        .child(live_pill(connected, socket_connected))
}

impl RootView {
    fn message_scroller(&self) -> impl IntoElement {
        if self.messages.is_empty() {
            return div()
                .id("message-scroller-empty")
                .flex()
                .flex_col()
                .flex_1()
                .min_h_0()
                .p(px(28.))
                .child(
                    div()
                        .text_color(muted())
                        .text_size(px(15.))
                        .child("No messages yet. Send one from the composer below."),
                )
                .into_any_element();
        }

        let messages = self.messages.clone();
        MessageScroller::new(
            "message-scroller",
            self.message_scroller.clone(),
            move |index, _, _| {
                if let Some(message) = messages.get(index) {
                    message_bubble(message).into_any_element()
                } else {
                    div().into_any_element()
                }
            },
        )
        .flex_1()
        .min_h_0()
        .p(px(28.))
        .with_jump_button_label("Jump to latest")
        .with_bottom_fade(surface())
        .into_any_element()
    }
}

fn message_bubble(message: &Message) -> impl IntoElement {
    div()
        .id(("message", message.id))
        .flex()
        .w_full()
        .when(message.mine, |this| this.justify_end())
        .child(
            div()
                .w(px(620.))
                .max_w_full()
                .p(px(17.))
                .rounded(px(24.))
                .border_1()
                .border_color(border())
                .bg(if message.mine {
                    rgba(0xdf6d3124)
                } else {
                    rgba(0xffffffff)
                })
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .gap_3()
                        .text_size(px(13.))
                        .text_color(muted())
                        .child(
                            div()
                                .font_weight(FontWeight::BOLD)
                                .text_color(text())
                                .child(SharedString::from(message.author.clone())),
                        )
                        .child(SharedString::from(message.time.clone())),
                )
                .child(
                    div()
                        .mt(px(9.))
                        .text_size(px(15.))
                        .text_color(text())
                        .child(SharedString::from(message.body.clone())),
                ),
        )
}

fn status_card(
    status: &str,
    loading: bool,
    connected: bool,
    socket_connected: bool,
) -> impl IntoElement {
    div()
        .p(px(14.))
        .rounded(px(18.))
        .bg(if connected {
            rgba(0xdf6d3120)
        } else {
            rgba(0xffffffb8)
        })
        .border_1()
        .border_color(if connected {
            rgba(0xdf6d314f).into()
        } else {
            border()
        })
        .child(
            div()
                .text_size(px(13.))
                .font_weight(FontWeight::BOLD)
                .child(if loading {
                    "Working"
                } else if socket_connected {
                    "Websocket connected"
                } else if connected {
                    "Endpoint connected"
                } else {
                    "Endpoint offline"
                }),
        )
        .child(
            div()
                .mt(px(5.))
                .text_size(px(12.))
                .text_color(muted())
                .child(SharedString::from(status.to_string())),
        )
}

fn unread_badge(unread: u8) -> impl IntoElement {
    div()
        .when(unread == 0, |this| this.opacity(0.))
        .px(px(8.))
        .py(px(3.))
        .rounded(px(999.))
        .bg(accent())
        .text_color(rgba(0xffffffff))
        .text_size(px(11.))
        .font_weight(FontWeight::BOLD)
        .child(SharedString::from(unread.to_string()))
}

fn live_pill(connected: bool, socket_connected: bool) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .gap_2()
        .px(px(12.))
        .py(px(8.))
        .rounded(px(999.))
        .bg(rgba(0xffffffb8))
        .border_1()
        .border_color(border())
        .text_size(px(12.))
        .font_weight(FontWeight::BOLD)
        .text_color(muted())
        .child(
            div()
                .size(px(9.))
                .rounded(px(999.))
                .bg(if socket_connected {
                    rgba(0x20a36bff)
                } else if connected {
                    rgba(0xdf6d31ff)
                } else {
                    rgba(0xc4b9adff)
                }),
        )
        .child(if socket_connected {
            "Socket live"
        } else if connected {
            "API live"
        } else {
            "API offline"
        })
}

fn eyebrow(text_value: &'static str) -> impl IntoElement {
    div()
        .text_size(px(11.))
        .font_weight(FontWeight::BOLD)
        .text_color(accent_strong())
        .child(text_value)
}

fn sample_channels() -> Vec<Channel> {
    vec![Channel {
        id: 1,
        name: "general".to_string(),
        summary: "Sign in to load API channels".to_string(),
        unread: 0,
    }]
}

fn sample_messages() -> Vec<Message> {
    vec![Message {
        id: 1,
        author: "Huddle Desktop".to_string(),
        time: "Signed out".to_string(),
        body: "Enter your email and password to fetch channels. Posting will use the selected channel after sign-in.".to_string(),
        mine: false,
    }]
}

fn api_message_to_message(message: ApiMessage) -> Message {
    Message {
        id: message.id,
        author: message.author.name,
        time: display_time(&message.created_at),
        body: message.text,
        mine: false,
    }
}

fn display_time(value: &str) -> String {
    value
        .split('T')
        .nth(1)
        .and_then(|time| time.get(0..5))
        .map_or_else(|| value.to_string(), ToString::to_string)
}

fn app_bg() -> Hsla {
    rgba(0xf6f2eaff).into()
}

fn surface() -> Hsla {
    rgba(0xffffffd1).into()
}

fn text() -> Hsla {
    rgba(0x221b16ff).into()
}

fn muted() -> Hsla {
    rgba(0x756b62ff).into()
}

fn border() -> Hsla {
    rgba(0x402e221f).into()
}

fn accent() -> Hsla {
    rgba(0xdf6d31ff).into()
}

fn accent_strong() -> Hsla {
    rgba(0x9f3f18ff).into()
}
