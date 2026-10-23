//! Reading the text in a box on a manga page (Reading: "Read text"), with
//! Baberu OCR (genshiai-daichi/baberu-ocr, Apache-2.0; see baberu.rs), and
//! finding the text on a page ("Find text") with
//! ogkalu/comic-text-and-bubble-detector (RT-DETR-v2, Apache-2.0), both run by
//! ONNX Runtime. The models are an optional download (about 144 MB, with the
//! word splitter's dictionary for words.rs) into the app's data folder; the
//! installer doesn't carry them.
//!
//! The window cuts the page down to the box (it already has the page
//! decoded) and sends the cut-out here as a PNG.

use image::{imageops, DynamicImage};
use ort::session::Session;
use ort::value::Tensor;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::{Arc, Mutex};
use tauri::ipc::{Channel, InvokeBody, Request};
use tauri::{AppHandle, Manager, State};

use crate::baberu::{self, Baberu};
use crate::downloads::{download, present, ModelFile, Progress};

// --- The model files ---

macro_rules! baberu {
    ($path:literal) => {
        concat!("https://huggingface.co/genshiai-daichi/baberu-ocr/resolve/b9868433dbda3ed9ba1357d008599ff4ada873d5/", $path)
    };
}

#[rustfmt::skip]
const FILES: [ModelFile; 6] = [
    // Baberu's smallest tier (vision int4 + decoder int8): read the same as the 243 MB tier on our test pages.
    ModelFile { url: baberu!("onnx/vision_int4.onnx"), name: "vision_int4.onnx", size: 52_293_486, sha256: "1967ecef502e4c1e1e7c512ea0a2e06396b39ded87a8a9cc77bd7db2e981a361", unzipped: None },
    ModelFile { url: baberu!("onnx/decoder_prefill_int8.onnx"), name: "decoder_prefill_int8.onnx", size: 35_133_596, sha256: "187a59cb61d3870f1f97c9eb027eb34ff19d023fba801cda113a13870be0b724", unzipped: None },
    ModelFile { url: baberu!("onnx/decoder_step_int8.onnx"), name: "decoder_step_int8.onnx", size: 34_715_466, sha256: "46640b0b3db77f0f0eef660bbe5dc9126a5e0fb49eb2786b2edba7b0371d9769", unzipped: None },
    ModelFile { url: baberu!("tokenizer/vocab.json"), name: "vocab.json", size: 130_761, sha256: "681de4eb83154a397af49e2ddae4705041b12a22e16fe00860b829e889e5f47c", unzipped: None },
    // The small (int8) detector, as comic-translate uses on CPU.
    ModelFile { url: "https://huggingface.co/ogkalu/comic-text-and-bubble-detector/resolve/16e8a622f91fabc6b5b65c96d32d1183f8843546/detector-v4-s_int8.onnx", name: "detector-v4-s_int8.onnx", size: 11_120_765, sha256: "5fe9e4f576e49d4e7e8b0e029d6d3cdc252abd4694113e1cae120e62c931ea79", unzipped: None },
    // The word splitter's dictionary (lindera's build of IPADIC, for words.rs).
    ModelFile { url: "https://github.com/lindera/lindera/releases/download/v6.2.0/lindera-ipadic-6.2.0.zip", name: "lindera-ipadic-6.2.0.zip", size: 10_519_550, sha256: "5ed4bba6b429030b0387df67d40d5751d35dedef0306f4bac6d957cad5f04b72", unzipped: Some((crate::words::DICTIONARY_CHECK, 32_674_733)) },
];
const OCR_FILES: [&str; 4] = [baberu::VISION, "decoder_prefill_int8.onnx", "decoder_step_int8.onnx", "vocab.json"];
const DETECTOR_FILE: &str = "detector-v4-s_int8.onnx";

fn models(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("models"))
}

pub(crate) fn model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(models(app)?.join("text-reading"))
}

/// The first test version used manga-ocr (461 MB) here; it's not needed any more.
fn remove_old_models(app: &AppHandle) {
    if let Ok(dir) = models(app) {
        let _ = std::fs::remove_dir_all(dir.join("manga-ocr"));
    }
}

/// These model files (all of them, if None) are downloaded and complete.
pub(crate) fn installed(dir: &Path, names: Option<&[&str]>) -> bool {
    FILES.iter().filter(|f| names.is_none_or(|n| n.contains(&f.name))).all(|f| present(dir, f))
}

pub(crate) const NOT_SET_UP: &str = "Text reading isn't set up yet: download it in Settings → Reading text from manga.";

