# 02 — Features

Each feature is tagged:

- **[v1]**: in the first usable version
- **[later]**: planned, built after v1 is in daily use
- **[maybe]**: an idea, not committed

## A. Today (home screen)

The one place you start every session. Fits the window without scrolling.

- **[v1]** Scenic banner with a time-of-day greeting (おはよう / こんにちは / こんばんは) and the date.
- **[v1]** One **Start** button that runs a whole study session: reviews then lessons, or lessons then reviews (a "Reviews first | Lessons first" toggle, remembered). Its label says what you'll get ("12 reviews, then 10 new").
- **[v1]** "Just 5 minutes": most at-risk reviews only.
- **[v1]** Reviews tile: due now, next 24 hours, a per-hour forecast chart, "all caught up · next review in 3h" when empty.
- **[v1]** Lessons tile: available today, split into kana and kanji-path previews, and why more are waiting (daily limit or review backlog).
- **[v1]** Progress bars per kind (passed / learning / total). No streaks, by design.
- **[later]** Catch-up mode after a break: spreads overdue reviews over several days.
- **[later]** "Text coverage" estimate: % of common written Japanese you'd recognise.

## A2. Kana (hiragana and katakana)

- **[v1]** Separate kana track with its own lesson queue and daily limit (20/day), running alongside the kanji track: 46 basic hiragana → 25 with ゛/゜ → 33 combinations (きゃ) → the same in katakana → 16 extended katakana (ファ, ティ, ヴ…). 224 in total.
- **[v1]** が unlocks after か passes; きゃ after き. Lessons come in rows of five.
- **[v1]** Review: see the kana, type its romaji. Hepburn, other romanisations (si, tu, sya) and sensible extras (を → "o") are accepted.
- **[v1]** Stroke order, the same sound in the other script, mnemonics and Ask AI (shape → sound).
- **[later]** "I already know these" button to skip a group; small っ and long vowel ー explained; kana *writing* practice.

## B. Kanji path (inspired by WaniKani)

- **[v1]** Learning order: components → kanji → vocabulary that uses those kanji. A kanji only unlocks after its components are learned.
- **[v1]** Our own order built from open data: frequency, school grade and JLPT level (Japanese Language Proficiency Test, levels N5 easiest to N1 hardest), respecting component dependencies.
- **[v1]** Lesson screen per item: meaning, readings, components, stroke order, mnemonic(s), vocabulary that uses it.
- **[v1]** Reviews: type the meaning in English, type the reading in Japanese (romaji converts to kana as you type). Accepts reasonable synonyms; you can add your own.
- **[v1]** Mnemonics are editable. Each item keeps a history so you can go back.
- **[later]** "Similar-looking kanji" warnings (e.g. 未 / 末) and a drill for them.
- **[later]** Stroke-order animation.
- **[maybe]** Handwriting practice with stroke checking.

## C. Vocabulary

- **[v1]** Vocabulary unlocked by the kanji path (WaniKani-style).
- **[v1]** Each word shows example sentences, ideally using only words you already know.
- **[later]** Add any word from the dictionary to your reviews (Anki-style).
- **[later]** Pitch accent display.
- **[later]** Audio for words and sentences.

## D. Grammar (inspired by Bunpro)

- **[v1]** Grammar points in a beginner → intermediate order (first 10 N5 points so far).
- **[v1]** Each point: plain explanation, structure pattern, example sentences, links to related points.
- **[later]** Reviews: fill in the blank in a sentence. Low ranks pick from options; higher ranks type it. Sentences come from templates whose slots are filled from words you've learned, so they vary.
- **[later]** Grammar examples prefer vocabulary you've already learned.

## E0. Library

- **[v1]** Browse every path item outside lessons: tiles in path order, styled by status (locked / ready / learning / passed), filter by kind and status, search by character, meaning or reading. Item pages show status, next review, what a locked item is waiting for, and allow editing mnemonics and synonyms.

## E1. Hover popovers

- **[v1]** Hover any kanji in Japanese text (example sentences, word lists) or any component/kanji/word chip or library tile for a popover: meanings, readings, your status. In the library, clicking opens the item; in lessons and reviews it only previews (leaving would end the session).
- **[later]** Hover whole *words* inside sentences (needs a word splitter; see F).

## E2. "Did you know?" trivia

- **[v1 stretch]** Some items carry a short cultural fact that ties the item to something you would meet on a trip to Japan (signs, stations, food, money, etiquette) or in anime and manga (honorifics, common phrases, tropes). It shows as a small "Did you know?" button on the item page and after a review. It opens a popover only when clicked, so it never slows you down.
- Only where it's a quality fit: most items have none. Facts must be accurate and short (one to three sentences), and use the item itself. The rules are in `CLAUDE.md`. Candidates are collected in `docs/trivia-backlog.md`.
- Data: curated by hand in the content build, like the kana example words, into a `trivia` table in content.db (item_key, text, angle: trip | media, source note).
- **[later]** AI-drafted candidates for review, never shown until approved.

## E. Dictionary and lookup

- **[v1]** Search kanji/words by English, kana, romaji or kanji.
- **[later]** Search kanji by components (pick the parts you see).
- **[later]** Paste a Japanese sentence → it's split into words, each with a definition, and you can add any of them to reviews.

## F. Reading and sentence mining (inspired by Anki immersion workflows)

- **[later]** Paste or import text; hover a word to see its definition.
- **[later]** Words you know are visually marked; unknown ones are easy to add.
- **[later]** Save a sentence as a review card.
- **[maybe]** Graded reading passages generated by AI at your level (marked as AI-written).

## G. AI helpers

All optional, all run through your Claude Code login, all marked as AI-generated, none change content without approval.

- **[v1 stretch / first AI feature]** **Mnemonic workshop:** from any kanji or word, open a chat. The AI sees the item's meaning, readings, components and your current mnemonic. You talk through alternatives; one click saves the one you like (previous version kept).
- **[later]** **Explain this:** select a sentence or grammar point and ask "why is it は and not が here?"
- **[later]** **More examples:** generate extra example sentences using words you know.
- **[later]** **Check my answer:** for free-text translation exercises, feedback on what you wrote.
- **[later]** **Draft mnemonics:** generate first-draft mnemonics for kanji that have none yet (we need these, since we can't use WaniKani's).
- **[maybe]** Conversation practice at your level.

## H. Settings and data

- **[v1]** Daily new-item limit and maximum review load.
- **[v1]** Backup: one-click export of your database file.
- **[maybe]** AI settings: model choice per feature. (No API key or spending log: AI runs through Claude Code.)
- **[later]** Import Anki decks.
- **[maybe]** Import your own progress from WaniKani via its API (needs a check of WaniKani's API terms first).
