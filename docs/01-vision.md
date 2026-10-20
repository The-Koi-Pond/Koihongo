# 01 — Vision

## The problem

The good Japanese resources are spread across separate apps that don't know about each other:

- **WaniKani** teaches kanji well (components → kanji → vocabulary, with mnemonics) but is fixed: you can't change its order, and its mnemonics are only partly editable.
- **Anki** is endlessly flexible, but you have to build or find decks yourself, and a backlog of reviews piles up fast.
- **Bunpro** drills grammar, but separately from the kanji and vocabulary you're learning.

Switching between them is friction, and friction is why people quit. Anki and Bunpro were already hard to stick with.

## The goal

One desktop app where:

1. Everything is **linked**. A kanji shows the words that use it; a word shows the grammar and sentences it appears in; a grammar point shows examples built from vocabulary you already know.
2. There is a **single daily session**, not three apps with three review piles.
3. **You own the content.** Every mnemonic, note and example can be edited, and AI can help you rewrite it.
4. It follows a **curated path** by default (no deck-building), but you can change the path.

## Who it's for

One user first: a beginner (knows kana, early kanji and grammar) who has found existing SRS apps hard to keep using. Making it work for other people is not a goal for now.

## Design rules

These rules settle arguments later. If a feature breaks one, the feature changes.

### Make it easy to stick with (most important)

People drop SRS apps for predictable reasons. Each rule below answers one of them.

| Why people quit | Rule |
|---|---|
| The review pile grows out of control after a missed day | **New items slow down automatically when the backlog grows.** A catch-up mode spreads overdue reviews over several days instead of showing 300 at once. No streak counters that punish a missed day. |
| Sessions feel too long to start | **Any session can be short.** A "5 minutes" button does the most important reviews and stops. Stopping partway never loses progress. |
| Cards feel random and out of context | **Every item links to related items** (see goal 1). Vocabulary comes with sentences. |
| Setup before you can study | **It works the first time you open it.** A built-in starting path, no deck imports needed. |
| Hard to see progress | **Progress you can see:** kanji learned, words you can read, % of common text you'd recognise. |
| Bad mnemonic or confusing explanation, no way to fix it | **Everything is editable**, with AI help (see below). |

### Other rules

- **Works offline.** AI features are extras. With no internet or no Claude login, everything else still works.
- **AI suggests, you decide.** AI never changes your content without you approving it. Anything AI wrote is marked as such, because AI can be wrong, especially about Japanese nuance.
- **Your data stays on your PC** in one file you can back up.
- **Borrow methods, not content.** We can copy *how* WaniKani or Bunpro teach, but not their copyrighted text, mnemonics or lesson order. Content comes from openly licensed sources or is written by you or the AI (details in [03-architecture.md](03-architecture.md#content-sources-and-licenses)).
- **Use it while building it.** Each phase must be usable for daily study before the next one starts. A smaller app you use beats a large one you don't.

## Non-goals (for now)

- Mobile app or syncing between devices.
- Multiple users, accounts, social features.
- Replacing native media. The app supports reading and listening to real material; it doesn't try to be Netflix.
