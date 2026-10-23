//! Optional downloads into the app's data folder (the text-reading models in
//! ocr.rs, the built-in AI in local_ai.rs): each file pinned to one release or
//! commit, written to a .part file, checked by size and SHA-256, then renamed
//! (and unpacked, for zips). Files already there are kept, so a download that
//! stopped carries on with the next file.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

pub struct ModelFile {
    /// Where it comes from: a pinned commit or release, so the file never changes under us.
    pub url: &'static str,
    /// The name we keep it under.
    pub name: &'static str,
    pub size: u64,
    pub sha256: &'static str,
    /// A zip, unpacked once it's checked (then deleted): the file (and its size) that shows it's unpacked.
    pub unzipped: Option<(&'static str, u64)>,
}

/// A file is downloaded (and unpacked) and complete.
pub fn present(dir: &Path, f: &ModelFile) -> bool {
    let (path, size) = f.unzipped.unwrap_or((f.name, f.size));
    std::fs::metadata(dir.join(path)).is_ok_and(|m| m.len() == size)
}

/// Unpacks a downloaded zip into `dir` (entries that would land outside it are skipped).
fn unzip(zip_path: &Path, dir: &Path) -> Result<(), String> {
    let mut zip = zip::ZipArchive::new(std::fs::File::open(zip_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let Some(name) = entry.enclosed_name() else { continue };
        let out = dir.join(name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::io::copy(&mut entry, &mut std::fs::File::create(&out).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(Clone, Serialize)]
pub struct Progress {
    done: u64,
    total: u64,
}

/// How often progress is reported while downloading (a 15 GB model would otherwise send a million updates).
const PROGRESS_EVERY: Duration = Duration::from_millis(150);

/// Downloads files, each group into its folder, reporting bytes done (of them all) as it goes.
pub async fn download(groups: &[(&Path, &[&ModelFile])], on_progress: &Channel<Progress>) -> Result<(), String> {
    let total = groups.iter().flat_map(|(_, files)| files.iter()).map(|f| f.size).sum();
    let mut done = 0;
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let mut reported = Instant::now() - PROGRESS_EVERY;
    for (dir, files) in groups {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        for file in files.iter() {
            if present(dir, file) {
                done += file.size;
                continue;
            }
            let dest = dir.join(file.name);
            let part = dir.join(format!("{}.part", file.name));
            let mut response = client
                .get(file.url)
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .map_err(|e| format!("Couldn't download {}: {e}", file.name))?;
            let mut out = std::fs::File::create(&part).map_err(|e| e.to_string())?;
            let mut hash = Sha256::new();
            let mut got = 0;
            while let Some(chunk) = response.chunk().await.map_err(|e| format!("The download of {} stopped: {e}", file.name))? {
                out.write_all(&chunk).map_err(|e| e.to_string())?;
                hash.update(&chunk);
                got += chunk.len() as u64;
                if reported.elapsed() >= PROGRESS_EVERY {
                    reported = Instant::now();
                    let _ = on_progress.send(Progress { done: done + got, total });
                }
            }
            drop(out);
            let sha = format!("{:x}", hash.finalize());
            if got != file.size || sha != file.sha256 {
                let _ = std::fs::remove_file(&part);
                return Err(format!("{} didn't download correctly (it doesn't match the expected file). Try again.", file.name));
            }
            std::fs::rename(&part, &dest).map_err(|e| e.to_string())?;
            if file.unzipped.is_some() {
                unzip(&dest, dir)?;
                let _ = std::fs::remove_file(&dest);
            }
            done += file.size;
            let _ = on_progress.send(Progress { done, total });
        }
    }
    Ok(())
}
