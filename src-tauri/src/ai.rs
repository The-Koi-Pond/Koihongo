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

use crate::ai_api::{anthropic, get_key, openai_compatible, ChatMessage};

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
pub fn complete(claude: &Path, workdir: &Path, system: &str, prompt: &str, model: &str) -> Result<String, String> {
    if !MODELS.contains(&model) {
        return Err(format!("unknown model: {model}"));
    }
    let mut cmd = Command::new(claude);
    cmd.args(["-p", "--system-prompt", system])
        // Text only: no file or shell tools. No personal settings or CLAUDE.md.
        .args(["--tools", "", "--setting-sources", "", "--no-session-persistence"])
        .args(["--output-format", "json", "--model", model])
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
    let prompt = prompt.to_owned();
    let writer = thread::spawn(move || {
        let _ = stdin.write_all(prompt.as_bytes());
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
    parse_output(&stdout.join().unwrap_or_default(), &stderr.join().unwrap_or_default())
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
/// "openai-compatible" (any service with that API, `base_url` plus an optional key).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    provider: String,
    model: String,
    base_url: Option<String>,
    /// Which saved API key to send (see ai_api.rs); none for local models.
    key_slot: Option<String>,
    system: String,
    messages: Vec<ChatMessage>,
    /// The conversation written out as one prompt, for Claude Code (one prompt per call).
    prompt: Option<String>,
}

#[tauri::command]
pub async fn ai_complete(app: tauri::AppHandle, request: AiRequest) -> Result<String, String> {
    let AiRequest { provider, model, base_url, key_slot, system, messages, prompt } = request;
    match provider.as_str() {
        "claude-code" => {
            let claude = find_claude().ok_or("Claude Code wasn't found. Install it, or check that `claude` works in a terminal.")?;
            let prompt = prompt.ok_or("missing prompt")?;
            // An empty folder, so no project CLAUDE.md or settings get picked up.
            let workdir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("ai-workdir");
            std::fs::create_dir_all(&workdir).map_err(|e| e.to_string())?;
            tauri::async_runtime::spawn_blocking(move || complete(&claude, &workdir, &system, &prompt, &model))
                .await
                .map_err(|e| e.to_string())?
        }
        "anthropic" => {
            let key = get_key("anthropic")?.ok_or("No Anthropic API key is saved. Add one in Settings → AI helper.")?;
            anthropic(&key, &model, &system, &messages).await
        }
        "openai-compatible" => {
            let key = match key_slot.as_deref() {
                Some(slot) => Some(get_key(slot)?.ok_or("No API key is saved for this service. Add one in Settings → AI helper.")?),
                None => None,
            };
            let base_url = base_url.ok_or("No service address is set.")?;
            openai_compatible(&base_url, key.as_deref(), &model, &system, &messages).await
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
        let err = complete(Path::new("nope"), Path::new("."), "", "", "gpt").unwrap_err();
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
        let reply = complete(&claude, &dir, "Follow the instruction exactly.", "Reply with exactly: ok & done", "haiku").unwrap();
        assert_eq!(reply.trim(), "ok & done");
    }
}
