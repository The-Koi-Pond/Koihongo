// Your progress: which lessons are available, what's due, recording answers.

import type { Db, Statement } from "../db/db.ts";
import { newCard, PASS_STABILITY_DAYS, retrievability, review, type CardRow, type CardType } from "./scheduler.ts";
import { DAY_STARTS_AT_HOUR, KANA_PER_DAY, LESSON_WINDOW, NEW_PER_DAY, PAUSE_LESSONS_AT_DUE } from "./settings.ts";

export type ItemKind = "kana" | "component" | "kanji" | "word";

/** kana: hiragana/katakana. main: components → kanji → words. Each has its own lesson queue and daily limit. */
export type Track = "kana" | "main";

export type Lesson = { item_key: string; kind: ItemKind; track: Track; position: number; label: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kana are learned by reading, components by meaning, kanji and words by both. */
export function cardTypesFor(kind: ItemKind): CardType[] {
  if (kind === "kana") return ["reading"];
  return kind === "component" ? ["meaning"] : ["meaning", "reading"];
}

/** Start of the current study day (local time, 4 am rollover). */
export function studyDayStart(now: number): number {
  const d = new Date(now);
  if (d.getHours() < DAY_STARTS_AT_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(DAY_STARTS_AT_HOUR, 0, 0, 0);
  return d.getTime();
}

/** How many more lessons today: fewer as due reviews pile up, none at PAUSE_LESSONS_AT_DUE. */
export function lessonAllowance(dueReviews: number, lessonsDoneToday: number, perDay = NEW_PER_DAY): number {
  const scale = Math.min(1, Math.max(0, 1 - dueReviews / PAUSE_LESSONS_AT_DUE));
  return Math.max(0, Math.floor(perDay * scale) - lessonsDoneToday);
}

/**
 * Items you can start now, in path order: not started yet, everything they
 * require is passed, and within `window` positions of the first unstarted
 * item on the same track.
 */
export async function availableLessons(db: Db, limit = 2 * LESSON_WINDOW, window = LESSON_WINDOW): Promise<Lesson[]> {
  return db.all<Lesson>(
    `WITH started AS (SELECT DISTINCT item_key FROM srs_cards),
          passed AS (SELECT item_key FROM srs_cards GROUP BY item_key HAVING min(stability) >= ?),
          frontier AS (SELECT track, min(position) AS pos FROM content.path
                       WHERE item_key NOT IN (SELECT item_key FROM started) GROUP BY track)
     SELECT p.item_key, p.kind, p.track, p.position, coalesce(ka.character, c.display, k.character, w.written) AS label
     FROM content.path p
     JOIN frontier ON frontier.track = p.track
     LEFT JOIN content.kana ka ON p.kind = 'kana' AND ka.character = substr(p.item_key, 6)
     LEFT JOIN content.components c ON p.kind = 'component' AND c.glyph = substr(p.item_key, 11)
     LEFT JOIN content.kanji k ON p.kind = 'kanji' AND k.character = substr(p.item_key, 7)
     LEFT JOIN content.words w ON p.kind = 'word' AND w.id = substr(p.item_key, 6)
     WHERE p.position < frontier.pos + ?
       AND p.item_key NOT IN (SELECT item_key FROM started)
       AND NOT EXISTS (
         SELECT 1 FROM content.path_requirements r
         WHERE r.item_key = p.item_key AND r.requires_key NOT IN (SELECT item_key FROM passed)
       )
     ORDER BY p.position
     LIMIT ?`,
    [PASS_STABILITY_DAYS, window, limit],
  );
}

/** Creates review cards for finished lessons. Starting an item twice does nothing. */
export async function startLessons(db: Db, lessons: Pick<Lesson, "item_key" | "kind">[], now: number): Promise<void> {
  const cards = lessons.flatMap((l) => cardTypesFor(l.kind).map((t) => newCard(l.item_key, t, now)));
  await db.batch(
    cards.map((c): Statement => ({
      sql: `INSERT OR IGNORE INTO srs_cards
            (item_key, card_type, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, last_review, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [c.item_key, c.card_type, c.state, c.due, c.stability, c.difficulty, c.scheduled_days, c.learning_steps, c.reps, c.lapses, c.last_review, c.started_at],
    })),
  );
}

/** Cards due now, most likely to be forgotten first. */
export async function dueCards(db: Db, now: number): Promise<CardRow[]> {
  const rows = await db.all<CardRow>("SELECT * FROM srs_cards WHERE due <= ?", [now]);
  return rows
    .map((row) => ({ row, r: retrievability(row, now) }))
    .sort((a, b) => a.r - b.r || a.row.due - b.row.due)
    .map((x) => x.row);
}

/** Schedules the card's next review from a right/wrong answer and logs it. */
export async function recordReview(
  db: Db,
  itemKey: string,
  cardType: CardType,
  correct: boolean,
  answer: string,
  now: number,
): Promise<CardRow> {
  const [row] = await db.all<CardRow>("SELECT * FROM srs_cards WHERE item_key = ? AND card_type = ?", [itemKey, cardType]);
  if (!row) throw new Error(`No review card for ${itemKey} (${cardType})`);
  const { card, rating } = review(row, correct, now);
  await db.batch([
    {
      sql: `UPDATE srs_cards SET state = ?, due = ?, stability = ?, difficulty = ?, scheduled_days = ?,
            learning_steps = ?, reps = ?, lapses = ?, last_review = ? WHERE item_key = ? AND card_type = ?`,
      params: [card.state, card.due, card.stability, card.difficulty, card.scheduled_days, card.learning_steps, card.reps, card.lapses, card.last_review, itemKey, cardType],
    },
    {
      sql: `INSERT INTO review_log (item_key, card_type, rating, answer, state_before, due_before, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [itemKey, cardType, rating, answer, row.state, row.due, now],
    },
  ]);
  return card;
}

export type TodaySummary = {
  reviewsDue: number;
  reviewsNext24h: number;
  lessonsDoneToday: number;
  /** Lessons you may still do today (after the backlog throttle). */
  lessons: Lesson[];
  /** Unlocked lessons held back by the daily limit or the review backlog. */
  lessonsWaiting: number;
};

export async function todaySummary(db: Db, now: number): Promise<TodaySummary> {
  const [counts] = await db.all<{ due: number; next_day: number; kana_today: number; main_today: number }>(
    `SELECT
       (SELECT count(*) FROM srs_cards WHERE due <= ?) AS due,
       (SELECT count(*) FROM srs_cards WHERE due > ? AND due <= ?) AS next_day,
       (SELECT count(DISTINCT item_key) FROM srs_cards WHERE started_at >= ? AND item_key LIKE 'kana:%') AS kana_today,
       (SELECT count(DISTINCT item_key) FROM srs_cards WHERE started_at >= ? AND item_key NOT LIKE 'kana:%') AS main_today`,
    [now, now, now + DAY_MS, studyDayStart(now), studyDayStart(now)],
  );
  const unlocked = await availableLessons(db);
  // Kana first, so a lesson round doesn't mix a kana row with kanji.
  const pick = (track: Track, allowed: number) => {
    const all = unlocked.filter((l) => l.track === track);
    return { lessons: all.slice(0, allowed), waiting: Math.max(0, all.length - allowed) };
  };
  const kana = pick("kana", lessonAllowance(counts.due, counts.kana_today, KANA_PER_DAY));
  const main = pick("main", lessonAllowance(counts.due, counts.main_today, NEW_PER_DAY));
  return {
    reviewsDue: counts.due,
    reviewsNext24h: counts.next_day,
    lessonsDoneToday: counts.kana_today + counts.main_today,
    lessons: [...kana.lessons, ...main.lessons],
    lessonsWaiting: kana.waiting + main.waiting,
  };
}
