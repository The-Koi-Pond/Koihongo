# Koihongo: guide for agents

Koihongo is Xel's personal Windows desktop app for learning Japanese from zero: WaniKani's components → kanji → words path, Anki-style FSRS reviews, Bunpro-style grammar later, plus optional AI help through the Claude Code CLI. The internal identifier is still `com.xel.nihongo` (the folder is `nihongo`) so `user.db` stays put.

## Working with Xel

- Xel (they/them) is a beginner learner and a hands-on vibe-coder. Claude writes and explains the code; Xel test-drives in the app and gives feedback, often from screenshots.
- Explain changes in plain words, keep reports short, and say what was and wasn't checked (preview vs. the real app window).
- Design docs: `docs/01-vision.md` (design rules: above all, easy to stick with), `02-features.md`, `03-architecture.md`, `04-roadmap.md`. Read the relevant one before changing a feature, and tick the roadmap when something ships.
- Copy methods, never content, from WaniKani or Bunpro. Dataset licences are listed in `03-architecture.md` and credited in the app (Settings → Sources).

## Where things are

| Path | What |
|---|---|
| `src/screens/` | Today, Lessons, Reviews, Library, Dictionary, Settings, Sources, ComingSoon (grammar, reading) |
| `src/ui/` | Shared UI: ItemView/ItemInfo (item pages), QuestionCard (quiz), Scene (banner scenery), AiChat, Examples, InfoTip… |
| `src/srs/` | Scheduling (FSRS via ts-fsrs), sessions, answer checking, pacing settings |
| `src/items.ts`, `library.ts`, `dictionary.ts`, `backup.ts` | Item details, statuses, dictionary search, backups |
| `src/ai/` | Claude CLI backend and all prompts (`prompts.ts`) |
| `src/App.css` | All styles; theme tokens on `:root` at the top |
| `src-tauri/src/` | Rust: `db.rs` (SQL bridge), `ai.rs` (Claude CLI), `backup.rs` |
| `scripts/content/` | Content build: datasets → `src-tauri/resources/content.db` (schema in `schema.sql`) |
| `scripts/content/mnemonics/` | Koihongo's default mnemonics, one file per batch, registered in `index.ts` |
| `tests/` | Node tests (`tests/nodeDb.ts` mirrors the Rust DB setup) |

