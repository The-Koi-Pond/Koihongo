# 03 — Architecture

Rule of thumb: boring, well-supported tools; as few moving parts as possible.

## Tech stack (proposed)

| Part | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** | Makes a real Windows app from a web-page UI. Much smaller and lighter than Electron. The backend part is written in Rust, but we'll keep Rust code minimal. |
| UI | **TypeScript + React** (or Svelte, see open questions) | Huge ecosystem; I (Claude) can work in it fluently; lots of Japanese-text libraries exist for it. |
| Database | **SQLite** (one file on your PC) | No server to run. Easy to back up: copy one file. |
| Scheduler | **FSRS** via the `ts-fsrs` library | Proven open-source algorithm (same family Anki uses). No need to invent our own. |
| Romaji → kana typing | **WanaKana** library | Standard tool for this; WaniKani-style answer input. |
| Sentence splitting (later) | **kuromoji.js** or **Sudachi** | Splits Japanese text (which has no spaces) into words. |
| AI | **Anthropic Claude API** first, behind a small interface so other providers can be added | One provider is enough to start. |

### How the parts fit

```
┌──────────────── Tauri app window ────────────────┐
│  UI (TypeScript/React)                            │
│   ├─ screens: Today, Lessons, Reviews, Lookup…    │
│   ├─ FSRS scheduling (ts-fsrs)                    │
│   └─ talks to ↓                                   │
│  Backend (Rust, kept thin)                        │
│   ├─ SQLite database (your progress + content)    │
│   ├─ API key in Windows Credential Manager        │
│   └─ AI requests → Claude API (internet)          │
└───────────────────────────────────────────────────┘
```

AI requests go through the backend, not the UI, so the API key never sits in UI code.

## Content sources and licenses

We can't ship WaniKani, Bunpro or Anki-deck content. These open datasets cover most needs:

| Data | Source | License (summary) |
|---|---|---|
| Kanji: meanings, readings, grade, frequency, JLPT (old levels) | **KANJIDIC2** (EDRDG) | CC BY-SA 4.0: free to use, must credit, and shared changes stay under the same license |
| Dictionary: words, readings, meanings | **JMdict** (EDRDG) | CC BY-SA 4.0 |
| Kanji components | **KRADFILE / RADKFILE** (EDRDG) | EDRDG license (similar terms) |
| Stroke order | **KanjiVG** | CC BY-SA 3.0 |
| Example sentences (Japanese + English) | **Tatoeba** | CC BY 2.0 FR (some sentences CC0) |
| JLPT word/kanji lists | Community lists (no official list exists since 2010) | Varies; check each before use |

**Gaps we fill ourselves:**

- **Mnemonics:** none of the open sources have them. Plan: AI drafts them, you approve or rewrite them (see 02-features G).
- **Component names:** WaniKani's names are its own. We name components ourselves, starting from KANJIDIC/KRADFILE meanings.
- **Grammar explanations:** no good open grammar database exists. Grammar point *names* (e.g. 〜ている) aren't owned by anyone; explanations get written by us with AI help and reviewed.

Because CC BY-SA is "share-alike", the app needs an **About/credits screen** listing these sources. Keeping the app private and personal is fine either way.

Datasets are downloaded and converted into the app's database by an **import script**, run once (and re-run to update), not by hand.

## Data model (first draft)

Two kinds of data, kept separate so a dataset update never wipes your progress:

1. **Content**: kanji, words, sentences, grammar points (mostly from the imports).
2. **Your stuff**: review history, scheduling state, your mnemonics/notes, your synonyms.

```
components      id, glyph, name, …
kanji           id, character, meanings, on_readings, kun_readings, grade, freq_rank, jlpt
kanji_components   kanji_id → component_id
words           id, written, reading, meanings, freq_rank
word_kanji      word_id → kanji_id
sentences       id, japanese, english, source
sentence_words  sentence_id → word_id
grammar_points  id, name, pattern, explanation, …      (later)

study_items     id, kind (component|kanji|word|grammar|sentence), content_id,
                path_position, unlocked_at
srs_state       study_item_id, card_type (meaning|reading|…), FSRS fields, due_at
review_log      id, study_item_id, card_type, answer, correct, reviewed_at
notes           id, study_item_id, kind (mnemonic_meaning|mnemonic_reading|note),
                text, author (you|ai|ai_edited), created_at, is_current
ai_usage        id, feature, model, input_tokens, output_tokens, cost_estimate, at
```

`notes` keeps every version, so mnemonic history and the "AI-written" mark come for free.

## AI integration

### How a request works (mnemonic workshop example)

1. You click "Rework mnemonic" on 森 (forest).
2. The app builds a request containing: the kanji, its meanings and readings, its components and their names, your current mnemonic, and a short instruction ("help the learner make a vivid, memorable mnemonic; keep it short; use the component names").
3. The backend sends it to the Claude API with your key and streams the reply into a chat panel.
4. You chat back and forth. When you like one, "Use this" saves it as a new `notes` version marked `ai` (or `ai_edited` if you tweak it).

### Rules

- **API key** is stored in Windows Credential Manager, never in the database or config files.
- **Costs are visible:** each call is logged in `ai_usage`; settings show the monthly total; an optional cap blocks calls over the limit.
- **Model choice per feature:** a cheap, fast model (e.g. Claude Haiku) for bulk jobs like drafting mnemonics; a stronger model (e.g. Claude Sonnet) for chat and explanations. Configurable in settings.
- **Prompts live in plain text files** in the project, so they're easy to read and tune.
- **Japanese accuracy:** the AI's facts (readings, meanings) come *from our database* in the prompt, not from the AI's memory. The AI is used for creativity and explanation, not as the source of truth.

## Testing approach

- Unit tests for the parts that must be right: scheduling, answer checking (synonyms, kana conversion), unlock order, import script.
- Daily personal use is the real test of everything else.
