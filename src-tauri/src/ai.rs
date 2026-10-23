// AI requests: through the Claude Code CLI (the user's own Claude login),
// or over HTTP APIs (ai_api.rs), whichever the user picked in Settings.
// See docs/03-architecture.md "AI integration" for why these CLI flags.

use serde::Deserialize;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

use crate::ai_api::{anthropic, compat_target, get_key, openai_compatible, ChatMessage};

const TIMEOUT: Duration = Duration::from_secs(180);
const MODELS: [&str; 3] = ["haiku", "sonnet", "opus"];

/// Finds the real claude executable on PATH. The npm install puts a .cmd
/// wrapper on PATH; we run the exe behind it directly, so no shell ever
/// interprets prompt text.
pub fn find_claude() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "claude.exe" } else { "claude" };
    for dir in std::env::split_paths(&std::env::var_os("PATH")?) {
        let native = dir.join(exe);
        if native.is_file() {
            return Some(native);
        }
        let npm = dir.join("node_modules/@anthropic-ai/claude-code/bin").join(exe);
        if npm.is_file() {
            return Some(npm);
        }
    }
    None
}

/// Sends `prompt` (via stdin) with `system` instructions and returns the reply text.
/// With `image` (a PNG, base64), the prompt goes as a stream-json message with the
/// picture in it: the only way to show Claude Code a picture with its tools off.
pub fn complete(claude: &Path, workdir: &Path, system: &str, prompt: &str, model: &str, image: Option<&str>) -> Result<String, String> {
    if !MODELS.contains(&model) {
        return Err(format!("unknown model: {model}"));
    }
    let mut cmd = Command::new(claude);
    cmd.args(["-p", "--system-prompt", system])
        // Text only: no file or shell tools, no MCP tool servers (--strict-mcp-config
        // with no config loads none), no personal settings or CLAUDE.md.
        .args(["--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence"])
        .args(["--model", model]);
    let input = match image {
        Some(png) => {
            cmd.args(["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]);
            image_message(prompt, png)
        }
        None => {
            cmd.args(["--output-format", "json"]);
            prompt.to_owned()
        }
    };
    cmd
        .current_dir(workdir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no console window flashing up
    }
    let mut child = cmd.spawn().map_err(|e| format!("couldn't start Claude Code: {e}"))?;

    // Write and read on separate threads so a full pipe can't deadlock us.
    let mut stdin = child.stdin.take().expect("stdin is piped");
    let writer = thread::spawn(move || {
        let _ = stdin.write_all(input.as_bytes());
    });
    let read_all = |mut pipe: Box<dyn Read + Send>| {
        thread::spawn(move || {
            let mut text = String::new();
            let _ = pipe.read_to_string(&mut text);
            text
        })
    };
    let stdout = read_all(Box::new(child.stdout.take().expect("stdout is piped")));
    let stderr = read_all(Box::new(child.stderr.take().expect("stderr is piped")));

    let deadline = Instant::now() + TIMEOUT;
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(_) => break,
            None if Instant::now() < deadline => thread::sleep(Duration::from_millis(100)),
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Claude Code took too long to answer.".into());
            }
        }
    }
    let _ = writer.join();
    let (stdout, stderr) = (stdout.join().unwrap_or_default(), stderr.join().unwrap_or_default());
    match image {
        // stream-json: one JSON object per line; the answer is the "result" one.
        Some(_) => parse_output(stdout.lines().find(|l| l.contains("\"type\":\"result\"")).unwrap_or(&stdout), &stderr),
        None => parse_output(&stdout, &stderr),
    }
}

/// A stream-json user message: the picture, then the prompt.
fn image_message(prompt: &str, png: &str) -> String {
    let message = serde_json::json!({
        "type": "user",
        "message": {"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": png}},
            {"type": "text", "text": prompt},
        ]},
    });
    format!("{message}\n")
}

#[derive(Deserialize)]
struct CliResult {
    is_error: bool,
    result: Option<String>,
}

fn parse_output(stdout: &str, stderr: &str) -> Result<String, String> {
    match serde_json::from_str::<CliResult>(stdout.trim()) {
        Ok(CliResult { is_error: false, result: Some(text) }) => Ok(text),
        Ok(r) => Err(r.result.unwrap_or_else(|| "Claude Code returned an error.".into())),
        Err(_) => {
            let detail = if stderr.trim().is_empty() { stdout } else { stderr };
            Err(format!("Unexpected reply from Claude Code: {}", detail.trim().chars().take(300).collect::<String>()))
        }
    }
}

