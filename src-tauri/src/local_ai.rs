//! The built-in AI helper (Settings → AI helper → Built-in): Gemma 4
//! (Apache-2.0, ggml-org's GGUF builds, with the vision projector so it can
//! read a box's picture) run by llama.cpp's llama-server (MIT, the Vulkan
//! build: any recent graphics card, no extra installs). Both are an optional
//! download into the app's data folder.
//!
//! The server starts the first time it's needed (on this PC only, a random
//! port, a random key, so nothing else can use it), and stops after
//! IDLE_STOP unused or when Koihongo closes. On Windows it's tied to
//! Koihongo with a job object, so even a crash can't leave it holding the
//! graphics card's memory. Requests go to it as to any OpenAI-compatible
//! service (ai_api.rs).

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::async_runtime::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

use crate::downloads::{download, present, ModelFile, Progress};

/// llama.cpp's Windows build for Vulkan (release b11838).
const ENGINE: ModelFile = ModelFile {
    url: "https://github.com/ggml-org/llama.cpp/releases/download/b11838/llama-b11838-bin-win-vulkan-x64.zip",
    name: "llama-b11838-bin-win-vulkan-x64.zip",
    size: 36_882_552,
    sha256: "d5c28fd61d2d6947d6cae9fe4576c7b9beddda31ab4cee6abd9417561e63b5f9",
    // llama-server.exe is a small launcher; this is the server itself.
    unzipped: Some(("llama-server-impl.dll", 9_605_120)),
};

/// A model you can pick: its folder, the model and its vision projector.
struct LocalModel {
    id: &'static str,
    dir: &'static str,
    model: ModelFile,
    vision: ModelFile,
}

#[rustfmt::skip]
const MODELS: [LocalModel; 2] = [
    LocalModel {
        id: "12b",
        dir: "gemma-4-12b",
        model: ModelFile { url: "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/a29b2a6b584a5bdcb672ccdcda99ea9faeacc51a/gemma-4-12B-it-Q4_0.gguf", name: "gemma-4-12B-it-Q4_0.gguf", size: 7_219_673_216, sha256: "3712b9bd32cae83a22f67ee7a4466d8d7a4f21646ac8a07d19bf9418e8767a70", unzipped: None },
        vision: ModelFile { url: "https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/a29b2a6b584a5bdcb672ccdcda99ea9faeacc51a/mmproj-gemma-4-12B-it-Q8_0.gguf", name: "mmproj-gemma-4-12B-it-Q8_0.gguf", size: 158_987_616, sha256: "59e62255435dda870e2d1de97cc031330b31a898bac12b38a182cecff9cd3738", unzipped: None },
    },
    LocalModel {
        id: "26b",
        dir: "gemma-4-26b-a4b",
        model: ModelFile { url: "https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/9cf8c8db0f83fb4582f15381f8fb1a7c1b0b9ca2/gemma-4-26B-A4B-it-Q4_0.gguf", name: "gemma-4-26B-A4B-it-Q4_0.gguf", size: 14_618_145_824, sha256: "d208665ab1cd3a69f7a9a4bc59430e8448c8093d9b06334f566ac59d6d504a03", unzipped: None },
        vision: ModelFile { url: "https://huggingface.co/ggml-org/gemma-4-26B-A4B-it-GGUF/resolve/9cf8c8db0f83fb4582f15381f8fb1a7c1b0b9ca2/mmproj-gemma-4-26B-A4B-it-Q8_0.gguf", name: "mmproj-gemma-4-26B-A4B-it-Q8_0.gguf", size: 806_408_320, sha256: "cc4e855736da450bf1e162d8cccfe0ad685727d0c9e04ef7dd8d884f3121039b", unzipped: None },
    },
];

/// Stopped after this long unused, to give the graphics card's memory back.
const IDLE_STOP: Duration = Duration::from_secs(10 * 60);
/// How long a model may take to load before we give up (a big one from a slow disk).
const START_TIMEOUT: Duration = Duration::from_secs(240);
/// Room for a page's worth of text, a picture and a long reply.
const CONTEXT: &str = "8192";

fn model(id: &str) -> Result<&'static LocalModel, String> {
    MODELS.iter().find(|m| m.id == id).ok_or_else(|| format!("unknown built-in model: {id}"))
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("models").join("local-ai"))
}

