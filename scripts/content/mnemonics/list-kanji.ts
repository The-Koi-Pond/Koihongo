// Lists path kanji with what a mnemonic needs: meanings, readings, component
// names, and the first path words that use each kanji (which readings the
// learner meets first). Run after `pnpm content:build`:
//
//   pnpm mnemonics:kanji 151 50     (50 kanji starting at the 151st)

import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const [from = "1", count = "50"] = process.argv.slice(2);
const db = new DatabaseSync(join(import.meta.dirname, "..", "..", "..", "src-tauri", "resources", "content.db"), { readOnly: true });

type Row = { k: string; meanings: string; on_readings: string; kun_readings: string };
const kanji = db
  .prepare(
    `SELECT substr(p.item_key, 7) k, k.meanings, k.on_readings, k.kun_readings FROM path p
     JOIN kanji k ON k.character = substr(p.item_key, 7)
     WHERE p.kind = 'kanji' ORDER BY p.position LIMIT ? OFFSET ?`,
  )
  .all(Number(count), Number(from) - 1) as Row[];
const components = db.prepare(
  `SELECT c.display || '=' || c.name AS n FROM kanji_components kc JOIN components c ON c.glyph = kc.component
   WHERE kc.kanji = ? ORDER BY c.stroke_count`,
);
const words = db.prepare(
  `SELECT w.written || '(' || w.reading || ')' AS x FROM word_kanji wk JOIN words w ON w.id = wk.word_id
   JOIN path p ON p.item_key = 'word:' || w.id WHERE wk.kanji = ? ORDER BY p.position LIMIT 3`,
);

kanji.forEach((k, i) => {
  const list = (json: string, n: number) => (JSON.parse(json) as string[]).slice(0, n).join(",");
  console.log(
    Number(from) + i,
    k.k,
    list(k.meanings, 3),
    "| on",
    list(k.on_readings, 9),
    "| kun",
    list(k.kun_readings, 4),
    "|",
    (components.all(k.k) as { n: string }[]).map((r) => r.n).join(" "),
    "|",
    (words.all(k.k) as { x: string }[]).map((r) => r.x).join(" "),
  );
});
