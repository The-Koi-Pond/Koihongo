//! Splitting Japanese into words (Reading: word help), with lindera (MIT) and
//! its build of the IPADIC dictionary, downloaded with the text-reading
//! models (ocr.rs). The window matches the pieces to JMdict (src/words.ts).

use lindera::dictionary::load_fs_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use serde::Serialize;
use std::borrow::Cow;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::ocr::{installed, model_dir, Ocr, NOT_SET_UP};

/// The dictionary's folder, inside the models folder.
const DICTIONARY: &str = "lindera-ipadic";
/// Its biggest file: there (at the right size) once the download is unpacked.
pub(crate) const DICTIONARY_CHECK: &str = "lindera-ipadic/dict.words";
const DICTIONARY_ZIP: &str = "lindera-ipadic-6.2.0.zip";

/// One piece of the text, as IPADIC sees it. Unknown words (names, slang)
/// have no base form or reading.
#[derive(Serialize, Debug, PartialEq)]
pub struct Piece {
    surface: String,
    /// Part of speech and its subcategories, in Japanese (動詞, 自立…).
    pos: [String; 4],
    /// Conjugation type and form (五段・タ行, 連用形), for verbs and adjectives.
    conjugation: [String; 2],
    /// Dictionary form (待ち → 待つ).
    base: String,
    /// Reading of the surface, in katakana.
    reading: String,
}

/// A piece from IPADIC's fields: part of speech ×4, conjugation type and form, base form, reading, pronunciation ("*": none).
fn piece(surface: &str, details: &[&str]) -> Piece {
    let field = |i: usize| details.get(i).filter(|v| **v != "*").map(|v| v.to_string()).unwrap_or_default();
    Piece { surface: surface.to_owned(), pos: [field(0), field(1), field(2), field(3)], conjugation: [field(4), field(5)], base: field(6), reading: field(7) }
}

/// Splits a text into pieces (the dictionary loads on first use, in well under a second).
#[tauri::command]
pub async fn words_split(app: AppHandle, state: State<'_, Ocr>, text: String) -> Result<Vec<Piece>, String> {
    let loaded = state.words.lock().map_err(|e| e.to_string())?.clone();
    let segmenter = match loaded {
        Some(s) => s,
        None => {
            let dir = model_dir(&app)?;
            if !installed(&dir, Some(&[DICTIONARY_ZIP])) {
                return Err(NOT_SET_UP.into());
            }
            let s = Arc::new(
                tauri::async_runtime::spawn_blocking(move || load_fs_dictionary(&dir.join(DICTIONARY)).map(|d| Segmenter::new(Mode::Normal, d, None)))
                    .await
                    .map_err(|e| e.to_string())?
                    .map_err(|e| format!("Couldn't load the word dictionary: {e}"))?,
            );
            *state.words.lock().map_err(|e| e.to_string())? = Some(s.clone());
            s
        }
    };
    let mut tokens = segmenter.segment(Cow::Owned(text)).map_err(|e| e.to_string())?;
    Ok(tokens
        .iter_mut()
        .map(|t| {
            let surface = t.surface.to_string();
            piece(&surface, &t.details())
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pieces_take_ipadic_fields_and_drop_stars() {
        let p = piece("待ち", &["動詞", "自立", "*", "*", "五段・タ行", "連用形", "待つ", "マチ", "マチ"]);
        assert_eq!(p.base, "待つ");
        assert_eq!(p.reading, "マチ");
        assert_eq!(p.pos, ["動詞".to_string(), "自立".into(), "".into(), "".into()]);
        assert_eq!(p.conjugation, ["五段・タ行".to_string(), "連用形".into()]);
        let unknown = piece("セフィルノ", &["名詞", "一般", "*", "*", "*", "*", "*", "*", "*"]);
        assert_eq!((unknown.base.as_str(), unknown.reading.as_str()), ("", ""));
    }

    /// Splits sample bubbles with a downloaded dictionary:
    /// LINDERA_DIR=…/lindera-ipadic cargo test --lib words -- --ignored --nocapture
    #[test]
    #[ignore]
    fn try_splitting() {
        let dir = std::path::PathBuf::from(std::env::var("LINDERA_DIR").unwrap());
        let segmenter = Segmenter::new(Mode::Normal, load_fs_dictionary(&dir).unwrap(), None);
        for text in ["もう待ちません", "邪魔者はもういないのだから…", "やっと二人きりだ", "食べさせられたくなかった"] {
            let mut tokens = segmenter.segment(Cow::Borrowed(text)).unwrap();
            println!("{text}");
            for t in tokens.iter_mut() {
                let surface = t.surface.to_string();
                println!("  {:?}", piece(&surface, &t.details()));
            }
        }
    }
}