/// The running server, if any.
struct Server {
    child: Child,
    model: &'static str,
    port: u16,
    key: String,
    last_used: Instant,
    #[cfg(windows)]
    _job: Option<job::Job>,
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct LocalAi {
    server: Mutex<Option<Server>>,
    downloading: AtomicBool,
}

impl LocalAi {
    /// Stops the server (Koihongo closing, a model removed or switched).
    pub fn stop(&self) {
        *self.server.blocking_lock() = None;
    }
}

#[derive(Serialize)]
pub struct LocalAiStatus {
    /// The engine and this model are downloaded.
    installed: bool,
    /// What's left to download for it, in bytes.
    to_download: u64,
    /// The server is running with this model.
    running: bool,
}

#[tauri::command]
pub async fn local_ai_status(app: AppHandle, state: State<'_, LocalAi>, model_id: String) -> Result<LocalAiStatus, String> {
    let m = model(&model_id)?;
    let root = root(&app)?;
    let parts = [(root.join("engine"), &ENGINE), (root.join(m.dir), &m.model), (root.join(m.dir), &m.vision)];
    let to_download = parts.iter().filter(|(dir, f)| !present(dir, f)).map(|(_, f)| f.size).sum();
    let running = state.server.lock().await.as_ref().is_some_and(|s| s.model == m.id);
    Ok(LocalAiStatus { installed: to_download == 0, to_download, running })
}

/// Downloads the engine and a model (see downloads.rs), reporting progress.
#[tauri::command]
pub async fn local_ai_download(app: AppHandle, state: State<'_, LocalAi>, model_id: String, on_progress: Channel<Progress>) -> Result<(), String> {
    let m = model(&model_id)?;
    if state.downloading.swap(true, Ordering::SeqCst) {
        return Err("The download is already running.".into());
    }
    let root = root(&app)?;
    let (engine_dir, model_dir) = (root.join("engine"), root.join(m.dir));
    let result = download(&[(engine_dir.as_path(), &[&ENGINE]), (model_dir.as_path(), &[&m.model, &m.vision])], &on_progress).await;
    state.downloading.store(false, Ordering::SeqCst);
    result
}

/// Stops the server and removes the engine and every model.
#[tauri::command]
pub async fn local_ai_remove(app: AppHandle, state: State<'_, LocalAi>) -> Result<(), String> {
    if state.downloading.load(Ordering::SeqCst) {
        return Err("Wait for the download to finish first.".into());
    }
    *state.server.lock().await = None;
    let root = root(&app)?;
    if root.exists() {
        std::fs::remove_dir_all(&root).map_err(|e| format!("Couldn't remove it all: {e}"))?;
    }
    Ok(())
}

/// The server's address and key, starting it (with this model) if it isn't running.
pub async fn ensure(app: &AppHandle, model_id: &str) -> Result<(u16, String), String> {
    let m = model(model_id)?;
    let state = app.state::<LocalAi>();
    // Held while starting, so two requests at once don't start two servers.
    let mut server = state.server.lock().await;
    if let Some(s) = server.as_mut() {
        if s.model == m.id && s.child.try_wait().ok().flatten().is_none() {
            s.last_used = Instant::now();
            return Ok((s.port, s.key.clone()));
        }
    }
    *server = None; // another model, or it stopped: start afresh
    let root = root(app)?;
    let (engine, dir) = (root.join("engine"), root.join(m.dir));
    if !present(&engine, &ENGINE) || !present(&dir, &m.model) || !present(&dir, &m.vision) {
        return Err("The built-in AI isn't downloaded yet: download it in Settings → AI helper.".into());
    }
    let started = start(&engine, &dir.join(m.model.name), &dir.join(m.vision.name), &root.join("server.log"), m.id)?;
    let (port, key) = (started.port, started.key.clone());
    *server = Some(started);
    wait_until_ready(server.as_mut().unwrap(), &root.join("server.log")).await?;
    Ok((port, key))
}

fn start(engine: &Path, model: &Path, vision: &Path, log: &Path, id: &'static str) -> Result<Server, String> {
    let port = std::net::TcpListener::bind("127.0.0.1:0").and_then(|l| l.local_addr()).map_err(|e| e.to_string())?.port();
    let key = random_key();
    let log_file = std::fs::File::create(log).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(engine.join("llama-server.exe"));
    cmd.arg("-m").arg(model).arg("--mmproj").arg(vision);
    // No hidden "thinking" before answering: it took most of the time (3,000+ tokens to read two kana).
    cmd.args(["--reasoning", "off"]);
    // Little randomness: reading a box should give the same text every time (コツ, not sometimes コッ).
    cmd.args(["--temp", "0.2"]);
    cmd.args(["--host", "127.0.0.1", "--port", &port.to_string(), "--api-key", &key, "-c", CONTEXT, "-np", "1", "-a", "koihongo"])
        .current_dir(engine)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(log_file));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let child = cmd.spawn().map_err(|e| format!("Couldn't start the built-in AI: {e}"))?;
    Ok(Server {
        #[cfg(windows)]
        _job: job::Job::kill_with_us(&child),
        child,
        model: id,
        port,
        key,
        last_used: Instant::now(),
    })
}

