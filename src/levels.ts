// Your level: game-style levels over the main path, grouped into regions named
// after approximate JLPT bands. The levels themselves are built into content.db
// (scripts/content/levels.ts); this reads your progress through them.

import type { Db } from "./db/db.ts";
import { PASS_STABILITY_DAYS } from "./srs/scheduler.ts";

/** Passed and learning (started, not yet passed) items out of a total. */
export type Tally = { passed: number; learning: number; total: number };

export type LevelStatus = {
  /** Current level: the first one not yet cleared, counted from 1 along the whole path. */
  level: number;
  /** "N5" … "N1": the (approximate) JLPT band of the level's kanji. */
  region: string;
  /** Position of this level within its region, from 1, and the region's number of levels. */
  regionLevel: number;
  regionLevels: number;
  /** The level is cleared when `needed` of its kanji have passed. */
  kanji: Tally & { needed: number };
  components: Tally;
  words: Tally;
  /** Every level is cleared (this is then the last one). */
  complete: boolean;
};

const EMPTY: Tally = { passed: 0, learning: 0, total: 0 };
const SEEN_KEY = "progress.seenLevel";

type Row = {
  level: number;
  region: string;
  region_level: number;
  region_levels: number;
  needed: number;
  kind: string;
  total: number;
  passed: number;
  learning: number;
};

/** Your current level and its items, or null if the content has no levels. */
export async function levelStatus(db: Db): Promise<LevelStatus | null> {
  const rows = await db.all<Row>(
    `WITH cards AS (SELECT item_key, min(stability) AS stability FROM srs_cards GROUP BY item_key)
     SELECT l.level, l.region, l.region_level, l.region_levels, l.needed, p.kind,
       count(*) AS total,
       coalesce(sum(cards.stability >= ?), 0) AS passed,
       coalesce(sum(cards.stability < ?), 0) AS learning
     FROM content.levels l
     JOIN content.path p ON p.level = l.level
     LEFT JOIN cards ON cards.item_key = p.item_key
     GROUP BY l.level, p.kind
     ORDER BY l.level`,
    [PASS_STABILITY_DAYS, PASS_STABILITY_DAYS],
  );
  if (rows.length === 0) return null;

  const levels = new Map<number, LevelStatus>();
  for (const r of rows) {
    let s = levels.get(r.level);
    if (!s) {
      s = {
        level: r.level,
        region: r.region,
        regionLevel: r.region_level,
        regionLevels: r.region_levels,
        kanji: { ...EMPTY, needed: r.needed },
        components: { ...EMPTY },
        words: { ...EMPTY },
        complete: false,
      };
      levels.set(r.level, s);
    }
    const tally = { passed: r.passed, learning: r.learning, total: r.total };
    if (r.kind === "kanji") Object.assign(s.kanji, tally);
    else if (r.kind === "component") s.components = tally;
    else if (r.kind === "word") s.words = tally;
  }
  const all = [...levels.values()];
  const current = all.find((s) => s.kanji.passed < s.kanji.needed);
  return current ?? { ...all[all.length - 1], complete: true };
}

/** Your kana progress, or null once every kana has passed. */
export async function kanaTally(db: Db): Promise<Tally | null> {
  const [t] = await db.all<Tally>(
    `WITH cards AS (SELECT item_key, min(stability) AS stability FROM srs_cards GROUP BY item_key)
     SELECT count(*) AS total,
       coalesce(sum(cards.stability >= ?), 0) AS passed,
       coalesce(sum(cards.stability < ?), 0) AS learning
     FROM content.path p LEFT JOIN cards ON cards.item_key = p.item_key
     WHERE p.track = 'kana'`,
    [PASS_STABILITY_DAYS, PASS_STABILITY_DAYS],
  );
  return t && t.total > 0 && t.passed < t.total ? t : null;
}

export type LevelUpNews = { from: number; to: number; newRegion?: string };

/**
 * A level-up to celebrate: the current level is higher than the last one you
 * were shown. The first time (nothing recorded yet), or if the level went down
 * (say, after restoring a backup), it just records the current level.
 */
export async function levelUpToShow(db: Db, current: number): Promise<LevelUpNews | null> {
  const [row] = await db.all<{ value: string }>("SELECT value FROM settings WHERE key = ?", [SEEN_KEY]);
  const seen = row ? Number(row.value) : NaN;
  if (!Number.isInteger(seen) || current < seen) {
    await markLevelSeen(db, current);
    return null;
  }
  if (current === seen) return null;
  const regions = await db.all<{ level: number; region: string }>("SELECT level, region FROM content.levels WHERE level IN (?, ?)", [seen, current]);
  const regionOf = (level: number) => regions.find((r) => r.level === level)?.region;
  const to = regionOf(current);
  return { from: seen, to: current, newRegion: to !== regionOf(seen) ? to : undefined };
}

export async function markLevelSeen(db: Db, level: number): Promise<void> {
  await db.batch([{ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", params: [SEEN_KEY, String(level)] }]);
}
