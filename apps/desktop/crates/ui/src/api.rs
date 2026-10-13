use std::{
    env,
    fmt::Write as _,
    io::{ErrorKind, Read as _, Write as _},
    net::TcpStream,
    time::Duration,
};

use serde::{Deserialize, Serialize};

const DEFAULT_API_BASE: &str = "http://127.0.0.1:4444";

#[derive(Debug, Clone, Deserialize)]
pub struct ApiChannel {
    pub id: usize,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApiAuthor {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMessage {
    pub id: usize,
    pub text: String,
    pub created_at: String,
    pub author: ApiAuthor,
}

#[derive(Debug, Deserialize)]
pub struct AuthResponse {
    pub token: String,
}

#[derive(Debug, Serialize)]
struct LoginRequest<'a> {
    email: &'a str,
    password: &'a str,
}

#[derive(Debug, Serialize)]
struct RegisterRequest<'a> {
    name: &'a str,
    email: &'a str,
    password: &'a str,
}

#[derive(Debug, Serialize)]
struct MessageRequest<'a> {
    text: &'a str,
}

#[derive(Debug, Clone)]
pub struct LoadedWorkspace {
    pub api_base: String,
    pub token: String,
    pub channels: Vec<ApiChannel>,
    pub messages: Vec<ApiMessage>,
}

pub fn default_api_base() -> String {
    env::var("HUDDLE_API_URL").unwrap_or_else(|_| DEFAULT_API_BASE.to_string())
}

pub fn login_and_load(email: String, password: String) -> Result<LoadedWorkspace, String> {
    let api_base = default_api_base();
    let token = login(&api_base, &email, &password)?;
    load_workspace(api_base, token)
}

pub fn register_and_load(
    name: String,
    email: String,
    password: String,
) -> Result<LoadedWorkspace, String> {
    let api_base = default_api_base();
    let token = register(&api_base, &name, &email, &password)?;
    load_workspace(api_base, token)
}

fn load_workspace(api_base: String, token: String) -> Result<LoadedWorkspace, String> {
    let channels = list_channels(&api_base, &token)?;
    let first_channel_id = channels.first().map(|channel| channel.id).unwrap_or(1);
    let messages = list_messages(&api_base, &token, first_channel_id)?;

    Ok(LoadedWorkspace {
        api_base,
        token,
        channels,
        messages,
    })
}

pub fn login(api_base: &str, email: &str, password: &str) -> Result<String, String> {
    let login_body = serde_json::to_string(&LoginRequest { email, password })
        .map_err(|error| error.to_string())?;
    let auth: AuthResponse =
        request_json(api_base, "POST", "/auth/login", Some(&login_body), None)?;
    Ok(auth.token)
}

pub fn register(api_base: &str, name: &str, email: &str, password: &str) -> Result<String, String> {
    let register_body = serde_json::to_string(&RegisterRequest {
        name,
        email,
        password,
    })
    .map_err(|error| error.to_string())?;
    let auth: AuthResponse = request_json(
        api_base,
        "POST",
        "/auth/register",
        Some(&register_body),
        None,
    )?;
    Ok(auth.token)
}

pub fn list_channels(api_base: &str, token: &str) -> Result<Vec<ApiChannel>, String> {
    request_json(api_base, "GET", "/channels", None, Some(token))
}

pub fn list_messages(
    api_base: &str,
    token: &str,
    channel_id: usize,
) -> Result<Vec<ApiMessage>, String> {
    request_json(
        api_base,
        "GET",
        &format!("/channels/{channel_id}/messages?limit=50"),
        None,
        Some(token),
    )
}

pub fn post_message(
    api_base: &str,
    token: &str,
    channel_id: usize,
    text: &str,
) -> Result<ApiMessage, String> {
    let body =
        serde_json::to_string(&MessageRequest { text }).map_err(|error| error.to_string())?;
    request_json(
        api_base,
        "POST",
        &format!("/channels/{channel_id}/messages"),
        Some(&body),
        Some(token),
    )
}

#[derive(Debug)]
pub enum WebSocketEvent {
    Closed,
    Ping,
    Text(String),
}

pub struct ChannelSocket {
    stream: TcpStream,
}

impl ChannelSocket {
    pub fn read_event(&mut self) -> Result<WebSocketEvent, String> {
        loop {
            let mut header = [0_u8; 2];
            self.stream
                .read_exact(&mut header)
                .map_err(|error| match error.kind() {
                    ErrorKind::UnexpectedEof => "websocket closed".to_string(),
                    _ => format!("websocket read failed: {error}"),
                })?;

            let opcode = header[0] & 0x0f;
            let masked = header[1] & 0x80 != 0;
            let mut length = u64::from(header[1] & 0x7f);
            if length == 126 {
                let mut extended = [0_u8; 2];
                self.stream
                    .read_exact(&mut extended)
                    .map_err(|error| error.to_string())?;
                length = u64::from(u16::from_be_bytes(extended));
            } else if length == 127 {
                let mut extended = [0_u8; 8];
                self.stream
                    .read_exact(&mut extended)
                    .map_err(|error| error.to_string())?;
                length = u64::from_be_bytes(extended);
            }

            if length > 1_048_576 {
                return Err("websocket frame is too large".to_string());
            }

            let mask = if masked {
                let mut mask = [0_u8; 4];
                self.stream
                    .read_exact(&mut mask)
                    .map_err(|error| error.to_string())?;
                Some(mask)
            } else {
                None
            };

            let mut payload = vec![0_u8; length as usize];
            self.stream
                .read_exact(&mut payload)
                .map_err(|error| error.to_string())?;
            if let Some(mask) = mask {
                for (index, byte) in payload.iter_mut().enumerate() {
                    *byte ^= mask[index % 4];
                }
            }

            match opcode {
                0x1 => {
                    return String::from_utf8(payload)
                        .map(WebSocketEvent::Text)
                        .map_err(|error| format!("invalid websocket text: {error}"));
                }
                0x8 => return Ok(WebSocketEvent::Closed),
                0x9 => return Ok(WebSocketEvent::Ping),
                0xa | 0x0 => continue,
                _ => return Err(format!("unsupported websocket opcode {opcode}")),
            }
        }
    }
}

