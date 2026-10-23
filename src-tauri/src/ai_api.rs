// AI over HTTP APIs (the Anthropic API, or any OpenAI-compatible endpoint:
// OpenAI, OpenRouter, Gemini, local Ollama / LM Studio), plus the API keys,
// which live in the operating system's credential store (Windows Credential
// Manager), never in user.db or its backups. See docs/03-architecture.md
// "AI integration".

use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(180);
const KEYRING_SERVICE: &str = "Koihongo AI";
/// Where an API key can be saved: one per service, so switching keeps them.
const KEY_SLOTS: [&str; 5] = ["anthropic", "openai", "openrouter", "gemini", "custom"];

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
/// Models that take Anthropic's server-side refusal fallback: a request their
/// safety classifiers wrongly decline is re-run on a recommended other model.
const FALLBACK_MODELS: [&str; 5] = ["claude-fable-5-1", "claude-fable-5", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];

#[derive(Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub text: String,
}

fn entry(slot: &str) -> Result<keyring::Entry, String> {
    if !KEY_SLOTS.contains(&slot) {
        return Err(format!("unknown key slot: {slot}"));
    }
    keyring::Entry::new(KEYRING_SERVICE, slot).map_err(|e| e.to_string())
}

/// The saved key for `slot`, or None if there isn't one.
pub fn get_key(slot: &str) -> Result<Option<String>, String> {
    match entry(slot)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("couldn't read the saved API key: {e}")),
    }
}

#[tauri::command]
pub fn ai_key_status(slot: String) -> Result<bool, String> {
    Ok(get_key(&slot)?.is_some())
}

#[tauri::command]
pub fn ai_key_set(slot: String, key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("The key is empty.".into());
    }
    entry(&slot)?.set_password(key).map_err(|e| format!("couldn't save the API key: {e}"))
}

#[tauri::command]
pub fn ai_key_delete(slot: String) -> Result<(), String> {
    match entry(&slot)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("couldn't remove the API key: {e}")),
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(TIMEOUT).build().map_err(|e| e.to_string())
}

fn network_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "The AI took too long to answer.".into()
    } else if e.is_connect() {
        "Couldn't reach the AI service. Check your internet connection (or, for a local model, that it's running).".into()
    } else {
        format!("Request failed: {e}")
    }
}

/// One reply from the Anthropic Messages API.
/// Each message's content; the last one carries `image` (a PNG, base64) if given, in `with_image`'s format.
fn contents(messages: &[ChatMessage], image: Option<&str>, with_image: impl Fn(&str, &str) -> Value) -> Vec<Value> {
    let last = messages.len().saturating_sub(1);
    messages
        .iter()
        .enumerate()
        .map(|(i, m)| match image {
            Some(png) if i == last => json!({"role": m.role, "content": with_image(&m.text, png)}),
            _ => json!({"role": m.role, "content": m.text}),
        })
        .collect()
}

pub async fn anthropic(key: &str, model: &str, system: &str, messages: &[ChatMessage], image: Option<&str>) -> Result<String, String> {
    let mut body = json!({
        "model": model,
        "max_tokens": 16000,
        "system": system,
        "messages": contents(messages, image, |text, png| json!([
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": png}},
            {"type": "text", "text": text},
        ])),
    });
    let mut request = client()?
        .post(ANTHROPIC_URL)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01");
    if FALLBACK_MODELS.contains(&model) {
        body["fallbacks"] = json!("default");
        request = request.header("anthropic-beta", "server-side-fallback-2026-07-01");
    }
    let response = request.json(&body).send().await.map_err(network_error)?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(network_error)?;
    parse_anthropic(status, &text)
}

pub fn parse_anthropic(status: u16, body: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(body).map_err(|_| format!("Unexpected reply from the Anthropic API ({status}): {}", snippet(body)))?;
    if !(200..300).contains(&status) {
        let message = value["error"]["message"].as_str().unwrap_or("unknown error");
        return Err(match status {
            401 => "The Anthropic API key was rejected. Check it in Settings.".into(),
            _ => format!("Anthropic API error ({status}): {message}"),
        });
    }
    // A safety decline is a normal reply with stop_reason "refusal": check it before reading the text.
    if value["stop_reason"] == "refusal" {
        return Err("The model declined to answer this one. Try rephrasing.".into());
    }
    let text: String = value["content"]
        .as_array()
        .map(|blocks| blocks.iter().filter(|b| b["type"] == "text").filter_map(|b| b["text"].as_str()).collect())
        .unwrap_or_default();
    if text.trim().is_empty() {
        return Err("The model sent an empty reply.".into());
    }
    Ok(text)
}

