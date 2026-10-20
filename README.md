# nihongo

A personal, all-in-one Windows desktop app for learning Japanese. It takes the best methods from existing tools (WaniKani, Anki, Bunpro) and links kanji, vocabulary, grammar and reading together in one place. Where it helps, it can call AI models (for example, to rework a kanji mnemonic you don't like).

Status: **Phase 0 done**: the empty app skeleton runs. Next up is Phase 1 (kanji core).

## Running it

In a terminal, from this folder:

```
pnpm install
pnpm tauri dev
```

The first run compiles the Rust side and takes a minute or two; later runs are fast. While it's running, edits to files in `src/` update the window live.

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