pub fn connect_channel_socket(api_base: &str, channel_id: usize) -> Result<ChannelSocket, String> {
    let endpoint = Endpoint::parse(api_base)?;
    let path = format!("/ws/channels/{channel_id}");
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
        host = endpoint.host_header,
    );

    let mut stream = TcpStream::connect((&*endpoint.host, endpoint.port))
        .map_err(|error| format!("could not open websocket at {api_base}: {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(90)))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(8)))
        .map_err(|error| error.to_string())?;
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut response = Vec::new();
    let mut byte = [0_u8; 1];
    while !response.ends_with(b"\r\n\r\n") {
        stream
            .read_exact(&mut byte)
            .map_err(|error| format!("websocket handshake failed: {error}"))?;
        response.push(byte[0]);
        if response.len() > 8192 {
            return Err("websocket handshake response was too large".to_string());
        }
    }

    let response = String::from_utf8_lossy(&response);
    let status_line = response.lines().next().unwrap_or_default();
    if !status_line.contains(" 101 ") {
        return Err(format!("websocket upgrade failed: {status_line}"));
    }

    Ok(ChannelSocket { stream })
}

fn request_json<T: for<'de> Deserialize<'de>>(
    api_base: &str,
    method: &str,
    path: &str,
    body: Option<&str>,
    token: Option<&str>,
) -> Result<T, String> {
    let response = request(api_base, method, path, body, token)?;
    serde_json::from_str(&response).map_err(|error| format!("invalid API JSON: {error}"))
}

fn request(
    api_base: &str,
    method: &str,
    path: &str,
    body: Option<&str>,
    token: Option<&str>,
) -> Result<String, String> {
    let endpoint = Endpoint::parse(api_base)?;
    let body = body.unwrap_or("");
    let mut request = String::new();
    write!(
        request,
        "{method} {path} HTTP/1.1\r\nHost: {}\r\nAccept: application/json\r\nConnection: close\r\n",
        endpoint.host_header
    )
    .map_err(|error| error.to_string())?;

    if let Some(token) = token {
        write!(request, "Authorization: Bearer {token}\r\n").map_err(|error| error.to_string())?;
    }

    if !body.is_empty() {
        write!(
            request,
            "Content-Type: application/json\r\nContent-Length: {}\r\n",
            body.len()
        )
        .map_err(|error| error.to_string())?;
    }

    request.push_str("\r\n");
    request.push_str(body);

    let mut stream = TcpStream::connect((&*endpoint.host, endpoint.port))
        .map_err(|error| format!("could not reach {api_base}: {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(8)))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(8)))
        .map_err(|error| error.to_string())?;
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|error| error.to_string())?;

    let (head, response_body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "invalid HTTP response".to_string())?;
    let status_line = head.lines().next().unwrap_or_default();
    let status = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or_else(|| format!("invalid HTTP status: {status_line}"))?;

    let body = if head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        decode_chunked(response_body)?
    } else {
        response_body.to_string()
    };

    if !(200..300).contains(&status) {
        return Err(format!("API returned {status}: {body}"));
    }

    Ok(body)
}

fn decode_chunked(input: &str) -> Result<String, String> {
    let mut rest = input;
    let mut decoded = String::new();

    loop {
        let (size_line, after_size) = rest
            .split_once("\r\n")
            .ok_or_else(|| "invalid chunked response".to_string())?;
        let size = usize::from_str_radix(size_line.trim(), 16)
            .map_err(|error| format!("invalid chunk size: {error}"))?;
        if size == 0 {
            break;
        }
        if after_size.len() < size + 2 {
            return Err("truncated chunked response".to_string());
        }
        decoded.push_str(&after_size[..size]);
        rest = &after_size[size + 2..];
    }

    Ok(decoded)
}

struct Endpoint {
    host: String,
    host_header: String,
    port: u16,
}

impl Endpoint {
    fn parse(api_base: &str) -> Result<Self, String> {
        let without_scheme = api_base
            .strip_prefix("http://")
            .ok_or_else(|| "desktop API client supports http:// endpoints only".to_string())?;
        let authority = without_scheme.split('/').next().unwrap_or(without_scheme);
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => {
                let port = port
                    .parse::<u16>()
                    .map_err(|error| format!("invalid API port: {error}"))?;
                (host.to_string(), port)
            }
            None => (authority.to_string(), 80),
        };

        if host.is_empty() {
            return Err("API host cannot be empty".to_string());
        }

        Ok(Self {
            host_header: authority.to_string(),
            host,
            port,
        })
    }
}