/// Where an OpenAI-compatible request goes, and with which saved key. The
/// address of each known service is fixed here, so a key can only ever be
/// sent to the service it belongs to (the web side just names the service).
/// The "custom" service uses the address you typed, with the "custom" key if
/// one is saved; a key never goes over plain http:// to another machine.
pub fn compat_target(preset: &str, custom_url: Option<String>) -> Result<(String, Option<String>), String> {
    let (url, slot): (String, Option<&str>) = match preset {
        "openai" => ("https://api.openai.com/v1".into(), Some("openai")),
        "openrouter" => ("https://openrouter.ai/api/v1".into(), Some("openrouter")),
        "gemini" => ("https://generativelanguage.googleapis.com/v1beta/openai".into(), Some("gemini")),
        "ollama" => ("http://localhost:11434/v1".into(), None),
        "lmstudio" => ("http://localhost:1234/v1".into(), None),
        "custom" => {
            let url = custom_url.filter(|u| !u.trim().is_empty()).ok_or("No service address is set.")?;
            let key = get_key("custom")?;
            if key.is_some() && !secure_or_local(&url) {
                return Err("Your API key would be sent unencrypted. Use an https:// address (or a model on this PC).".into());
            }
            return Ok((url, key));
        }
        _ => return Err(format!("unknown AI service: {preset}")),
    };
    let key = match slot {
        Some(slot) => Some(get_key(slot)?.ok_or("No API key is saved for this service. Add one in Settings → AI helper.")?),
        None => None,
    };
    Ok((url, key))
}

