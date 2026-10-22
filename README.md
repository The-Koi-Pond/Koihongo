# Koihongo

Koihongo (鯉 *koi* "carp" + 恋 *koi* "love" + 日本語 *nihongo*) is a personal, all-in-one Windows desktop app for learning Japanese. It takes the best methods from existing tools (WaniKani, Anki, Bunpro) and links kanji, vocabulary, grammar and reading together in one place. Where it helps, it can call AI models (for example, to rework a kanji mnemonic you don't like).

Status: **Phases 0–3 done** (lessons and reviews, settings and backups, dictionary, example sentences, AI helpers), plus your own flashcard decks. Phase 4 (grammar) has started: the first beginner points are in as drafts. See [docs/04-roadmap.md](docs/04-roadmap.md).

It's an early, personal project by Xel, shared with friends for testing. Things will change and things will break.

## Trying it

Download `Koihongo_x.y.z_x64-setup.exe` from the [Releases page](https://github.com/The-Koi-Pond/Koihongo/releases) and run it. Windows will probably say "Windows protected your PC" because the app isn't signed: choose **More info → Run anyway**. Your progress stays on your own PC.

The AI helper is optional and off until you pick one in Settings → AI helper: Claude Code, the Anthropic API, or any OpenAI-compatible service (including free local models via Ollama or LM Studio). API keys are kept in Windows Credential Manager.

## Reporting problems

Open an issue saying what you did, what you expected, and what happened instead. A screenshot helps a lot.

## Running it from source

You need [Node.js](https://nodejs.org) 24+, [pnpm](https://pnpm.io), and [Rust with the Tauri prerequisites](https://tauri.app/start/prerequisites/).

In a terminal, from this folder:

```
pnpm install
pnpm content:build
pnpm tauri dev
```

- `pnpm content:build` downloads the open datasets (~50 MB, cached in `data/raw/`) and builds `src-tauri/resources/content.db`. It takes about 10 seconds. Re-run it now and then to pick up dictionary updates; add `--refresh` to force fresh downloads.
- `pnpm tauri dev` starts the app. The first run compiles the Rust side and takes a minute or two; later runs are fast. Edits to files in `src/` update the window live.

Checks: `pnpm test` (TypeScript unit tests), `pnpm typecheck` (TypeScript errors), and `cargo test` inside `src-tauri/` (Rust database tests).

Your progress is saved in `%APPDATA%\com.xel.nihongo\user.db`, and backed up automatically once a day to `Documents\Koihongo\Backups` (Settings has "Back up now" and restore).

To make the installer: close the running app first (the build needs to read `content.db`), then `pnpm tauri build`. It ends up in `src-tauri/target/release/bundle/nsis/`.

## Documents

Read them in this order:

| File | What it answers |
|---|---|
| [docs/01-vision.md](docs/01-vision.md) | Why this exists, who it's for, and the design rules, especially the ones meant to make it easy to stick with |
| [docs/02-features.md](docs/02-features.md) | What the app does, split into modules, with each item marked *first version* or *later* |
| [docs/03-architecture.md](docs/03-architecture.md) | Tech stack, where data comes from (and the license rules), the data model, and how AI calls work |
| [docs/04-roadmap.md](docs/04-roadmap.md) | Build order in phases, what "done" means for each phase, and open questions |

## Glossary

- **SRS (spaced repetition system):** a review scheduler that shows you an item just before you're likely to forget it. Anki, WaniKani and Bunpro all use one.
- **FSRS (Free Spaced Repetition Scheduler):** a modern, open-source SRS algorithm. Anki has used it since 2023. We'll use it too.
- **Mnemonic:** a short memorable story that ties a kanji's look to its meaning or reading.
- **Radical / component:** a building-block shape inside a kanji (e.g. 木 "tree" inside 林 "grove").
- **Kana:** the two phonetic alphabets, hiragana (ひらがな) and katakana (カタカナ).
- **Sentence mining:** saving real sentences you meet while reading or watching, then studying them.

## Credits

The study content is built from open data. Thank you to:

- **KANJIDIC2**, **JMdict** and **KRADFILE/RADKFILE**: the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/edrdg/licence.html) (CC BY-SA 4.0)
- **KanjiVG** stroke orders: Ulrich Apel, [kanjivg.tagaini.net](https://kanjivg.tagaini.net) (CC BY-SA 3.0)
- **Example sentences**: [Tatoeba](https://tatoeba.org) contributors (Tanaka Corpus, indexed by the EDRDG) (CC BY 2.0 FR)
- **jmdict-simplified** (the JSON conversion we read): Dmitry Shpika and contributors (CC BY-SA 4.0)
- **Fonts**: M PLUS Rounded 1c, Pixelify Sans, DotGothic16, Tiny5 and Silkscreen (SIL Open Font License)

The app shows these under Settings → Sources & licences. Pixel art by Xel.

## Licence

The code is under the [MIT licence](LICENSE): use it, change it and share it, keeping the copyright notice. The pixel art in `src/assets/` and the app icons are © Xel, all rights reserved (please ask before reusing them). The datasets and fonts keep their own licences, listed above. Details in [NOTICE.md](NOTICE.md).
