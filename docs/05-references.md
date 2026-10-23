# Reference projects

Other projects worth studying before building a feature: how they solved the same problem, and what to borrow. Checked on 2026-10-23; re-check activity and licences before relying on anything here.

**Licences matter.** Koihongo is MIT. A **GPL** project can be studied for ideas, behaviour and file formats, but its code must not be copied into Koihongo (that would make Koihongo GPL too). MIT, BSD and similar licences allow reuse with credit.

## Reading, stage 2: word help

### Yomitan (suggested by Deci)

- **What:** the widely used pop-up dictionary browser extension for Japanese learners: hover over a word and its definition pops up. Successor to Yomichan.
- **Where:** [github.com/yomidevs/yomitan](https://github.com/yomidevs/yomitan). GPL-3.0, actively developed (last push 2026-10-22).
- **Look at:**
  - The pop-up: what it shows first (reading, meanings, part of speech), how it handles several matches, and how it stays out of the way.
  - **Deinflection:** turning a conjugated word back into its dictionary form before looking it up (食べた → 食べる, 行かなかった → 行く). Study the rules and behaviour, then write our own.
  - **Scanning:** how it finds where a word starts and ends in unsegmented Japanese text (longest match against the dictionary).
  - **Its dictionary format.** Many free dictionaries are published in it (word dictionaries, kanji, frequency lists, pitch accent). Reading the format ourselves would let Koihongo import those files. The format is just data, so it's fine to support; each dictionary has its own licence to respect.

## Reading, stage 3: text without typing

### LunaTranslator (suggested by Deci)

- **What:** a Windows translator for visual novels. It grabs text from games by hooking into them, by OCR from the screen, or from the clipboard, then translates and annotates it.
- **Where:** [github.com/HIllya51/LunaTranslator](https://github.com/HIllya51/LunaTranslator). GPL-3.0, very active (last push 2026-10-22).
- **Look at:**
  - **OCR:** which engines it offers (built-in offline models plus online and offline alternatives), how you choose between them, and how it handles vertical and stylised text.
  - **Word splitting and furigana** over Japanese text (it uses MeCab), relevant to stage 2 too.
  - Its **Anki export** and **Yomitan integration**: how a learner moves from reading to saving words.
  - How it shows a translation next to the original without clutter.

### Textractor (suggested by Deci)

- **What:** extracts text from running games and visual novels by hooking into their memory, with extensions that send the text elsewhere (the clipboard, for example).
- **Where:** [github.com/Artikash/Textractor](https://github.com/Artikash/Textractor). GPL-3.0, quieter now (last push 2024-03-15).
- **Look at:** not useful for manga (pages are images, with no text to hook), but it suggests a later feature: a **text reading mode** that takes lines pasted in or watched from the clipboard, so people reading visual novels with Textractor (or LunaTranslator) can send each line into Koihongo and use the same word help and marks.

### manga-ocr

- An offline OCR model trained on manga text (vertical text, furigana, odd fonts): [github.com/kha-white/manga-ocr](https://github.com/kha-white/manga-ocr), Apache-2.0. **Tried first, then replaced by Baberu OCR** (below):
  - The model comes as ONNX from [mayocream/manga-ocr-onnx](https://huggingface.co/mayocream/manga-ocr-onnx) (Apache-2.0), pinned to one commit and checked by size and SHA-256 when downloaded.
  - The reading code in `src-tauri/src/ocr.rs` is adapted from [manga-ocr-rs](https://github.com/CodeMonkeyNinja/manga-ocr-rs) 1.0.0 (MIT). We don't depend on that crate: its build script downloads the 441 MB model on every fresh build.
  - [Koharu](https://github.com/mayocream/koharu) (a Rust manga translator) runs the same model and is worth a look for automatic bubble detection (stage 4).
  - Checked on a real page (2026-10-23): clean speech bubbles read perfectly at 95–100% confidence; stylised SFX came back wrong and unsure (13–48%).

### Baberu OCR (in use)

- [huggingface.co/genshiai-daichi/baberu-ocr](https://huggingface.co/genshiai-daichi/baberu-ocr), Apache-2.0: a 115M-parameter manga OCR (DINOv2 vision + a small decoder) trained partly from manga-ocr, with official ONNX files. We use the smallest tier (vision int4 + decoder int8, 122 MB), pinned to one commit. Ported from its `onnx_infer.py` into `src-tauri/src/baberu.rs`.
- On the same test page (2026-10-23): identical to manga-ocr on speech, and read all four stylised コツ footsteps that manga-ocr got wrong; 70–110 ms a box on CPU. Its own benchmark: SFX exact match 78% against manga-ocr's 36%.
- Caveat: very new (v1.2, October 2026). If it disappoints, Hayai OCR (Apache-2.0, community ONNX) is the next candidate; PaddleOCR-VL is too heavy (1–2 GB, over a minute a page on CPU).

### comic-text-and-bubble-detector (in use)

- [huggingface.co/ogkalu/comic-text-and-bubble-detector](https://huggingface.co/ogkalu/comic-text-and-bubble-detector), Apache-2.0, an RT-DETR-v2 model behind "Find text on this page": bubbles, text in bubbles and text elsewhere. We use the 11 MB int8 version, called the way [comic-translate](https://github.com/ogkalu2/comic-translate) does (640×640 input, scores from 0.3). On a test page it found both speech bubbles in about a second, tightly boxed; small sound effects can be missed.
- Rejected: Koharu's own layout model (trained on Manga109, academic-use terms), comic-text-detector (GPL-3.0) and the YOLO bubble detectors (Ultralytics, AGPL).

## The reader: zoom and pan

Compared on 2026-10-23, when Deci suggested building the reader on an established library instead of from scratch.

- **Chosen: [react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch)** (MIT, 4.2.0, updated Sep 2026). It zooms the page as a whole, with our boxes inside it, so they zoom and pan with the page for free. Used in `PageView` in `src/screens/Reading.tsx`. Gotchas found while wiring it in:
  - its smooth wheel zoom multiplies `wheel.step` by the scroll distance (100 per mouse-wheel click), so the step must be tiny (we use 0.002);
  - `resetTransform()` did nothing for us, so the buttons use `setTransform` directly;
  - panning by scrolling (`trackPadPanning`) is off by default.
- [@panzoom/panzoom](https://github.com/timmywil/panzoom) (MIT, tiny, not React-specific): the same approach with more glue code. The fallback if react-zoom-pan-pinch ever becomes a problem.
- [OpenSeadragon](https://github.com/openseadragon/openseadragon) (BSD-3, very established): built for gigantic zoomable images, and has its own system for overlays on the image. Overkill for manga pages; worth another look only for huge scans.
- Full comic readers we found were stale, early-stage or GPL apps rather than libraries: Villain (MIT, last updated 2022), comic-reader (early, "not for production"), OpenComic and Cosmic Comics (GPL apps). [foliate-js](https://github.com/johnfactotum/foliate-js) (MIT) opens .cbz, but its fixed-page renderer is unfinished and hard to overlay.
- No library handles **two-page spreads** or a **webtoon (long vertical scroll) mode**; those are layout work we'd build ourselves on top of the zoom.
