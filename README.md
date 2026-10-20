# nihongo

A personal, all-in-one Windows desktop app for learning Japanese. It takes the best methods from existing tools (WaniKani, Anki, Bunpro) and links kanji, vocabulary, grammar and reading together in one place. Where it helps, it can call AI models (for example, to rework a kanji mnemonic you don't like).

Status: **Phase 1, first studyable version.** Lessons, reviews, mnemonics and synonyms work. Remaining for Phase 1: catch-up mode, backup button, settings screen, and whatever daily use turns up.

## Running it

In a terminal, from this folder:

```
pnpm install
pnpm content:build
pnpm tauri dev
```

- `pnpm content:build` downloads the open datasets (~50 MB, cached in `data/raw/`) and builds `src-tauri/resources/content.db`. It takes about 10 seconds. Re-run it now and then to pick up dictionary updates; add `--refresh` to force fresh downloads.
- `pnpm tauri dev` starts the app. The first run compiles the Rust side and takes a minute or two; later runs are fast. Edits to files in `src/` update the window live.

Checks: `pnpm test` (TypeScript unit tests), `pnpm typecheck` (TypeScript errors), and `cargo test` inside `src-tauri/` (Rust database tests).

Your progress is saved in `%APPDATA%\com.xel.nihongo\user.db`. Copy that file to back it up.

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
