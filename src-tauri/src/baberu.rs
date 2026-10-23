//! Baberu OCR (genshiai-daichi/baberu-ocr, Apache-2.0): a smaller manga OCR
//! model that its authors report reads sound effects far better than
//! manga-ocr. Run with ONNX Runtime as three graphs (vision → decoder prefill
//! → decoder steps with a key/value cache), decoded the way its own
//! onnx_infer.py does: greedy, with a repetition penalty and caps on runs of
//! the same character.
//!
//! Its confidence is the geometric mean of the probabilities of the
//! characters it picked, lowered for crops the 224×224 resize treats badly
//! (that calibration is from manga-ocr-rs 1.0.0 by Hideki A. Ikeda and
//! CodeMonkeyNinja, MIT: <https://github.com/CodeMonkeyNinja/manga-ocr-rs>).

use image::{imageops, DynamicImage};
use ort::session::{Session, SessionInputValue};
use ort::value::{DynValue, Tensor};
use std::borrow::Cow;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;

/// The vision graph we download: the int4 tier (the decoder graphs are int8).
pub const VISION: &str = "vision_int4.onnx";
const IMG_SIZE: usize = 224;
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];
const BOS: i64 = 1;
const EOS: i64 = 2;
const MAX_TOKENS: usize = 256;
const REPETITION_PENALTY: f32 = 1.2;
/// The most times one letter, kana, kanji or digit may repeat in a row (symbols such as ー: more).
const MAX_CONTENT_RUN: usize = 12;
const MAX_SYMBOL_RUN: usize = 16;

pub struct Baberu {
    vision: Mutex<Session>,
    prefill: Mutex<Session>,
    step: Mutex<Session>,
    /// Token id - 4 → its character (ids 0–3 are pad, bos, eos, unk).
    charset: Vec<String>,
    /// Ids of single letters, kana, kanji and digits (other than long-vowel marks).
    content: HashSet<i64>,
}

/// The crop as the model was trained on it: RGB at 224×224 with ImageNet's mean and spread. Shape [1, 3, 224, 224].
fn preprocess(img: &DynamicImage) -> Vec<f32> {
    let resized = img.resize_exact(IMG_SIZE as u32, IMG_SIZE as u32, imageops::FilterType::CatmullRom).to_rgb8();
    let plane = IMG_SIZE * IMG_SIZE;
    let mut flat = vec![0.0f32; 3 * plane];
    for (x, y, p) in resized.enumerate_pixels() {
        let i = y as usize * IMG_SIZE + x as usize;
        for c in 0..3 {
            flat[c * plane + i] = (p[c] as f32 / 255.0 - MEAN[c]) / STD[c];
        }
    }
    flat
}

/// The next-token logits (last position) from a decoder run, and its key/value cache in output order.
fn split(mut out: ort::session::SessionOutputs<'_>, names: &[String]) -> Result<(Vec<f32>, Vec<DynValue>), String> {
    let logits = {
        let (shape, data) = out[0].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        let vocab = shape[2] as usize;
        data[data.len() - vocab..].to_vec()
    };
    let cache = names[1..].iter().map(|n| out.remove(n).ok_or_else(|| format!("missing output {n}"))).collect::<Result<_, _>>()?;
    Ok((logits, cache))
}

impl Baberu {
    pub fn new(dir: &Path) -> Result<Self, String> {
        Self::with_vision(dir, VISION)
    }