/// https://, or plain http:// to this PC only.
pub fn secure_or_local(url: &str) -> bool {
    let url = url.trim().to_ascii_lowercase();
    if url.starts_with("https://") {
        return true;
    }
    let Some(rest) = url.strip_prefix("http://") else { return false };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = host.rsplit_once('@').map_or(host, |(_, h)| h); // ignore user:pass@
    let host = if host.starts_with('[') { host.split(']').next().map(|h| &h[1..]).unwrap_or("") } else { host.split(':').next().unwrap_or("") };
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

/// One reply from an OpenAI-compatible chat completions endpoint.
pub async fn openai_compatible(base_url: &str, key: Option<&str>, model: &str, system: &str, messages: &[ChatMessage], image: Option<&str>) -> Result<String, String> {
    let base = base_url.trim().trim_end_matches('/');
    if !(base.starts_with("https://") || base.starts_with("http://")) {
        return Err("The service address must start with http:// or https://.".into());
    }
    let mut all = vec![json!({"role": "system", "content": system})];
    all.extend(contents(messages, image, |text, png| json!([
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": format!("data:image/png;base64,{png}")}},
    ])));
    let mut request = client()?.post(format!("{base}/chat/completions"));
    if let Some(key) = key {
        request = request.bearer_auth(key);
    }
    let response = request.json(&json!({"model": model, "messages": all})).send().await.map_err(network_error)?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(network_error)?;
    parse_openai(status, &text)
}

pub fn parse_openai(status: u16, body: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(body).map_err(|_| format!("Unexpected reply from the AI service ({status}): {}", snippet(body)))?;
    if !(200..300).contains(&status) {
        // Most services send {"error": {"message": …}}; some send a list of those.
        let message = value["error"]["message"]
            .as_str()
            .or_else(|| value[0]["error"]["message"].as_str())
            .unwrap_or("unknown error");
        return Err(match status {
            401 | 403 => format!("The API key was rejected ({status}): {message}"),
            _ => format!("AI service error ({status}): {message}"),
        });
    }
    match value["choices"][0]["message"]["content"].as_str() {
        Some(text) if !text.trim().is_empty() => Ok(text.to_owned()),
        _ => Err("The model sent an empty reply.".into()),
    }
}

fn snippet(body: &str) -> String {
    body.trim().chars().take(300).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anthropic_joins_text_blocks() {
        let body = r#"{"stop_reason":"end_turn","content":[{"type":"thinking","thinking":""},{"type":"text","text":"Three trees "},{"type":"text","text":"make a FOREST."}]}"#;
        assert_eq!(parse_anthropic(200, body), Ok("Three trees make a FOREST.".into()));
    }

    #[test]
    fn anthropic_refusal_is_an_error() {
        let body = r#"{"stop_reason":"refusal","content":[]}"#;
        assert!(parse_anthropic(200, body).unwrap_err().contains("declined"));
    }

    #[test]
    fn anthropic_errors() {
        let body = r#"{"type":"error","error":{"type":"invalid_request_error","message":"model: not found"}}"#;
        assert_eq!(parse_anthropic(404, body), Err("Anthropic API error (404): model: not found".into()));
        assert!(parse_anthropic(401, r#"{"type":"error","error":{"message":"x"}}"#).unwrap_err().contains("key was rejected"));
        assert!(parse_anthropic(502, "<html>bad gateway</html>").unwrap_err().contains("bad gateway"));
    }

    #[test]
    fn openai_reads_the_first_choice() {
        let body = r#"{"choices":[{"message":{"role":"assistant","content":"OK"}}]}"#;
        assert_eq!(parse_openai(200, body), Ok("OK".into()));
    }

    #[test]
    fn openai_errors() {
        let body = r#"{"error":{"message":"Incorrect API key provided"}}"#;
        assert_eq!(parse_openai(401, body), Err("The API key was rejected (401): Incorrect API key provided".into()));
        let gemini = r#"[{"error":{"code":400,"message":"model not found"}}]"#;
        assert_eq!(parse_openai(400, gemini), Err("AI service error (400): model not found".into()));
        assert!(parse_openai(200, r#"{"choices":[]}"#).is_err());
    }

    #[test]
    fn keys_only_go_over_https_or_to_this_pc() {
        assert!(secure_or_local("https://example.com/v1"));
        assert!(secure_or_local("http://localhost:11434/v1"));
        assert!(secure_or_local("http://127.0.0.1:1234/v1"));
        assert!(secure_or_local("http://[::1]:8080/v1"));
        assert!(!secure_or_local("http://example.com/v1"));
        assert!(!secure_or_local("http://localhost.evil.com/v1"));
        assert!(!secure_or_local("http://user@evil.com/v1"));
        assert!(!secure_or_local("ftp://localhost/"));
    }

    #[test]
    fn known_services_have_fixed_addresses() {
        // Local models need no key, so this runs without touching the credential store.
        assert_eq!(compat_target("ollama", Some("https://evil.example".into())).unwrap(), ("http://localhost:11434/v1".into(), None));
        assert!(compat_target("nope", None).is_err());
        assert!(compat_target("custom", None).is_err());
    }

    #[test]
    fn unknown_key_slots_are_rejected() {
        assert!(ai_key_status("../../etc".into()).is_err());
    }
}

#[cfg(test)]
mod credential_store {
    use super::*;

    /// Touches the real OS credential store (the "custom" slot), so it's opt-in.
    /// Run with: cargo test -- --ignored keys_round_trip
    #[test]
    #[ignore]
    fn keys_round_trip() {
        ai_key_set("custom".into(), "  test-key-123  ".into()).unwrap();
        assert!(ai_key_status("custom".into()).unwrap());
        assert_eq!(get_key("custom").unwrap().as_deref(), Some("test-key-123"));
        ai_key_delete("custom".into()).unwrap();
        assert!(!ai_key_status("custom".into()).unwrap());
        ai_key_delete("custom".into()).unwrap(); // deleting twice is fine
    }

    #[test]
    fn only_the_last_message_carries_the_picture() {
        let messages = [ChatMessage { role: "user".into(), text: "hi".into() }, ChatMessage { role: "user".into(), text: "read".into() }];
        let out = contents(&messages, Some("QUJD"), |text, png| json!([{"text": text, "png": png}]));
        assert_eq!(out[0]["content"], "hi");
        assert_eq!(out[1]["content"][0]["png"], "QUJD");
        assert_eq!(contents(&messages, None, |_, _| json!(null))[1]["content"], "read");
    }
}
