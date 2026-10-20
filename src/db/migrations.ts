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