    fn with_vision(dir: &Path, vision_file: &str) -> Result<Self, String> {
        let session = |name: &str| -> Result<Session, String> {
            Session::builder().map_err(|e| e.to_string())?.commit_from_file(dir.join(name)).map_err(|e| format!("Couldn't load {name}: {e}"))
        };
        let charset: Vec<String> = serde_json::from_str(&std::fs::read_to_string(dir.join("vocab.json")).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        let content = charset
            .iter()
            .enumerate()
            .filter(|(_, ch)| {
                let mut chars = ch.chars();
                matches!((chars.next(), chars.next()), (Some(c), None) if !"ーｰ〜~".contains(c) && c.is_alphanumeric())
            })
            .map(|(i, _)| i as i64 + 4)
            .collect();
        Ok(Self {
            vision: Mutex::new(session(vision_file)?),
            prefill: Mutex::new(session("decoder_prefill_int8.onnx")?),
            step: Mutex::new(session("decoder_step_int8.onnx")?),
            charset,
            content,
        })
    }

    /// The text in a crop, and how sure it is (0–1).
    pub fn recognize(&self, img: &DynamicImage) -> Result<(String, f32), String> {
        let pixels = Tensor::<f32>::from_array(([1usize, 3, IMG_SIZE, IMG_SIZE], preprocess(img))).map_err(|e| e.to_string())?;
        let (embeds, embeds_len) = {
            let mut vision = self.vision.lock().map_err(|e| e.to_string())?;
            let mut out = vision.run(ort::inputs!["pixel_values" => pixels]).map_err(|e| e.to_string())?;
            let embeds = out.remove("vision_embeds").ok_or("missing vision_embeds")?;
            let len = embeds.shape()[1];
            (embeds, len)
        };

        let mut prefill = self.prefill.lock().map_err(|e| e.to_string())?;
        let names: Vec<String> = prefill.outputs().iter().map(|o| o.name().to_owned()).collect();
        let ids = Tensor::<i64>::from_array(([1usize, 1], vec![BOS])).map_err(|e| e.to_string())?;
        let out = prefill.run(ort::inputs!["vision_embeds" => embeds, "input_ids" => ids]).map_err(|e| e.to_string())?;
        let (mut logits, mut cache) = split(out, &names)?;
        drop(prefill);

        let mut step = self.step.lock().map_err(|e| e.to_string())?;
        let step_names: Vec<String> = step.outputs().iter().map(|o| o.name().to_owned()).collect();
        let past: Vec<String> = (0..6).map(|i| format!("past_k{i}")).chain((0..6).map(|i| format!("past_v{i}"))).collect();
        let mut seen: HashSet<i64> = HashSet::from([BOS]);
        let mut tokens: Vec<i64> = Vec::new();
        let mut position = embeds_len + 1;
        // The log-probability of each choice (before the penalties), for the confidence.
        let mut sure: Vec<f32> = Vec::new();
        while tokens.len() < MAX_TOKENS {
            let raw = log_softmax(&logits);
            for &t in &seen {
                let l = &mut logits[t as usize];
                *l = if *l < 0.0 { *l * REPETITION_PENALTY } else { *l / REPETITION_PENALTY };
            }
            if let Some(&last) = tokens.last() {
                let cap = if self.content.contains(&last) { MAX_CONTENT_RUN } else if last > 3 { MAX_SYMBOL_RUN } else { 0 };
                if cap > 0 && tokens.iter().rev().take_while(|&&t| t == last).count() >= cap {
                    logits[last as usize] = f32::NEG_INFINITY;
                }
            }
            let next = logits.iter().enumerate().max_by(|a, b| a.1.total_cmp(b.1)).map(|(i, _)| i as i64).unwrap_or(EOS);
            sure.push(raw[next as usize]);
            if next == EOS {
                break;
            }
            tokens.push(next);
            seen.insert(next);
            let mut inputs: Vec<(Cow<str>, SessionInputValue)> = vec![
                ("input_ids".into(), Tensor::<i64>::from_array(([1usize, 1], vec![next])).map_err(|e| e.to_string())?.into()),
                ("position_ids".into(), Tensor::<i64>::from_array(([1usize, 1], vec![position])).map_err(|e| e.to_string())?.into()),
            ];
            inputs.extend(past.iter().cloned().map(Cow::Owned).zip(cache.drain(..).map(SessionInputValue::from)));
            let out = step.run(inputs).map_err(|e| e.to_string())?;
            (logits, cache) = split(out, &step_names)?;
            position += 1;
        }
        let text = tokens.iter().filter(|&&t| t >= 4).filter_map(|&t| self.charset.get(t as usize - 4)).map(String::as_str).collect();
        let confidence = (sure.iter().sum::<f32>() / sure.len().max(1) as f32).exp() * size_factor(img.width(), img.height());
        Ok((text, confidence))
    }
}

fn log_softmax(logits: &[f32]) -> Vec<f32> {
    let max = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let log_z = logits.iter().map(|&x| (x - max).exp()).sum::<f32>().ln() + max;
    logits.iter().map(|&x| x - log_z).collect()
}

/// Lower for crops the 224×224 resize treats badly: tiny, huge or very stretched.
fn size_factor(width: u32, height: u32) -> f32 {
    let area = width as f32 * height as f32;
    let aspect = width.max(height) as f32 / width.min(height).max(1) as f32;
    let area_factor = match area {
        a if a < 2_500.0 => 0.3,
        a if a < 10_000.0 => 0.6,
        a if a < 500_000.0 => 1.0,
        a if a < 2_000_000.0 => 0.9,
        _ => 0.7,
    };
    let aspect_factor = match aspect {
        a if a < 2.0 => 1.0,
        a if a < 4.0 => 0.95,
        a if a < 8.0 => 0.85,
        _ => 0.7,
    };
    area_factor * aspect_factor
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn small_or_stretched_crops_are_less_sure() {
        assert_eq!(size_factor(300, 300), 1.0);
        assert!(size_factor(40, 40) < 0.5);
        assert!(size_factor(40, 900) < size_factor(300, 300));
    }

    #[test]
    fn log_softmax_sums_to_one() {
        let lp = log_softmax(&[1.0, 2.0, 3.0]);
        assert!((lp.iter().map(|x| x.exp()).sum::<f32>() - 1.0).abs() < 1e-5);
    }

    #[test]
    fn preprocess_is_normalised_rgb() {
        let img = DynamicImage::ImageRgb8(image::RgbImage::from_pixel(50, 120, image::Rgb([255, 255, 255])));
        let flat = preprocess(&img);
        assert_eq!(flat.len(), 3 * IMG_SIZE * IMG_SIZE);
        assert!((flat[0] - (1.0 - MEAN[0]) / STD[0]).abs() < 1e-4);
    }

    /// Reads saved crops with the downloaded model, to check it on real pages:
    /// MODELS_DIR=%APPDATA%/com.xel.nihongo/models/text-reading CROPS_DIR=… cargo test --release --lib baberu -- --ignored --nocapture
    #[test]
    #[ignore]
    fn read_saved_crops() {
        let dir = |v: &str| std::path::PathBuf::from(std::env::var(v).unwrap_or_else(|_| panic!("set {v}")));
        let model = Baberu::new(&dir("MODELS_DIR")).unwrap();
        let mut crops: Vec<_> = std::fs::read_dir(dir("CROPS_DIR")).unwrap().map(|e| e.unwrap().path()).collect();
        crops.sort();
        for path in crops {
            let t = std::time::Instant::now();
            let (text, confidence) = model.recognize(&image::open(&path).unwrap()).unwrap();
            println!("{}: {text} ({:.0}% sure, {} ms)", path.file_name().unwrap().to_string_lossy(), confidence * 100.0, t.elapsed().as_millis());
        }
    }
}