/// The loaded models (loading takes a few seconds, so they're kept), and whether a download is running.
#[derive(Default)]
pub struct Ocr {
    model: Mutex<Option<Arc<Baberu>>>,
    detector: Mutex<Option<Arc<Mutex<Session>>>>,
    /// The word splitter (words.rs).
    pub(crate) words: Mutex<Option<Arc<lindera::segmenter::Segmenter>>>,
    downloading: AtomicBool,
}

#[derive(Serialize)]
pub struct OcrStatus {
    installed: bool,
    /// What the download is, in bytes.
    size: u64,
}

#[tauri::command]
pub fn ocr_status(app: AppHandle) -> Result<OcrStatus, String> {
    Ok(OcrStatus { installed: installed(&model_dir(&app)?, None), size: FILES.iter().map(|f| f.size).sum() })
}

/// Downloads the models (see downloads.rs), reporting bytes done as it goes.
#[tauri::command]
pub async fn ocr_download(app: AppHandle, state: State<'_, Ocr>, on_progress: Channel<Progress>) -> Result<(), String> {
    if state.downloading.swap(true, AtomicOrdering::SeqCst) {
        return Err("The download is already running.".into());
    }
    remove_old_models(&app);
    let files: Vec<&ModelFile> = FILES.iter().collect();
    let result = download(&[(model_dir(&app)?.as_path(), &files)], &on_progress).await;
    state.downloading.store(false, AtomicOrdering::SeqCst);
    result
}

/// Removes the downloaded model (and forgets the loaded one).
#[tauri::command]
pub fn ocr_remove(app: AppHandle, state: State<'_, Ocr>) -> Result<(), String> {
    if state.downloading.load(AtomicOrdering::SeqCst) {
        return Err("Wait for the download to finish first.".into());
    }
    *state.model.lock().map_err(|e| e.to_string())? = None;
    *state.detector.lock().map_err(|e| e.to_string())? = None;
    *state.words.lock().map_err(|e| e.to_string())? = None;
    remove_old_models(&app);
    let dir = model_dir(&app)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize)]
pub struct OcrText {
    text: String,
    /// 0–1: how sure the model is (low for tiny, squashed or messy boxes).
    confidence: f32,
}

/// Reads the text in a cut-out of a page, sent as the PNG bytes of the request body.
#[tauri::command]
pub async fn ocr_read(app: AppHandle, state: State<'_, Ocr>, request: Request<'_>) -> Result<OcrText, String> {
    let InvokeBody::Raw(png) = request.body() else {
        return Err("Expected the image's bytes.".into());
    };
    let png = png.clone();
    let loaded = state.model.lock().map_err(|e| e.to_string())?.clone();
    let model = match loaded {
        Some(m) => m,
        None => {
            let dir = model_dir(&app)?;
            if !installed(&dir, Some(&OCR_FILES)) {
                return Err(NOT_SET_UP.into());
            }
            // The first read loads the model (a few seconds), off the main thread.
            let m = Arc::new(tauri::async_runtime::spawn_blocking(move || Baberu::new(&dir)).await.map_err(|e| e.to_string())??);
            *state.model.lock().map_err(|e| e.to_string())? = Some(m.clone());
            m
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        let img = image::load_from_memory_with_format(&png, image::ImageFormat::Png).map_err(|e| format!("Couldn't read the cut-out: {e}"))?;
        let (text, confidence) = model.recognize(&img)?;
        Ok(OcrText { text, confidence })
    })
    .await
    .map_err(|e| e.to_string())?
}

// --- Finding the text on a page ---

/// A text area found on a page, as fractions of the page (like a mark's box).
#[derive(Serialize, Debug, PartialEq)]
pub struct Found {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    /// Inside a speech bubble (else elsewhere on the page: narration, signs, sound effects).
    in_bubble: bool,
    score: f32,
}

/// The detector's classes (comic-text-and-bubble-detector): 0 bubble, 1 text in a bubble, 2 text elsewhere.
const TEXT_IN_BUBBLE: i64 = 1;
const TEXT_ELSEWHERE: i64 = 2;
/// Below this, a detection is ignored (comic-translate's setting).
const MIN_SCORE: f32 = 0.3;
const DETECT_SIZE: usize = 640;