/// One AI request from the app. `provider` picks the backend (Settings → AI helper):
/// "claude-code" (your Claude login, via the CLI), "anthropic" (API key) or
/// "openai-compatible" (any service with that API, `base_url` plus an optional key), or
/// "local" (the built-in AI, local_ai.rs; `model` is which one: "12b" or "26b").
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    provider: String,
    model: String,
    /// The OpenAI-compatible service ("openai", "ollama"…, or "custom"); see compat_target.
    preset: Option<String>,
    /// The address, for the "custom" service only (the others are fixed here, in Rust).
    base_url: Option<String>,
    system: String,
    messages: Vec<ChatMessage>,
    /// The conversation written out as one prompt, for Claude Code (one prompt per call).
    prompt: Option<String>,
    /// A picture (PNG, base64) to show with the last message, e.g. a box cut out of a manga page.
    image: Option<String>,
}

#[tauri::command]
pub async fn ai_complete(app: tauri::AppHandle, request: AiRequest) -> Result<String, String> {
    let AiRequest { provider, model, preset, base_url, system, messages, prompt, image } = request;
    match provider.as_str() {
        "claude-code" => {
            let claude = find_claude().ok_or("Claude Code wasn't found. Install it, or check that `claude` works in a terminal.")?;
            let prompt = prompt.ok_or("missing prompt")?;
            // An empty folder, so no project CLAUDE.md or settings get picked up.
            let workdir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai-workdir");
            std::fs::create_dir_all(&workdir).map_err(|e| e.to_string())?;
            tauri::async_runtime::spawn_blocking(move || complete(&claude, &workdir, &system, &prompt, &model, image.as_deref()))
                .await
                .map_err(|e| e.to_string())?
        }
        "anthropic" => {
            let key = get_key("anthropic")?.ok_or("No Anthropic API key is saved. Add one in Settings → AI helper.")?;
            anthropic(&key, &model, &system, &messages, image.as_deref()).await
        }
        "local" => {
            // The built-in AI: started (or kept running) by local_ai.rs, then asked like any OpenAI-compatible service.
            let (port, key) = crate::local_ai::ensure(&app, &model).await?;
            openai_compatible(&format!("http://127.0.0.1:{port}/v1"), Some(&key), "koihongo", &system, &messages, image.as_deref()).await
        }
        "openai-compatible" => {
            let (url, key) = compat_target(preset.as_deref().unwrap_or(""), base_url)?;
            openai_compatible(&url, key.as_deref(), &model, &system, &messages, image.as_deref()).await
        }
        _ => Err("AI is turned off. You can turn it on in Settings → AI helper.".into()),
    }
}

/// Whether Claude Code is installed (so Settings can say so); never runs it.
#[tauri::command]
pub fn ai_claude_code_found() -> bool {
    find_claude().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_success() {
        let out = r#"{"type":"result","is_error":false,"result":"Three trees make a FOREST."}"#;
        assert_eq!(parse_output(out, ""), Ok("Three trees make a FOREST.".into()));
    }

    #[test]
    fn reports_cli_errors() {
        let out = r#"{"type":"result","is_error":true,"result":"Not logged in · Please run /login"}"#;
        assert_eq!(parse_output(out, ""), Err("Not logged in · Please run /login".into()));
    }

    #[test]
    fn reports_garbage_with_stderr() {
        let err = parse_output("", "error: unknown option").unwrap_err();
        assert!(err.contains("unknown option"));
    }

    #[test]
    fn rejects_unknown_models() {
        let err = complete(Path::new("nope"), Path::new("."), "", "", "gpt", None).unwrap_err();
        assert!(err.contains("unknown model"));
    }

    /// Real call through the installed CLI; uses a little plan usage.
    /// Run with: cargo test -- --ignored
    #[test]
    #[ignore]
    fn real_claude_code_call() {
        let claude = find_claude().expect("claude on PATH");
        let dir = std::env::temp_dir().join("koihongo-ai-test");
        std::fs::create_dir_all(&dir).unwrap();
        let reply = complete(&claude, &dir, "Follow the instruction exactly.", "Reply with exactly: ok & done", "haiku", None).unwrap();
        assert_eq!(reply.trim(), "ok & done");
    }

    #[test]
    fn image_messages_carry_the_picture_then_the_prompt() {
        let line = image_message("Read it", "QUJD");
        assert!(line.ends_with('\n'), "stream-json wants one message per line");
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["message"]["content"][0]["source"]["data"], "QUJD");
        assert_eq!(v["message"]["content"][1]["text"], "Read it");
    }
}
