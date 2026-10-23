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
- ✅ Skipping what you already know (2026-10-23, from Deci's feedback): "I know all 5" on a lesson round fast-tracks the round and skips its quiz; Library → Kana → "I already know these" starts whole kana sets (basic, dakuten, combinations, extended, per script) on fast track, skipping lessons and the daily kana limit (`startAsKnown`, `kanaGroups` in `src/srs/progress.ts`). The first review still checks.
- ✅ Manual mnemonic editing with history; synonyms; Sources & licences screen.
- ✅ Catch-up mode after a break: when more is due than the daily catch-up share (Settings, default 150), you get that share a day, most at risk first; "Do extra anyway" skips the limit. Lessons pause meanwhile (backlog pause).
- ✅ Backups: automatic once a day (last 14 kept), "Back up now", and restore from a list, in `Documents\Koihongo\Backups` (`src/backup.ts`, `src-tauri/src/backup.rs`).
- ✅ Settings screen for pacing numbers (lessons and kana per day, backlog pause, day start), saved in user.db `settings`.

**Done when:** you can do daily kanji/vocab lessons and reviews in the app and would rather use it than WaniKani for this.

**Known gap:** most items start with no mnemonic. Phase 2 fixes that.

## Phase 2: AI mnemonic workshop

- ✅ AI backend: run the Claude Code CLI with your existing login (no API key, no spending log; see 03-architecture "AI integration").
- ✅ AI helper choice (2026-10-23): off by default; Claude Code, the Anthropic API, or an OpenAI-compatible service (OpenAI, OpenRouter, Gemini, local Ollama / LM Studio, custom), picked in Settings, keys in Windows Credential Manager.
- ✅ Mnemonic workshop chat on any item ("Ask AI" next to each mnemonic; prompts in `src/ai/prompts.ts`).
- Tune the prompt after real use (e.g. which reading a reading mnemonic should target).
- Bulk-draft mnemonics for upcoming items (marked AI, editable).

**Done when:** you reworked a mnemonic through chat and saved it, and upcoming lessons have draft mnemonics.

## Phase 3: Lookup and sentences

- ✅ Dictionary search (English, kana, romaji, kanji) over all 22,647 common JMdict words and 2,974 kanji, on your path or not (`search` table in content.db, `src/dictionary.ts`).
- ✅ Find kanji by parts: a "Find by parts" toggle in the Dictionary opens a radical chart of all 245 components by stroke count; picking parts lists every kanji containing them all and dims parts that can't narrow it further (`kanjiByParts` in `src/dictionary.ts`, from KRADFILE's `kanji_components`). Shortcuts from kanji pages ("Find kanji with these parts") and component pages ("Find all kanji with this part").
- ✅ On-screen kana keyboard: a title-bar button (left of Settings) opens a floating gojūon chart that types into the last-used text box on any screen, with ゛ ゜ 小 (applied to the kana before the cursor), hiragana/katakana, backspace and Enter; drag it by its header, and it remembers where (`src/ui/KanaKeyboard.tsx`, logic in `src/kanaKeys.ts`).
- ✅ Example sentences, preferring words you know: up to 20 per word from the Tanaka Corpus; a word page shows the 3 with the fewest words you haven't started. 15,755 words have some; 399 path words (mostly newspaper words like 県立) still have none.
- ✅ "Explain this sentence" AI helper: an Explain button on each example opens a chat that breaks the sentence down (kana and romaji, piece by piece, grammar notes, translation), using readings from our dictionary; follow-up questions welcome (`explainSystemPrompt` in `src/ai/prompts.ts`).

## Flashcard decks ✅ (2026-10-23)

- Your own decks (`src/decks.ts`, `src/screens/Decks.tsx`, user.db `decks`, `deck_cards`, `deck_review_log`): write cards with a free-text front and back, or "Add to deck" on any Library or Dictionary item page (front and back filled in from the item, as an editable copy).
- Flip and rate, Anki-style (`src/ui/FlipCard.tsx`): Space shows the back, then Again / Hard / Good / Easy (keys 1–4), each showing when the card would come back. Scheduled with the same FSRS settings as path cards.
- Each deck has an "In daily reviews" toggle (on by default): its due cards then mix into the normal review session, ordered by risk with everything else, and count in Today's review numbers and forecast. They don't slow down lessons (only the path backlog does). Any deck can also be studied on its own ("Study N due", or "Practice all" when nothing is due).
- Later, if wanted: a new-cards-per-day limit per deck (new cards are due immediately now), images or audio on cards, Anki import.

## Phase 4: Grammar

- ✅ Grammar section, read-only: the first 10 N5 points in textbook order (は…です, か, の, これ/この/ここ series, も, じゃないです, ね・よ, ます), each with a pattern, a plain explanation, highlighted examples and related points. Data in `src/grammar/points.ts`, pages in `src/screens/Grammar.tsx`. Drafts written with AI help; set `checked: true` on a point once Xel has read it.
- Write the rest of N5 (を, に/へ, で, ました, たい, て-form, ている, adjectives…), after Xel has checked the style of the first 10.
- Grammar lessons, unlocking once you know the words their examples use. Move the points into content.db then (the build can read the same file).
- Fill-in-the-blank reviews, merged into the same daily session:
  - **Answer style by rank:** pick from a few options at low ranks, type the missing piece in kana at higher ranks.
  - **Varied sentences:** templates with slots (*[person]* は *[job]* です) filled each time from a small hand-picked list of words you've learned for that slot, so the same sentence doesn't come back word for word; a fixed fallback sentence while you know too few.

## Phase 5: Reading and mining

Your own manga, in stages (details: `02-features.md` F):

- ✅ Stage 1: bookshelf (folders and .cbz), reader, boxes with text and meaning, "seen before" across books, glossary, "About this book".
- Stage 2: split marked text into words, known-word colours, words to deck cards with sentence and panel cut-out.
- Stage 3: OCR (Windows built-in, optional manga-ocr) and AI reading of a box, with the context sent along (`readingContext` in `src/reading.ts`: the series page's info plus the chapter's notes) and the reply explaining how the context changes the meaning.
- Paste text → split into words → hover definitions, known words marked.

## After that (unordered)

- **Content:** "Did you know?" trivia popovers (feature E2). Collect candidates in `docs/trivia-backlog.md` until then.
- **UI:** a separate launch splash, if still wanted (Today now serves as the landing page).
- ✅ **Levels:** game-style levels (about a week each at the default pace) in approximate JLPT regions, with a level-up moment on Today. Display only.
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