/// Finds the text areas on a whole page, sent as the PNG bytes of the request body.
#[tauri::command]
pub async fn ocr_find(app: AppHandle, state: State<'_, Ocr>, request: Request<'_>) -> Result<Vec<Found>, String> {
    let InvokeBody::Raw(png) = request.body() else {
        return Err("Expected the image's bytes.".into());
    };
    let png = png.clone();
    let loaded = state.detector.lock().map_err(|e| e.to_string())?.clone();
    let detector = match loaded {
        Some(d) => d,
        None => {
            let dir = model_dir(&app)?;
            if !installed(&dir, Some(&[DETECTOR_FILE])) {
                return Err(NOT_SET_UP.into());
            }
            let session = tauri::async_runtime::spawn_blocking(move || {
                Session::builder().map_err(|e| e.to_string())?.commit_from_file(dir.join(DETECTOR_FILE)).map_err(|e| format!("Couldn't load the text finder: {e}"))
            })
            .await
            .map_err(|e| e.to_string())??;
            let d = Arc::new(Mutex::new(session));
            *state.detector.lock().map_err(|e| e.to_string())? = Some(d.clone());
            d
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        let img = image::load_from_memory_with_format(&png, image::ImageFormat::Png).map_err(|e| format!("Couldn't read the page: {e}"))?;
        let (w, h) = (img.width(), img.height());
        let pixels = Tensor::<f32>::from_array(([1usize, 3, DETECT_SIZE, DETECT_SIZE], detect_pixels(&img))).map_err(|e| e.to_string())?;
        let size = Tensor::<i64>::from_array(([1usize, 2], vec![w as i64, h as i64])).map_err(|e| e.to_string())?;
        let mut session = detector.lock().map_err(|e| e.to_string())?;
        let out = session.run(ort::inputs!["images" => pixels, "orig_target_sizes" => size]).map_err(|e| e.to_string())?;
        let (_, labels) = out["labels"].try_extract_tensor::<i64>().map_err(|e| e.to_string())?;
        let (_, boxes) = out["boxes"].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        let (_, scores) = out["scores"].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        Ok(text_areas(labels, boxes, scores, w as f32, h as f32))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The page as the detector takes it: RGB squashed to 640×640, values 0–1, shape [1, 3, 640, 640].
fn detect_pixels(img: &DynamicImage) -> Vec<f32> {
    let resized = img.resize_exact(DETECT_SIZE as u32, DETECT_SIZE as u32, imageops::FilterType::Triangle).to_rgb8();
    let plane = DETECT_SIZE * DETECT_SIZE;
    let mut flat = vec![0.0f32; 3 * plane];
    for (x, y, p) in resized.enumerate_pixels() {
        let i = y as usize * DETECT_SIZE + x as usize;
        for c in 0..3 {
            flat[c * plane + i] = p[c] as f32 / 255.0;
        }
    }
    flat
}

/// The text detections (boxes come in page pixels: x1, y1, x2, y2) as fractions of the page.
fn text_areas(labels: &[i64], boxes: &[f32], scores: &[f32], w: f32, h: f32) -> Vec<Found> {
    let clamp = |v: f32| v.clamp(0.0, 1.0);
    labels
        .iter()
        .zip(boxes.chunks_exact(4))
        .zip(scores)
        .filter(|((label, _), score)| (**label == TEXT_IN_BUBBLE || **label == TEXT_ELSEWHERE) && **score >= MIN_SCORE)
        .map(|((&label, b), &score)| {
            let (x1, y1, x2, y2) = (clamp(b[0] / w), clamp(b[1] / h), clamp(b[2] / w), clamp(b[3] / h));
            Found { x: x1, y: y1, w: x2 - x1, h: y2 - y1, in_bubble: label == TEXT_IN_BUBBLE, score }
        })
        .filter(|f| f.w > 0.0 && f.h > 0.0)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_areas_keep_text_only_as_page_fractions() {
        let labels = [0, 1, 2, 1];
        #[rustfmt::skip]
        let boxes = [
            0.0, 0.0, 50.0, 50.0,     // a bubble: not text
            100.0, 50.0, 150.0, 250.0, // text in a bubble
            0.0, 0.0, 400.0, 900.0,   // text elsewhere, past the page's edge
            10.0, 10.0, 20.0, 20.0,   // too unsure
        ];
        let found = text_areas(&labels, &boxes, &[0.9, 0.8, 0.5, 0.1], 200.0, 500.0);
        assert_eq!(found.len(), 2);
        assert_eq!(found[0], Found { x: 0.5, y: 0.1, w: 0.25, h: 0.4, in_bubble: true, score: 0.8 });
        assert_eq!((found[1].w, found[1].h, found[1].in_bubble), (1.0, 1.0, false));
    }
}
