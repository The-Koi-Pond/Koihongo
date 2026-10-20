# 04 — Roadmap

Each phase ends with something you can **use daily**. Don't start the next phase until the current one has been in real use for a week or two. That's how we find what actually matters.

## Phase 0: Setup ✅ (2026-10-20)

- Install tools: Git, Node.js, Rust, Tauri prerequisites. (Exact copy-paste steps will be written when we start.)
- Create the project skeleton; the app opens an empty window.
- Put the project under Git version control (a history of every change, so nothing is lost).

**Done when:** an empty app window opens from a single command.

## Phase 1: Kanji core (first usable version)

- Import script: KANJIDIC2, KRADFILE, a JMdict subset, KanjiVG, a Tatoeba subset → SQLite.
- Generate the learning path (components → kanji → vocabulary).
- Lesson screen and review screen (typed answers, romaji → kana).
- FSRS scheduling, backlog-aware new-item limit, "5 minutes" mode.
- Today screen.
- Manual mnemonic editing with history.
- Backup button.

**Done when:** you can do daily kanji/vocab lessons and reviews in the app and would rather use it than WaniKani for this.

**Known gap:** most items start with no mnemonic. Phase 2 fixes that.

## Phase 2: AI mnemonic workshop

- Settings: API key (stored safely), model choice, spending cap, usage log.
- Mnemonic workshop chat on any item.
- Bulk-draft mnemonics for upcoming items (marked AI, editable).

**Done when:** you reworked a mnemonic through chat and saved it, and upcoming lessons have draft mnemonics.

## Phase 3: Lookup and sentences

- Dictionary search (English, kana, romaji, kanji).
- Example sentences on every word, preferring words you know.
- "Explain this sentence" AI helper.

## Phase 4: Grammar

- Grammar point list and lessons (explanations written with AI help, reviewed by you).
- Fill-in-the-blank reviews, merged into the same daily session.

## Phase 5: Reading and mining

- Paste text → split into words → hover definitions, known words marked.
- Save sentences and words to reviews.

## After that (unordered)

Audio/text-to-speech, pitch accent, progress charts, similar-kanji drills, Anki import, handwriting, conversation practice, maybe mobile.

---

## Open questions

Decisions to make before or during the relevant phase. Proposed answers are in *italics*.

1. **React or Svelte for the UI?** *React: bigger ecosystem, more examples to learn from. Svelte is simpler to read. Either works.*
2. **Separate meaning and reading reviews (WaniKani) or one combined card?** *Separate: it's proven and makes errors more specific.*
3. **How strict is answer checking?** E.g. typos in English meanings. *Forgive small typos in meanings, never in readings.*
4. **Where does the kanji order come from?** *Our own: JLPT N5→N1 and frequency, respecting component dependencies. Tune it after real use.*
5. **Which AI providers besides Claude?** *Claude only until there's a concrete reason to add another.*
6. **How do you want to work on this with me?** E.g. I write code and you test-drive each feature, or you want to learn to code parts yourself. This changes how much I explain while building.