/// Waits for the model to load (the server answers /health with 200 when ready).
async fn wait_until_ready(server: &mut Server, log: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(5)).build().map_err(|e| e.to_string())?;
    let deadline = Instant::now() + START_TIMEOUT;
    while Instant::now() < deadline {
        if let Ok(Some(status)) = server.child.try_wait() {
            return Err(format!("The built-in AI stopped while starting ({status}). {}", log_tail(log)));
        }
        if let Ok(r) = client.get(format!("http://127.0.0.1:{}/health", server.port)).send().await {
            if r.status().is_success() {
                return Ok(());
            }
        }
        tokio_sleep(Duration::from_millis(500)).await;
    }
    Err(format!("The built-in AI took too long to start. {}", log_tail(log)))
}

async fn tokio_sleep(d: Duration) {
    // A blocking sleep on a worker thread keeps tauri's runtime free.
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}

/// The end of the server's log, for an error message.
fn log_tail(log: &Path) -> String {
    let text = std::fs::read_to_string(log).unwrap_or_default();
    let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
    let tail = lines[lines.len().saturating_sub(3)..].join(" / ");
    if tail.is_empty() { String::new() } else { format!("Its last words: {tail}") }
}

/// A key only Koihongo knows, so other programs on this PC can't use the server.
fn random_key() -> String {
    let mut out = String::new();
    for _ in 0..2 {
        let mut h = RandomState::new().build_hasher();
        h.write_u128(Instant::now().elapsed().as_nanos() ^ std::process::id() as u128);
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

/// Stops the server once it's been unused for IDLE_STOP (checked every half minute).
pub fn stop_when_idle(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        let state = app.state::<LocalAi>();
        let mut server = state.server.blocking_lock();
        if server.as_ref().is_some_and(|s| s.last_used.elapsed() > IDLE_STOP) {
            *server = None;
        }
    });
}

/// A Windows job object that kills the server when Koihongo's handle to it
/// closes: when the Server is dropped, or when Koihongo exits or crashes.
#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub struct Job(HANDLE);

    // The handle is only closed (in Drop); it's fine to move between threads.
    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Job {
        pub fn kill_with_us(child: &std::process::Child) -> Option<Job> {
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if job.is_null() {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let size = std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32;
                let ok = SetInformationJobObject(job, JobObjectExtendedLimitInformation, &info as *const _ as *const _, size) != 0
                    && AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE) != 0;
                if ok {
                    Some(Job(job))
                } else {
                    CloseHandle(job);
                    None
                }
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn models_are_known_and_keys_differ() {
        assert!(model("26b").is_ok() && model("12b").is_ok() && model("70b").is_err());
        let (a, b) = (random_key(), random_key());
        assert_eq!(a.len(), 32);
        assert_ne!(a, b);
    }

    /// The job object kills the server when its handle closes (as when Koihongo dies).
    #[cfg(windows)]
    #[test]
    fn the_job_takes_the_server_with_it() {
        let mut child = Command::new("ping").args(["-n", "30", "127.0.0.1"]).stdout(Stdio::null()).spawn().unwrap();
        let job = job::Job::kill_with_us(&child);
        assert!(job.is_some(), "the job object was made: {:?}", std::io::Error::last_os_error());
        drop(job);
        std::thread::sleep(Duration::from_millis(500));
        let gone = child.try_wait().unwrap().is_some();
        let _ = child.kill();
        assert!(gone, "the process ended with the job");
    }

    #[test]
    fn log_tail_keeps_the_last_lines() {
        let path = std::env::temp_dir().join(format!("koihongo-log-test-{}", std::process::id()));
        std::fs::write(&path, "one\n\ntwo\nthree\nfour\n").unwrap();
        assert_eq!(log_tail(&path), "Its last words: two / three / four");
        let _ = std::fs::remove_file(path);
    }
}
