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
  [
    // Cards started with "I already know these" / "I know all 5" (startAsKnown):
    // they don't use up the day's lessons, and until their first review they
    // don't slow lessons down either.
    `ALTER TABLE srs_cards ADD COLUMN started_known INTEGER NOT NULL DEFAULT 0`,
  ],
  [
    // Reading (see src/reading.ts): your own manga, read from where it is on your PC.
    // page/pages: where you are, and how many pages it had when last opened.
    // about: your notes on the book (setting, genre, who's who) for Deki-senpai.
    `CREATE TABLE books (
      id            INTEGER PRIMARY KEY,
      title         TEXT NOT NULL,
      path          TEXT NOT NULL UNIQUE,
      kind          TEXT NOT NULL,
      pages         INTEGER NOT NULL,
      page          INTEGER NOT NULL DEFAULT 0,
      right_to_left INTEGER NOT NULL DEFAULT 1,
      about         TEXT NOT NULL DEFAULT '',
      added_at      INTEGER NOT NULL,
      opened_at     INTEGER
    )`,
    // What you marked on a page: a box (x, y, w, h as fractions of the page)
    // and what's in it. page is the page's file name, so marks stay put if
    // pages are added. text_key: the text normalised, for "seen before".
    `CREATE TABLE book_marks (
      id         INTEGER PRIMARY KEY,
      book_id    INTEGER NOT NULL,
      page       TEXT NOT NULL,
      kind       TEXT NOT NULL,
      x          REAL NOT NULL,
      y          REAL NOT NULL,
      w          REAL NOT NULL,
      h          REAL NOT NULL,
      text       TEXT NOT NULL DEFAULT '',
      text_key   TEXT NOT NULL DEFAULT '',
      reading    TEXT NOT NULL DEFAULT '',
      meaning    TEXT NOT NULL DEFAULT '',
      notes      TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX book_marks_by_page ON book_marks(book_id, page)`,
    `CREATE INDEX book_marks_by_text ON book_marks(text_key)`,
  ],
  [
    // A series on your bookshelf, holding its chapters (books.series_id; null:
    // on the shelf by itself). Only an arrangement: no files move.
    `CREATE TABLE series (
      id         INTEGER PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `ALTER TABLE books ADD COLUMN series_id INTEGER`,
  ],
  [
    // What you know about a series, sent as context with AI translation
    // requests (see readingContext in src/reading.ts).
    `ALTER TABLE series ADD COLUMN japanese_title TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE series ADD COLUMN synopsis TEXT NOT NULL DEFAULT ''`,
    // Its English titles (official, fan translations…), as many as you like.
    `CREATE TABLE series_titles (
      id        INTEGER PRIMARY KEY,
      series_id INTEGER NOT NULL,
      title     TEXT NOT NULL
    )`,
    // Your own boxes: Cast, Genre, Setting… (label and text).
    `CREATE TABLE series_boxes (
      id        INTEGER PRIMARY KEY,
      series_id INTEGER NOT NULL,
      label     TEXT NOT NULL,
      text      TEXT NOT NULL DEFAULT ''
    )`,
  ],
  [
    // A cover you picked for a series: its copy's file name in
    // Documents\Koihongo\Covers (null: the first chapter's first page).
    `ALTER TABLE series ADD COLUMN cover TEXT`,
  ],
  [
    // The series' name is its title now; a Japanese title you'd typed in
    // separately becomes one of its "also known as" names (the column stays, unused).
    `INSERT INTO series_titles (series_id, title) SELECT id, trim(japanese_title) FROM series WHERE trim(japanese_title) != ''`,
    `UPDATE series SET japanese_title = ''`,
  ],
  [
    // A series' genres, as tags (comma-separated), a field of their own under
    // the synopsis; any "Genre" box you'd made moves into it.
    `ALTER TABLE series ADD COLUMN genres TEXT NOT NULL DEFAULT ''`,
    `UPDATE series SET genres = coalesce((SELECT group_concat(trim(b.text), ', ') FROM series_boxes b
       WHERE b.series_id = series.id AND lower(trim(b.label)) = 'genre' AND trim(b.text) != ''), '')`,
    `DELETE FROM series_boxes WHERE lower(trim(label)) = 'genre'`,
  ],
  [
    // Parts of a series' info you chose not to send to Deki-senpai: a JSON
    // list of keys ("synopsis", "box:3"…; see contextKeys in src/reading.ts).
    `ALTER TABLE series ADD COLUMN context_off TEXT NOT NULL DEFAULT '[]'`,
  ],
  [
    // A series' bookmark: a chapter (book) and its page (file name), plus the
    // page's number when bookmarked, to show ("CH.3 · p.12").
    `ALTER TABLE series ADD COLUMN bookmark_book INTEGER`,
    `ALTER TABLE series ADD COLUMN bookmark_page TEXT`,
    `ALTER TABLE series ADD COLUMN bookmark_page_no INTEGER`,
  ],
  [
    // Categories on the bookshelf (Manga, Light novels…), as tabs. A series has
    // one, and so does a book on the shelf by itself (a chapter in a series
    // goes by its series'). NULL: uncategorised. Everything so far is manga.
    `CREATE TABLE categories (
      id       INTEGER PRIMARY KEY,
      name     TEXT NOT NULL,
      position INTEGER NOT NULL
    )`,
    `INSERT INTO categories (id, name, position) VALUES (1, 'Manga', 0)`,
    `ALTER TABLE series ADD COLUMN category_id INTEGER`,
    `ALTER TABLE books ADD COLUMN category_id INTEGER`,
    `UPDATE series SET category_id = 1`,
    `UPDATE books SET category_id = 1 WHERE series_id IS NULL`,
  ],
  [
    // Marks keep the order you drag them into (within their kind's section of
    // the page's list). Until now they went in the order made, as ids do.
    `ALTER TABLE book_marks ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
    `UPDATE book_marks SET position = id`,
  ],
  [
    // More boxes for one mark: a speech bubble in two parts is one mark. JSON
    // Box[] beyond its first box (x, y, w, h).
    `ALTER TABLE book_marks ADD COLUMN more_boxes TEXT NOT NULL DEFAULT '[]'`,
  ],
  [
    // 1: its text was read by the text reader, which wasn't sure; cleared once you
    // change the text or say it looks right.
    `ALTER TABLE book_marks ADD COLUMN unsure INTEGER NOT NULL DEFAULT 0`,
  ],
  [
    // A picture on a deck card (a JPEG data: URL): the panel a word came from
    // in your manga (Reading: word help → Add to deck).
    `ALTER TABLE deck_cards ADD COLUMN image TEXT`,
  ],
  [
    // Scroll mode (pages stacked top to bottom, for manhwa and webtoons): set
    // for a whole series, or for a book on the shelf by itself: 0 follows the
    // category (on for Manhwa), 1 on, 2 off. And a Manhwa category, unless
    // you've made one already.
    `ALTER TABLE series ADD COLUMN scroll INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE books ADD COLUMN scroll INTEGER NOT NULL DEFAULT 0`,
    `INSERT INTO categories (name, position)
     SELECT 'Manhwa', (SELECT coalesce(max(position), -1) + 1 FROM categories)
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE lower(name) = 'manhwa')`,
  ],
  [
    // Deki-senpai's kept chats (src/deki/deki.ts): one per chapter or series
    // you chose to keep a chat for, and its messages.
    `CREATE TABLE deki_threads (
      id         INTEGER PRIMARY KEY,
      scope      TEXT NOT NULL,
      scope_id   INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (scope, scope_id)
    )`,
    `CREATE TABLE deki_messages (
      id         INTEGER PRIMARY KEY,
      thread_id  INTEGER NOT NULL,
      role       TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX deki_messages_by_thread ON deki_messages(thread_id)`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Brings user.db up to the latest schema (or to `target`, for tests of
 * upgrading old files). Safe to call on every start.
 */
export async function migrate(db: Db, target = SCHEMA_VERSION): Promise<void> {
  const [{ user_version }] = await db.all<{ user_version: number }>("PRAGMA user_version");
  if (user_version > SCHEMA_VERSION) {
    throw new Error(`user.db is from a newer app version (schema ${user_version}, this app knows ${SCHEMA_VERSION})`);
  }
  for (let v = user_version; v < target; v++) {
    await db.batch([...MIGRATIONS[v].map((sql) => ({ sql })), { sql: `PRAGMA user_version = ${v + 1}` }]);
  }
}

// Dev only: the app migrates once at start, so a live code update that adds a
// migration must reload the whole page, or new code meets the old schema.
// (Typed loosely: Node tests import this file too, where there's no Vite.)
const hot = (import.meta as { hot?: { accept(cb: () => void): void; invalidate(): void } }).hot;
hot?.accept(() => hot.invalidate());
