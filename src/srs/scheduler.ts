// Review scheduling with FSRS (via ts-fsrs). Pure functions over card rows (srs_cards and deck_cards).

import { createEmptyCard, fsrs, Rating, type Card, type Grade, type State } from "ts-fsrs";

export { Rating };

export type CardType = "meaning" | "reading";

/** The FSRS state of any review card (path cards in srs_cards, deck cards in deck_cards). Times are unix milliseconds. */
export type FsrsFields = {
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review: number | null;
};

/** A row of user.db srs_cards. Times are unix milliseconds. */
export type CardRow = FsrsFields & {
  item_key: string;
  card_type: CardType;
  started_at: number;
};

/**
 * An item counts as learned, unlocking whatever needs it, once every card of
 * it is expected to stay remembered this many days. In practice that's two
 * correct reviews about three days apart, similar to WaniKani's "Guru".
 */
export const PASS_STABILITY_DAYS = 3;

/** The first review comes this long after the lesson, so it tests memory, not what was just on screen. */
export const FIRST_REVIEW_DELAY_MS = 4 * 60 * 60 * 1000;

// Day-based intervals only (no 10-minute learning steps): built for one study
// session a day. Fuzz spreads out items learned together so they don't stay clumped.
const scheduler = fsrs({ request_retention: 0.9, enable_short_term: false, enable_fuzz: true });

function toCard(row: FsrsFields): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0, // deprecated in ts-fsrs; it uses last_review instead
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review === null ? undefined : new Date(row.last_review),
  };
}

/** A brand-new card's FSRS state, first due at `due`. */
export function emptyFsrs(now: number, due: number): FsrsFields {
  const card = createEmptyCard(new Date(now));
  return {
    state: card.state,
    due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: null,
  };
}

export function newCard(itemKey: string, cardType: CardType, now: number): CardRow {
  return { item_key: itemKey, card_type: cardType, ...emptyFsrs(now, now + FIRST_REVIEW_DELAY_MS), started_at: now };
}

/** The card after a review graded `rating` (Again, Hard, Good or Easy). */
export function schedule<T extends FsrsFields>(row: T, rating: Grade, now: number): T {
  const { card } = scheduler.next(toCard(row), new Date(now), rating);
  return {
    ...row,
    state: card.state,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: now,
  };
}

/** When the card would next be due after each rating, for showing under the rating buttons. */
export function nextDues(row: FsrsFields, now: number): Record<Grade, number> {
  const grades: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
  return Object.fromEntries(grades.map((g) => [g, schedule(row, g, now).due])) as Record<Grade, number>;
}

/**
 * Typed answers are simply right or wrong: Good or Again. Items on fast track
 * (`easy`) get Easy for a right answer instead.
 */
export function review(row: CardRow, correct: boolean, now: number, easy = false): { card: CardRow; rating: Rating } {
  const rating = correct ? (easy ? Rating.Easy : Rating.Good) : Rating.Again;
  return { rating, card: schedule(row, rating, now) };
}

/** Estimated chance (0–1) of remembering the card right now. */
export function retrievability(row: FsrsFields, now: number): number {
  return scheduler.get_retrievability(toCard(row), new Date(now), false);
}
