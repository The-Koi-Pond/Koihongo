import type { Db } from "./db.ts";

// user.db schema changes, applied in order. Never edit a migration that has
// shipped; add a new one. PRAGMA user_version records how many have run.
// Times are unix milliseconds. Items are referenced by content.path item_key.
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE srs_cards (
      item_key       TEXT NOT NULL,
      card_type      TEXT NOT NULL CHECK (card_type IN ('meaning', 'reading')),
      state          INTEGER NOT NULL,  -- ts-fsrs State: 0 new, 1 learning, 2 review, 3 relearning
      due            INTEGER NOT NULL,
      stability      REAL NOT NULL,     -- days until recall chance drops to 90%
      difficulty     REAL NOT NULL,
      scheduled_days INTEGER NOT NULL,
      learning_steps INTEGER NOT NULL,
      reps           INTEGER NOT NULL,
      lapses         INTEGER NOT NULL,
      last_review    INTEGER,
      started_at     INTEGER NOT NULL,  -- when the lesson was done
      PRIMARY KEY (item_key, card_type)
    )`,
    `CREATE INDEX srs_cards_by_due ON srs_cards(due)`,
    // Every answer, kept so the scheduler can later be tuned to your memory.
    `CREATE TABLE review_log (
      id           INTEGER PRIMARY KEY,
      item_key     TEXT NOT NULL,
      card_type    TEXT NOT NULL,
      rating       INTEGER NOT NULL,  -- ts-fsrs Rating: 1 again (wrong), 3 good (right)
      answer       TEXT NOT NULL,
      state_before INTEGER NOT NULL,
      due_before   INTEGER NOT NULL,
      reviewed_at  INTEGER NOT NULL
    )`,
    `CREATE INDEX review_log_by_item ON review_log(item_key, card_type)`,
    // Every version is kept; the current one is the newest per item and kind.
    `CREATE TABLE notes (
      id         INTEGER PRIMARY KEY,
      item_key   TEXT NOT NULL,
      kind       TEXT NOT NULL CHECK (kind IN ('mnemonic_meaning', 'mnemonic_reading', 'note')),
      text       TEXT NOT NULL,
      author     TEXT NOT NULL CHECK (author IN ('you', 'ai', 'ai_edited')),
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX notes_by_item ON notes(item_key, kind)`,
    // Extra meanings you want accepted as correct.
    `CREATE TABLE synonyms (
      item_key   TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (item_key, text)
    )`,
  ],
  [
    // Your settings, e.g. "pacing.newPerDay" → "10" (see src/srs/settings.ts).
    `CREATE TABLE settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
  [
    // Items on fast track: right answers count as Easy (see src/srs/fastTrack.ts).
    `CREATE TABLE fast_track (
      item_key TEXT PRIMARY KEY,
      since    INTEGER NOT NULL
    )`,
  ],
  [
    // Your own flashcard decks (see src/decks.ts). in_daily: its due cards join daily reviews.
    `CREATE TABLE decks (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      in_daily   INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
    // A card: free text front and back, and its own FSRS state (same columns as srs_cards).
    // item_key is set when it was made from a dictionary item (the text is a copy).
    `CREATE TABLE deck_cards (
      id             INTEGER PRIMARY KEY,
      deck_id        INTEGER NOT NULL,
      front          TEXT NOT NULL,
      back           TEXT NOT NULL,
      item_key       TEXT,
      created_at     INTEGER NOT NULL,
      state          INTEGER NOT NULL,
      due            INTEGER NOT NULL,
      stability      REAL NOT NULL,
      difficulty     REAL NOT NULL,
      scheduled_days INTEGER NOT NULL,
      learning_steps INTEGER NOT NULL,
      reps           INTEGER NOT NULL,
      lapses         INTEGER NOT NULL,
      last_review    INTEGER
    )`,
    `CREATE INDEX deck_cards_by_deck ON deck_cards(deck_id)`,
    `CREATE INDEX deck_cards_by_due ON deck_cards(due)`,
    // Every flip-and-rate answer (ts-fsrs Rating: 1 again, 2 hard, 3 good, 4 easy).
    `CREATE TABLE deck_review_log (
      id           INTEGER PRIMARY KEY,
      card_id      INTEGER NOT NULL,
      rating       INTEGER NOT NULL,
      state_before INTEGER NOT NULL,
      due_before   INTEGER NOT NULL,
      reviewed_at  INTEGER NOT NULL
    )`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Brings user.db up to the latest schema. Safe to call on every start. */
export async function migrate(db: Db): Promise<void> {
  const [{ user_version }] = await db.all<{ user_version: number }>("PRAGMA user_version");
  if (user_version > SCHEMA_VERSION) {
    throw new Error(`user.db is from a newer app version (schema ${user_version}, this app knows ${SCHEMA_VERSION})`);
  }
  for (let v = user_version; v < SCHEMA_VERSION; v++) {
    await db.batch([...MIGRATIONS[v].map((sql) => ({ sql })), { sql: `PRAGMA user_version = ${v + 1}` }]);
  }
}

// Dev only: the app migrates once at start, so a live code update that adds a
// migration must reload the whole page, or new code meets the old schema.
// (Typed loosely: Node tests import this file too, where there's no Vite.)
const hot = (import.meta as { hot?: { accept(cb: () => void): void; invalidate(): void } }).hot;
hot?.accept(() => hot.invalidate());