Data: `content.db` is generated and gitignored. `user.db` (progress, notes, settings) lives in `%APPDATA%\com.xel.nihongo\`, and is backed up daily to `Documents\Koihongo\Backups`.

## Commands

```
pnpm tauri dev          # run the app (live reload for src/; Rust changes rebuild automatically)
pnpm test               # all Node tests
pnpm typecheck          # TypeScript, app and scripts
cd src-tauri && cargo test
pnpm content:build      # rebuild content.db (~10 s; datasets cached in data/raw/)
pnpm mnemonics:kanji 151 50   # list the next kanji to write mnemonics for
```

After `pnpm content:build`, restart the app: content.db is attached when it starts.

## Checking UI changes

Use **browser mode** with the Playwright tools: while `pnpm tauri dev` runs, open http://localhost:1420 and click through the real app with real data.

- `src/dev/browserBridge.ts` stands in for Tauri's bridge when there's no Tauri window, in dev builds only. It sends calls to the dev server.
- `scripts/dev/browser-mode.ts` answers them like `src-tauri` does, using a fresh copy of Xel's `user.db`, made per dev-server start, with `content.db` attached. Lessons and reviews you do there never touch real progress.
- Backups and AI calls only work in the desktop app. In browser mode the startup auto-backup logs a harmless warning.
- Test at the real window size (`browser_resize`, for example 1100×760). Hover states, animations and layout shifts can all be checked; use `browser_wait_for` before screenshotting.
- For visual tuning with Xel, prefer a **playground** (the playground skill): the real component with sliders, so Xel picks values directly instead of describing them.
- Only screenshot the browser or the app, never the desktop.

## Conventions

- **Git:** commit locally with a clear message, ending with the `Co-Authored-By` trailer. Never push, publish, or open issues or PRs unless Xel asks. The repo has Xel's identity in its local git config.
- **Visual style, "Starry night":**
  - twilight indigo with pastel pink, cyan and butter glows, pixel fonts, glowing panels;
  - colours come from tokens on `:root`, and each kind has its own: kana pink, component cyan, kanji purple, word butter;
  - scenery frames the hero (the Start button, the big character) and never sits behind it;
  - no city or skyline elements.
- **Fonts:** Pixelify Sans (`--font-pixel`) for headings and labels, but its digits misread (150 looks like 180) and so does capital C. Numbers use **Tiny5** (`--font-num`, picked by Xel in a playground), so far on Today: the Start count, card numbers, progress counts and the clock. Other screens still use M PLUS Rounded (`--font-body`) for numbers; switch them to `--font-num` as they get reworked. Buttons like Check stay in the rounded font. Panel titles (`.tile-title`) use **Silkscreen Bold** (`--font-title`, also picked in a playground): 24px uppercase, pale grey with a solid block shadow one font pixel down. Silkscreen and Tiny5 are drawn on an 8px grid, so use sizes in multiples of 8 and shadow offsets in whole font pixels (size ÷ 8).
- **Layout:** answering, opening details and similar actions must not shift the page.
- **Editing strings with backslashes or `\t`:** use the Edit tool. Shell heredocs and `node -e` mangle them.

## Status (2026-10-21)

- Phases 0–3 of the roadmap are done:
  - lessons and reviews, catch-up mode, Settings (pacing), daily backups with restore;
  - dictionary search, example sentences ranked by known words, "Explain this sentence" AI.
- **Levels:** 267 game-style levels of about 8 kanji, grouped into approximate JLPT regions (N5 13, N4 23, N3 46, N2 46, N1 139).
  - Built by `scripts/content/levels.ts`; your status comes from `src/levels.ts`; the card is `src/ui/LevelCard.tsx`.
  - A level clears when all but one of its kanji have passed. Levels are display only and never lock lessons.
  - The "LEVEL UP!" overlay shows once per new level, tracked by the `progress.seenLevel` setting.
- **Ranks** (`src/srs/ranks.ts`), per item, from the weakest card's FSRS stability:
  - B = passed (3 days), A = learned (30 days), S = mastered (180 days), ★ = burned (2 years).
  - ★ items keep rare reviews; they're never retired. Forgetting drops the rank quietly.
  - Shown as a "RANK UP!" flourish in reviews (predicted at grading time with the same scheduler step), chips on Library tiles and item pages, and a tally on Today.
- **Fast track** (`src/srs/fastTrack.ts`, user.db `fast_track`): right answers on a flagged item are rated Easy instead of Good, so it passes on its first review and needs about a third fewer reviews.
  - Switched on via "I already know this" on lesson pages, "Too easy" after a right review answer, or the toggle on item pages.
  - One wrong answer switches it off quietly. Library tiles show a small marker.
- The roadmap says to use the app daily for a while before phase 4 (grammar).
- **Default mnemonics** (`scripts/content/mnemonics/`):
  - every kana and every component is done;
  - kanji are done up to #150 of 2,136 (`kanji-1.ts` … `kanji-3.ts`). Continue with `kanji-4.ts` from #151, 50 per batch, adding each batch to `BATCHES` in `index.ts`.
- **Open ideas:**
  - 399 path words have no example sentence (possibly AI-drafted, marked AI);
  - the "Did you know?" popovers (feature E2);
  - audio;
  - colour-blind-safe kind colours;
  - a subtle home for the arrow-key hint in lessons.

## Writing mnemonics

- **Kana:** link the shape to the sound, with the sound in CAPITALS: (KA). Katakana reuse their hiragana's image where the shapes match. Combos and dakuten state their rule.
- **Components:** link the shape to the component's name (as stored in `components.name`) in CAPITALS.
- **Kanji meaning:** a short story built only from the kanji's component names, with the meaning in CAPITALS. A kanji that is a single component says so.
- **Kanji reading:** a *note*, not a story (the UI calls it "Reading note"). Either name a sound part that predicts the reading, with other kanji that share it (語 ← 五, 主 → 注 柱 駐), or point to common words, preferring words on the path. Skip it if neither helps.
- **Facts:** only claim what's solid. Keep stories clearly stories ("a farmhouse where the pig sleeps indoors", not "in old farmhouses…"). Proofread every batch before committing.
- Keys are path item keys: `kana:か`, `component:<KRADFILE glyph>` (sometimes a stand-in, like `刈` for 刂), `kanji:日`. The build fails on unknown keys or duplicates.

## Standing directive: "Did you know?" trivia

While working on content or any item-facing screen, watch for chances to add a **"Did you know?"** fact to an item. The learner opens it optionally. Its job is to tie the item to Japanese culture in a way that helps it stick.

- **Quality over coverage.** Most items get none.
- **Focus:** things you'd meet on a trip to Japan (signs, stations, shops, food, money, etiquette), and things from anime, manga and games (honorifics, common phrases, recurring tropes).
- **Accurate or nothing.** Never invent or embellish. Label folk etymologies as such.
- **One to three sentences,** plain English, with Japanese written as it actually appears (出口 on a station sign).
- **Tied to the item itself,** not just the general topic. Media references describe tropes and never quote copyrighted material.

Until feature E2 (`docs/02-features.md`) is built, add candidates to `docs/trivia-backlog.md` and mention new ones in your final report.
