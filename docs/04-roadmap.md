# 04 — Roadmap

Each phase ends with something you can **use daily**. Don't start the next phase until the current one has been in real use for a week or two. That's how we find what actually matters.

## Phase 0: Setup ✅ (2026-10-20)

- Install tools: Git, Node.js, Rust, Tauri prerequisites. (Exact copy-paste steps will be written when we start.)
- Create the project skeleton; the app opens an empty window.
- Put the project under Git version control (a history of every change, so nothing is lost).

**Done when:** an empty app window opens from a single command.

## Phase 1: Kanji core (first usable version)

- ✅ Import script: KANJIDIC2, KRADFILE, a JMdict subset, KanjiVG, a Tatoeba subset → SQLite (`pnpm content:build`).
- ✅ Generate the learning path (components → kanji → vocabulary).
- ✅ Progress database (`user.db`) and loading both databases in the app.
- ✅ FSRS scheduling, unlocking, backlog-aware new-item limit.
- ✅ Today screen: due reviews, available lessons, start buttons.
- ✅ Lesson screen (5 items per round, then a practice quiz) and review screen (typed answers, romaji → kana, typo-tolerant meanings, exact readings, "I was right" → adds a synonym).
- ✅ "Just 5 minutes" mode, and "Stop here" any time without losing progress.
- ✅ Manual mnemonic editing with history; synonyms; Sources & licences screen.
- Catch-up mode after a break (today: overdue reviews come most-at-risk first and you can stop any time, but nothing spreads them over several days yet).
- Backup button (today: copy `%APPDATA%\com.xel.nihongo\user.db`).
- Settings screen for pacing numbers.

**Done when:** you can do daily kanji/vocab lessons and reviews in the app and would rather use it than WaniKani for this.

**Known gap:** most items start with no mnemonic. Phase 2 fixes that.

## Phase 2: AI mnemonic workshop

- ✅ AI backend: run the Claude Code CLI with your existing login (no API key, no spending log; see 03-architecture "AI integration").
- ✅ Mnemonic workshop chat on any item ("Ask AI" next to each mnemonic; prompts in `src/ai/prompts.ts`).
- Tune the prompt after real use (e.g. which reading a reading mnemonic should target).
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

- **Content:** "Did you know?" trivia popovers (feature E2). Collect candidates in `docs/trivia-backlog.md` until then.
- **UI:** a separate launch splash, if still wanted (Today now serves as the landing page).
- **Features:** audio/text-to-speech, pitch accent, progress charts, similar-kanji drills, Anki import, handwriting, conversation practice, maybe mobile.

---

## Open questions

Decisions to make before or during the relevant phase. Proposed answers are in *italics*.

1. ~~React or Svelte for the UI?~~ **Decided:** React (the project template is set up with it).
2. **Separate meaning and reading reviews (WaniKani) or one combined card?** *Separate: it's proven and makes errors more specific.*
3. **How strict is answer checking?** E.g. typos in English meanings. *Forgive small typos in meanings, never in readings.*
4. ~~Where does the kanji order come from?~~ **Decided:** our own order (old JLPT level → frequency → strokes, components first). See 03-architecture "How the default path is built". Tune after real use.
5. **Which AI providers besides Claude?** *Claude only until there's a concrete reason to add another.*
6. ~~How do you want to work on this with me?~~ **Decided:** Claude writes the code and explains it; Xel test-drives each feature.
7. **Component names** are our own (in `scripts/content/components.ts`). Some will feel off; they'll be renameable in-app.
