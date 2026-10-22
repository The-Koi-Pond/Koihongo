// The library: every path item with its learning status.

import type { Db } from "./db/db.ts";
import { getItemDetails } from "./items.ts";
import type { ItemKind } from "./srs/progress.ts";
import { rankSql, type Rank } from "./srs/ranks.ts";
import { PASS_STABILITY_DAYS, type CardType } from "./srs/scheduler.ts";

/** locked: needs other items first · available: ready for a lesson · learning: started, not passed · passed */
export type ItemStatus = "locked" | "available" | "learning" | "passed";

export const STATUS_NAME: Record<ItemStatus, string> = {
  locked: "Locked",
  available: "Ready to learn",
  learning: "Learning",
  passed: "Passed",
};

export type LibraryItem = {
  item_key: string;
  kind: ItemKind;
  position: number;
  label: string;
  meaning: string;
  status: ItemStatus;
  /** B, A, S or ★ once passed (see srs/ranks.ts). */
  rank: Rank | null;
  /** 1 if the item is on fast track. */
  fast: number;
  /** Lowercase text to search: label, meanings, readings. */
  search: string;
};

/** All path items (or just `keys`) in path order, with status. */
export async function libraryItems(db: Db, keys?: string[]): Promise<LibraryItem[]> {
  const filter = keys ? `WHERE p.item_key IN (${keys.map(() => "?").join(", ")})` : "";
  return db.all<LibraryItem>(
    `WITH cards AS (SELECT item_key, min(stability) AS stability FROM srs_cards GROUP BY item_key),
          passed AS (SELECT item_key FROM cards WHERE stability >= ?)
     SELECT p.item_key, p.kind, p.position,
       coalesce(ka.character, c.display, k.character, w.written) AS label,
       coalesce(ka.romaji, c.name, json_extract(k.meanings, '$[0]'), json_extract(w.senses, '$[0].glosses[0]')) AS meaning,
       CASE
         WHEN cards.item_key IS NOT NULL THEN CASE WHEN cards.stability >= ? THEN 'passed' ELSE 'learning' END
         WHEN EXISTS (SELECT 1 FROM content.path_requirements r
                      WHERE r.item_key = p.item_key AND r.requires_key NOT IN (SELECT item_key FROM passed)) THEN 'locked'
         ELSE 'available'
       END AS status,
       ${rankSql("cards.stability")} AS rank,
       EXISTS (SELECT 1 FROM fast_track f WHERE f.item_key = p.item_key) AS fast,
       lower(coalesce(ka.character || ' ' || ka.romaji || ' ' || ka.accept || ' ' || ka.script,
                      c.display || ' ' || c.name,
                      k.character || ' ' || k.meanings || ' ' || k.on_readings || ' ' || k.kun_readings,
                      w.written || ' ' || w.reading || ' ' ||
                        (SELECT group_concat(g.value, ' ') FROM json_each(w.senses) s, json_each(s.value, '$.glosses') g))) AS search
     FROM content.path p
     LEFT JOIN cards ON cards.item_key = p.item_key
     LEFT JOIN content.kana ka ON p.kind = 'kana' AND ka.character = substr(p.item_key, 6)
     LEFT JOIN content.components c ON p.kind = 'component' AND c.glyph = substr(p.item_key, 11)
     LEFT JOIN content.kanji k ON p.kind = 'kanji' AND k.character = substr(p.item_key, 7)
     LEFT JOIN content.words w ON p.kind = 'word' AND w.id = substr(p.item_key, 6)
     ${filter}
     ORDER BY p.position`,
    [PASS_STABILITY_DAYS, PASS_STABILITY_DAYS, ...(keys ?? [])],
  );
}

export type ItemPreview = {
  item_key: string;
  kind: ItemKind;
  label: string;
  meanings: string[];
  readings: string[];
  /** null for items that exist (e.g. a rare kanji) but aren't on the path. */
  status: ItemStatus | null;
  /** On fast track (right answers count as easy). */
  fast: boolean;
};

/** The short summary a popover shows. */
export async function itemPreview(db: Db, itemKey: string): Promise<ItemPreview> {
  const item = await getItemDetails(db, itemKey);
  const [onPath] = await libraryItems(db, [itemKey]);
  const base = { item_key: itemKey, kind: item.kind, status: onPath?.status ?? null, fast: onPath?.fast === 1 };
  switch (item.kind) {
    case "kana":
      return { ...base, label: item.character, meanings: [[item.romaji, ...item.accept].join(" / ")], readings: item.counterpart ? [item.counterpart] : [] };
    case "component":
      return { ...base, label: item.display, meanings: [item.name, ...item.synonyms], readings: [] };
    case "kanji":
      return { ...base, label: item.character, meanings: item.meanings, readings: [...item.onReadings, ...item.kunReadings] };
    case "word":
      return {
        ...base,
        label: item.written,
        meanings: item.senses.slice(0, 3).map((s) => s.glosses.slice(0, 3).join(", ")),
        readings: [item.reading],
      };
  }
}

export type ItemProgress = {
  status: ItemStatus;
  cards: { card_type: CardType; due: number; stability: number; reps: number; lapses: number; started_at: number }[];
  /** Items this one needs, with their status. */
  requires: LibraryItem[];
};

export async function itemProgress(db: Db, itemKey: string): Promise<ItemProgress> {
  const [self] = await libraryItems(db, [itemKey]);
  if (!self) throw new Error(`${itemKey} isn't on the path`);
  const cards = await db.all<ItemProgress["cards"][number]>(
    "SELECT card_type, due, stability, reps, lapses, started_at FROM srs_cards WHERE item_key = ? ORDER BY card_type",
    [itemKey],
  );
  const reqKeys = await db.all<{ requires_key: string }>("SELECT requires_key FROM content.path_requirements WHERE item_key = ?", [itemKey]);
  const requires = reqKeys.length ? await libraryItems(db, reqKeys.map((r) => r.requires_key)) : [];
  return { status: self.status, cards, requires };
}
