// Study pacing: your numbers live in user.db (`settings`), with these defaults.

import type { Db } from "../db/db.ts";

export type Pacing = {
  /** New lessons per study day on the main track (components, kanji and words each count as one). */
  newPerDay: number;
  /** New kana per study day, on top of newPerDay: kana are quick, so four rows a day. */
  kanaPerDay: number;
  /**
   * Lessons shrink as reviews pile up, reaching zero at this many due reviews,
   * so a missed day can't snowball into an impossible backlog.
   */
  pauseLessonsAtDue: number;
  /**
   * Catch-up: when more reviews are due than this (after a break, say), you get
   * this many a day, most at risk first, instead of the whole pile at once.
   */
  catchUpPerDay: number;
  /** A study day runs from this hour to the same hour next day, so a late-night session counts as "today". */
  dayStartsAtHour: number;
};

export const DEFAULT_PACING: Pacing = { newPerDay: 10, kanaPerDay: 20, pauseLessonsAtDue: 100, catchUpPerDay: 150, dayStartsAtHour: 4 };

/** Allowed range for each number (the Settings screen and savePacing both use these). */
export const PACING_LIMITS: Record<keyof Pacing, { min: number; max: number }> = {
  newPerDay: { min: 0, max: 50 },
  kanaPerDay: { min: 0, max: 60 },
  pauseLessonsAtDue: { min: 20, max: 1000 },
  catchUpPerDay: { min: 30, max: 2000 },
  dayStartsAtHour: { min: 0, max: 12 },
};

/**
 * Lessons are offered from the next this-many path positions only, so the path
 * order is roughly kept and you can't start 200 components before any kanji.
 */
export const LESSON_WINDOW = 40;

const KEYS = Object.keys(DEFAULT_PACING) as (keyof Pacing)[];

/** Your pacing, with defaults for anything you haven't changed (or a value that's no longer valid). */
export async function loadPacing(db: Db): Promise<Pacing> {
  const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key LIKE 'pacing.%'");
  const pacing = { ...DEFAULT_PACING };
  for (const { key, value } of rows) {
    const name = key.slice("pacing.".length) as keyof Pacing;
    const n = Number(value);
    if (KEYS.includes(name) && isValid(name, n)) pacing[name] = n;
  }
  return pacing;
}

export async function savePacing(db: Db, pacing: Pacing): Promise<void> {
  for (const key of KEYS) {
    if (!isValid(key, pacing[key])) throw new Error(`${key} must be a whole number from ${PACING_LIMITS[key].min} to ${PACING_LIMITS[key].max}`);
  }
  await db.batch(KEYS.map((key) => ({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", params: [`pacing.${key}`, String(pacing[key])] })));
}

function isValid(key: keyof Pacing, n: number): boolean {
  return Number.isInteger(n) && n >= PACING_LIMITS[key].min && n <= PACING_LIMITS[key].max;
}
