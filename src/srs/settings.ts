// Study pacing. Fixed for now; a settings screen comes later in Phase 1.

/** New lessons per study day (components, kanji and words all count as one). */
export const NEW_PER_DAY = 10;

/**
 * Lessons shrink as reviews pile up, reaching zero at this many due reviews,
 * so a missed day can't snowball into an impossible backlog.
 */
export const PAUSE_LESSONS_AT_DUE = 100;

/**
 * Lessons are offered from the next this-many path positions only, so the path
 * order is roughly kept and you can't start 200 components before any kanji.
 */
export const LESSON_WINDOW = 40;

/** A study day runs from 4 am to 4 am, so a late-night session counts as "today". */
export const DAY_STARTS_AT_HOUR = 4;
