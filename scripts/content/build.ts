// Builds src-tauri/resources/content.db from open datasets.
// Run with: pnpm content:build   (add --refresh to re-download everything)
//
// Sources and licenses: see docs/03-architecture.md. Downloads are cached in
// data/raw/ (not committed).

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { strFromU8, unzipSync } from "fflate";
import { japaneseName, NAME_NOTES } from "./componentNames.ts";
import { describeComponent, partsOf } from "./components.ts";
import { allKana, CURATED_EXAMPLES, pickExample, type ExampleCandidate } from "./kana.ts";
import { allMnemonics } from "./mnemonics/index.ts";
import { planLevels } from "./levels.ts";
import { buildPath, type PathKanji, type PathWord } from "./path.ts";
import { NO_PRIORITY, parsePriorities } from "./priority.ts";
import { entryTerms } from "../../src/searchTerms.ts";
import { linkSentences, parseTanaka } from "./sentences.ts";
import { sfxKeys, sfxWords } from "./sfx.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "src-tauri", "resources", "content.db");
const REFRESH = process.argv.includes("--refresh");
const WORDS_PER_KANJI = 3;
// Words scoring worse than this (see priority.ts) stay off the path: an empty
// slot beats filling it with a rare word.
const MAX_PATH_WORD_PRIORITY = 20;
const JOYO_GRADES = new Set([1, 2, 3, 4, 5, 6, 8]);
// Jōyō forms added in 2010 that KRADFILE only lists under their older variant.
const KRAD_VARIANTS: Record<string, string> = { "𠮟": "叱", 剝: "剥" };
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Example sentences kept per word; the app picks the ones whose words you know best.
const SENTENCES_PER_WORD = 20;

// --- Source data shapes (only the fields we use) ---------------------------

type KanjidicChar = {
  literal: string;
  misc: { grade: number | null; strokeCounts: number[]; frequency: number | null; jlptLevel: number | null; radicalNames: string[] };
  readingMeaning: {
    groups: { readings: { type: string; value: string }[]; meanings: { lang: string; value: string }[] }[];
    nanori: string[];
  } | null;
};

type JmdictWord = {
  id: string;
  kanji: { common: boolean; text: string; tags: string[] }[];
  kana: { common: boolean; text: string; tags: string[]; appliesToKanji: string[] }[];
  sense: {
    partOfSpeech: string[];
    misc: string[];
    info: string[];
    gloss: { text: string }[];
  }[];
};

// --- Downloads ---------------------------------------------------------------

type Asset = { name: string; url: string; version: string };

async function latestAsset(repo: string, pattern: RegExp): Promise<Asset> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": "nihongo-content-build" },
  });
  if (!res.ok) throw new Error(`GitHub release lookup for ${repo} failed: ${res.status}`);
  const release = (await res.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  const asset = release.assets.find((a) => pattern.test(a.name));
  if (!asset) throw new Error(`No asset matching ${pattern} in ${repo} ${release.tag_name}`);
  return { name: asset.name, url: asset.browser_download_url, version: release.tag_name };
}

/** Returns the cached file, downloading it if missing, stale or --refresh. */
async function download(url: string, name: string, maxAgeMs = Infinity): Promise<Uint8Array> {
  const path = join(RAW, name);
  const fresh = existsSync(path) && Date.now() - statSync(path).mtimeMs < maxAgeMs;
  if (fresh && !REFRESH) return readFileSync(path);
  console.log(`Downloading ${name} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download of ${url} failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  mkdirSync(RAW, { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

function unzipJson<T>(zip: Uint8Array): T {
  const files = unzipSync(zip, { filter: (f) => f.name.endsWith(".json") });
  const names = Object.keys(files);
  if (names.length !== 1) throw new Error(`Expected one JSON file in zip, found ${names.length}`);
  return JSON.parse(strFromU8(files[names[0]])) as T;
}

// --- Words -------------------------------------------------------------------

const RARE_FORM_TAGS = new Set(["rK", "sK", "oK", "iK", "ik", "ok", "rk", "sk"]);
const isKanjiChar = (ch: string) => /\p{Script=Han}/u.test(ch) && ch !== "々";

type Word = {
  id: string;
  written: string;
  reading: string;
  otherForms: string[];
  senses: { pos: string[]; glosses: string[]; misc: string[]; info: string[] }[];
  priority: number;
  usuallyKana: boolean;
  kanji: string[];
};

function toWord(w: JmdictWord, priority: number): Word | null {
  const isCommon = w.kanji.some((k) => k.common) || w.kana.some((k) => k.common);
  if (!isCommon) return null;

  const kanjiForm =
    w.kanji.find((k) => k.common && !k.tags.some((t) => RARE_FORM_TAGS.has(t))) ?? w.kanji.find((k) => k.common);
  const fitsForm = (k: JmdictWord["kana"][number]) =>
    !kanjiForm || k.appliesToKanji.includes("*") || k.appliesToKanji.includes(kanjiForm.text);
  const reading = w.kana.find((k) => k.common && fitsForm(k)) ?? w.kana.find(fitsForm) ?? w.kana[0];
  const written = kanjiForm?.text ?? reading.text;

  return {
    id: w.id,
    written,
    reading: reading.text,
    otherForms: [...w.kanji.map((k) => k.text), ...w.kana.map((k) => k.text)].filter(
      (t) => t !== written && t !== reading.text,
    ),
    senses: w.sense.map((s) => ({ pos: s.partOfSpeech, glosses: s.gloss.map((g) => g.text), misc: s.misc, info: s.info })),
    priority,
    usuallyKana: w.sense[0]?.misc.includes("uk") ?? false,
    kanji: kanjiForm ? [...new Set([...kanjiForm.text].filter(isKanjiChar))] : [],
  };
}

// --- Main ----------------------------------------------------------------------

async function main() {
  const [kanjidicAsset, kradAsset, radkAsset, examplesAsset, kanjivgAsset] = await Promise.all([
    latestAsset("scriptin/jmdict-simplified", /^kanjidic2-en-.*\.json\.zip$/),
    latestAsset("scriptin/jmdict-simplified", /^kradfile-.*\.json\.zip$/),
    latestAsset("scriptin/jmdict-simplified", /^radkfile-.*\.json\.zip$/),
    latestAsset("scriptin/jmdict-simplified", /^jmdict-examples-eng-.*\.json\.zip$/),
    latestAsset("KanjiVG/kanjivg", /^kanjivg-\d+-main\.zip$/),
  ]);
  const jmdictRawUrl = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz";
  const tanakaUrl = "http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz";

  const kanjidic = unzipJson<{ characters: KanjidicChar[] }>(await download(kanjidicAsset.url, kanjidicAsset.name));
  const krad = unzipJson<{ kanji: Record<string, string[]> }>(await download(kradAsset.url, kradAsset.name));
  const radk = unzipJson<{ radicals: Record<string, { strokeCount: number }> }>(
    await download(radkAsset.url, radkAsset.name),
  );
  const jmdict = unzipJson<{ words: JmdictWord[] }>(await download(examplesAsset.url, examplesAsset.name));
  const priorities = parsePriorities(
    gunzipSync(await download(jmdictRawUrl, "JMdict_e.gz", MAX_AGE_MS)).toString("utf8"),
  );
  const kanjivgZip = await download(kanjivgAsset.url, kanjivgAsset.name);
  const tanaka = parseTanaka(gunzipSync(await download(tanakaUrl, "examples.utf.gz", MAX_AGE_MS)).toString("utf8"));
  const tanakaVersion = statSync(join(RAW, "examples.utf.gz")).mtime.toISOString().slice(0, 10);

  // Kanji: jōyō + jinmeiyō (grades 1–10). Only jōyō go on the path.
  const kanjiChars = kanjidic.characters.filter((c) => c.misc.grade !== null);
  const kanjiSet = new Set(kanjiChars.map((c) => c.literal));
  const joyo = kanjiChars.filter((c) => JOYO_GRADES.has(c.misc.grade!));
  const joyoSet = new Set(joyo.map((c) => c.literal));
  const firstMeaning = new Map(
    kanjidic.characters.map((c) => [c.literal, c.readingMeaning?.groups[0]?.meanings[0]?.value]),
  );

  const kana = allKana();

  const words = jmdict.words
    .map((w) => toWord(w, priorities.get(w.id) ?? NO_PRIORITY))
    .filter((w): w is Word => w !== null);

  const componentsOf = (ch: string) => partsOf(ch, krad.kanji[KRAD_VARIANTS[ch] ?? ch] ?? []);
  const componentGlyphs = new Set(kanjiChars.flatMap((c) => componentsOf(c.literal)));
  const componentStrokes = new Map([...componentGlyphs].map((g) => [g, radk.radicals[g]?.strokeCount ?? 0]));
  const componentDisplay = new Map([...componentGlyphs].map((g) => [g, describeComponent(g, (ch) => firstMeaning.get(ch))]));
  // Japanese names for components, looked up by the shape shown (氵, not 汁).
  const kanjidicByChar = new Map(kanjidic.characters.map((c) => [c.literal, c]));
  const readings = (c: KanjidicChar, type: string) => (c.readingMeaning?.groups[0]?.readings ?? []).filter((r) => r.type === type).map((r) => r.value);
  const kanjidicNames = (ch: string) => {
    const c = kanjidicByChar.get(ch);
    return c && { radicalNames: c.misc.radicalNames ?? [], kun: readings(c, "ja_kun"), on: readings(c, "ja_on") };
  };

  // Stroke orders from KanjiVG: kanji, single kana, and components (by their
  // displayed shape, e.g. ⺅, else the glyph itself; KanjiVG has nearly all of them).
  const svgName = (ch: string) => `kanji/${ch.codePointAt(0)!.toString(16).padStart(5, "0")}.svg`;
  const singleKana = kana.filter((k) => [...k.character].length === 1).map((k) => k.character);
  const componentChars = [...componentGlyphs].flatMap((g) => [componentDisplay.get(g)!.display, g]).filter((ch) => [...ch].length === 1);
  const wantedSvgs = new Set([...kanjiSet, ...singleKana, ...componentChars].map(svgName));
  const svgs = unzipSync(kanjivgZip, { filter: (f) => wantedSvgs.has(f.name) });
  // Drop the XML prolog/DOCTYPE; the KanjiVG credit lives in the sources table.
  const strokeSvg = (ch: string) => {
    if ([...ch].length !== 1) return null;
    const file = svgs[svgName(ch)];
    if (!file) return null;
    const text = strFromU8(file);
    return text.slice(text.indexOf("<svg"));
  };

  const pathKanji: PathKanji[] = joyo.map((c) => ({
    character: c.literal,
    jlptOld: c.misc.jlptLevel,
    freqRank: c.misc.frequency,
    strokeCount: c.misc.strokeCounts[0],
    // A kanji may list itself (木 → 木): the component 木 then comes before the kanji 木.
    components: componentsOf(c.literal),
  }));
  const pathWords: PathWord[] = words
    .filter((w) => !w.usuallyKana && w.priority <= MAX_PATH_WORD_PRIORITY && w.kanji.length > 0 && w.kanji.every((k) => joyoSet.has(k)))
    .map((w) => ({ id: w.id, kanji: w.kanji, priority: w.priority, written: w.written }));
  const path = buildPath(pathKanji, componentStrokes, pathWords, WORDS_PER_KANJI);

  // --- Write the database (to a temp file, then swap in) ---
  mkdirSync(join(ROOT, "src-tauri", "resources"), { recursive: true });
  const tmp = `${OUT}.tmp`;
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  db.exec(readFileSync(join(import.meta.dirname, "schema.sql"), "utf8"));
  db.exec("BEGIN");

  const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("built_at", new Date().toISOString());
  insertMeta.run("words_per_kanji", String(WORDS_PER_KANJI));
  insertMeta.run("max_path_word_priority", String(MAX_PATH_WORD_PRIORITY));

  const insertSource = db.prepare("INSERT INTO sources (name, version, license, url, credit) VALUES (?, ?, ?, ?, ?)");
  const edrdg = "https://www.edrdg.org/edrdg/licence.html";
  insertSource.run("KANJIDIC2", kanjidicAsset.version, "CC BY-SA 4.0", "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project", `Electronic Dictionary Research and Development Group (EDRDG), licence: ${edrdg}`);
  insertSource.run("JMdict", examplesAsset.version, "CC BY-SA 4.0", "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project", `Electronic Dictionary Research and Development Group (EDRDG), licence: ${edrdg}`);
  insertSource.run("KRADFILE/RADKFILE", kradAsset.version, "CC BY-SA 4.0", "https://www.edrdg.org/krad/kradinf.html", `Electronic Dictionary Research and Development Group (EDRDG), licence: ${edrdg}`);
  insertSource.run("KanjiVG", kanjivgAsset.version, "CC BY-SA 3.0", "https://kanjivg.tagaini.net", "Copyright Ulrich Apel");
  insertSource.run("Tatoeba (Tanaka Corpus, indexed by EDRDG)", tanakaVersion, "CC BY 2.0 FR", "https://tatoeba.org", "Tatoeba contributors; word index by the Electronic Dictionary Research and Development Group (EDRDG)");
  insertSource.run("jmdict-simplified (JSON conversion)", examplesAsset.version, "CC BY-SA 4.0", "https://github.com/scriptin/jmdict-simplified", "Dmitry Shpika and contributors");

  const insertComponent = db.prepare(
    "INSERT INTO components (glyph, display, name, stroke_count, stroke_svg, ja_name, ja_note) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const g of componentGlyphs) {
    const { display, name } = componentDisplay.get(g)!;
    const jaName = japaneseName(display, display !== g, kanjidicNames);
    insertComponent.run(g, display, name, componentStrokes.get(g) ?? 0, strokeSvg(display) ?? strokeSvg(g), jaName, jaName ? (NAME_NOTES[display] ?? null) : null);
  }

  const insertKanji = db.prepare(
    `INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, grade, jlpt_old, freq_rank, stroke_count, stroke_svg)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertKanjiComponent = db.prepare("INSERT INTO kanji_components (kanji, component) VALUES (?, ?)");
  for (const c of kanjiChars) {
    const groups = c.readingMeaning?.groups ?? [];
    const readings = (type: string) => groups.flatMap((g) => g.readings.filter((r) => r.type === type).map((r) => r.value));
    insertKanji.run(
      c.literal,
      JSON.stringify(groups.flatMap((g) => g.meanings.filter((m) => m.lang === "en").map((m) => m.value))),
      JSON.stringify(readings("ja_on")),
      JSON.stringify(readings("ja_kun")),
      JSON.stringify(c.readingMeaning?.nanori ?? []),
      c.misc.grade,
      c.misc.jlptLevel,
      c.misc.frequency,
      c.misc.strokeCounts[0],
      strokeSvg(c.literal),
    );
    for (const g of new Set(componentsOf(c.literal))) insertKanjiComponent.run(c.literal, g);
  }

  const insertWord = db.prepare(
    `INSERT INTO words (id, written, reading, other_forms, senses, priority, usually_kana) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertWordKanji = db.prepare("INSERT INTO word_kanji (word_id, kanji) VALUES (?, ?)");
  const insertSentence = db.prepare("INSERT INTO sentences (id, japanese, english, kanji_words, unlisted) VALUES (?, ?, ?, ?, ?)");
  const insertWordSentence = db.prepare("INSERT INTO word_sentences (word_id, sentence_id, form, checked) VALUES (?, ?, ?, ?)");
  for (const w of words) {
    insertWord.run(w.id, w.written, w.reading, JSON.stringify(w.otherForms), JSON.stringify(w.senses), w.priority, w.usuallyKana ? 1 : 0);
    for (const k of w.kanji) if (kanjiSet.has(k)) insertWordKanji.run(w.id, k);
  }
  const { sentences, links: sentenceLinks } = linkSentences(tanaka, words, SENTENCES_PER_WORD);
  for (const s of sentences) insertSentence.run(s.id, s.japanese, s.english, JSON.stringify(s.kanjiWords), s.unlisted);
  for (const l of sentenceLinks) insertWordSentence.run(l.wordId, l.sentenceId, l.form, l.checked ? 1 : 0);

  // Dictionary search over every kanji and word.
  const insertSearch = db.prepare("INSERT INTO search (term, field, item_key, weight, rank) VALUES (?, ?, ?, ?, ?)");
  let searchRows = 0;
  const indexEntry = (itemKey: string, rank: number, entry: Parameters<typeof entryTerms>[0]) => {
    for (const t of entryTerms(entry)) {
      insertSearch.run(t.term, t.field, itemKey, t.weight, rank);
      searchRows++;
    }
  };
  for (const c of kanjiChars) {
    const groups = c.readingMeaning?.groups ?? [];
    const readings = groups.flatMap((g) => g.readings.filter((r) => r.type === "ja_on" || r.type === "ja_kun").map((r) => r.value.replace(/[.-]/g, "")));
    const meanings = groups.flatMap((g) => g.meanings.filter((m) => m.lang === "en").map((m) => [m.value]));
    indexEntry(`kanji:${c.literal}`, c.misc.frequency ?? 9999, { forms: [c.literal], readings, meanings });
  }
  for (const w of words) {
    const isKana = (f: string) => /^[p{Script=Hiragana}p{Script=Katakana}ー]+$/u.test(f);
    indexEntry(`word:${w.id}`, w.priority, {
      forms: [w.written, ...w.otherForms.filter((f) => !isKana(f))],
      readings: [w.reading, ...w.otherForms.filter(isKana)],
      meanings: w.senses.map((s) => s.glosses),
    });
  }

  // Every JMdict entry, for word help in Reading (forms → entries; a few senses each).
  const insertEntry = db.prepare("INSERT INTO dict_entries (id, written, reading, senses, common, priority) VALUES (?, ?, ?, ?, ?, ?)");
  const insertForm = db.prepare("INSERT OR IGNORE INTO dict_forms (form, entry_id) VALUES (?, ?)");
  let entries = 0;
  for (const w of jmdict.words) {
    if (w.kana.length === 0) continue;
    const kanjiForm = w.kanji.find((k) => !k.tags.some((t) => RARE_FORM_TAGS.has(t))) ?? w.kanji[0];
    const usuallyKana = w.sense[0]?.misc.includes("uk") ?? false;
    const written = (!usuallyKana && kanjiForm?.text) || w.kana[0].text;
    // Enough for a lookup card: the first 3 senses, 3 glosses each; parts of speech on the first.
    const senses = w.sense.slice(0, 3).map((s, i) => ({ pos: i === 0 ? s.partOfSpeech : [], glosses: s.gloss.slice(0, 3).map((g) => g.text) }));
    const common = w.kanji.some((k) => k.common) || w.kana.some((k) => k.common);
    insertEntry.run(w.id, written, w.kana[0].text, JSON.stringify(senses), common ? 1 : 0, priorities.get(w.id) ?? NO_PRIORITY);
    for (const f of [...w.kanji, ...w.kana]) insertForm.run(f.text, w.id);
    entries++;
  }

  // The SFX dictionary: every JMdict sound/mimetic word (common or not) and our extras.
  const insertSfxWord = db.prepare("INSERT INTO sfx_words (id, forms, meanings, source, rank) VALUES (?, ?, ?, ?, ?)");
  const insertSfxKey = db.prepare("INSERT OR IGNORE INTO sfx_keys (key, word_id, loose) VALUES (?, ?, ?)");
  const sfx = sfxWords(jmdict.words, (id) => priorities.get(id) ?? NO_PRIORITY);
  sfx.forEach((w, i) => {
    insertSfxWord.run(i + 1, JSON.stringify(w.forms), JSON.stringify(w.meanings), w.source, w.rank);
    // The same word's own key wins over its loose one (INSERT OR IGNORE keeps the first).
    const keys = w.forms.flatMap(sfxKeys).sort((a, b) => Number(a.loose) - Number(b.loose));
    for (const k of keys) insertSfxKey.run(k.key, i + 1, k.loose ? 1 : 0);
  });

  const insertKana = db.prepare(
    "INSERT INTO kana (character, romaji, accept, script, grp, counterpart, stroke_svg, example_word_id, example_form) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const candidates: ExampleCandidate[] = words.map((w) => ({
    id: w.id,
    written: w.written,
    reading: w.reading,
    otherForms: w.otherForms,
    priority: w.priority,
    isNoun: w.senses[0]?.pos.includes("n") ?? false,
  }));
  const kanaWithoutExample: string[] = [];
  const curatedMissing: string[] = [];
  for (const k of kana) {
    const example = pickExample(k, candidates);
    if (!example) kanaWithoutExample.push(k.character);
    const curated = CURATED_EXAMPLES[k.character];
    if (curated && example?.form !== curated[0]) curatedMissing.push(`${k.character}=${curated[0]}`);
    insertKana.run(k.character, k.romaji, JSON.stringify(k.accept), k.script, k.group, k.counterpart, [...k.character].length === 1 ? strokeSvg(k.character) : null, example?.word.id ?? null, example?.form ?? null);
  }

  // Kana track first, then the main (components → kanji → words) track.
  const fullPath = [
    ...kana.map((k) => ({ key: `kana:${k.character}`, kind: "kana", track: "kana", requires: k.requires.map((r) => `kana:${r}`) })),
    ...path.map((p) => ({ ...p, track: "main" })),
  ];
  // Levels and regions over the main track.
  const oldJlpt = new Map(kanjiChars.map((c) => [`kanji:${c.literal}`, c.misc.jlptLevel]));
  const { levels, itemLevel } = planLevels(path, (key) => oldJlpt.get(key) ?? null);
  const insertLevel = db.prepare("INSERT INTO levels (level, region, region_level, region_levels, needed) VALUES (?, ?, ?, ?, ?)");
  for (const l of levels) insertLevel.run(l.level, l.region, l.regionLevel, l.regionLevels, l.needed);

  const insertPath = db.prepare("INSERT INTO path (position, item_key, kind, track, level) VALUES (?, ?, ?, ?, ?)");
  const insertRequirement = db.prepare("INSERT INTO path_requirements (item_key, requires_key) VALUES (?, ?)");
  fullPath.forEach((p, i) => insertPath.run(i + 1, p.key, p.kind, p.track, itemLevel.get(p.key) ?? null));
  for (const p of fullPath) for (const r of p.requires) insertRequirement.run(p.key, r);

  // Default mnemonics. Kana and components only have one kind (sound or name).
  const pathKinds = new Map(fullPath.map((p) => [p.key, p.kind]));
  const insertMnemonic = db.prepare("INSERT INTO mnemonics (item_key, kind, text) VALUES (?, ?, ?)");
  const mnemonics = allMnemonics();
  for (const [key, m] of Object.entries(mnemonics)) {
    const kind = pathKinds.get(key);
    if (!kind) throw new Error(`Mnemonic for ${key}, which isn't on the path`);
    if (kind === "kana" && m.meaning) throw new Error(`Kana mnemonics are reading-only: ${key}`);
    if (kind === "component" && m.reading) throw new Error(`Component mnemonics are meaning-only: ${key}`);
    if (m.meaning) insertMnemonic.run(key, "meaning", m.meaning.trim());
    if (m.reading) insertMnemonic.run(key, "reading", m.reading.trim());
  }

  db.exec("COMMIT");
  const brokenRefs = db.prepare("PRAGMA foreign_key_check").all();
  if (brokenRefs.length) throw new Error(`content.db has ${brokenRefs.length} broken references, e.g. ${JSON.stringify(brokenRefs[0])}`);
  db.exec("VACUUM");
  db.close();
  rmSync(OUT, { force: true });
  renameSync(tmp, OUT);

  // --- Summary ---
  const count = (kind: string) => path.filter((p) => p.kind === kind).length;
  const noComponents = joyo.filter((c) => componentsOf(c.literal).length === 0).map((c) => c.literal);
  const noSvg = joyo.filter((c) => !svgs[svgName(c.literal)]).map((c) => c.literal);
  console.log(`Wrote ${OUT}`);
  console.log(`  kanji: ${kanjiChars.length} (${joyo.length} jōyō), words: ${words.length}, components: ${componentGlyphs.size}`);
  console.log(`  kana track: ${kana.length} kana; main path: ${path.length} items (${count("component")} components, ${count("kanji")} kanji, ${count("word")} words)`);
  if (noComponents.length) console.log(`  jōyō kanji without KRADFILE components: ${noComponents.join(" ")}`);
  if (curatedMissing.length) console.log(`  hand-picked kana examples not found in common words: ${curatedMissing.join(" ")}`);
  if (kanaWithoutExample.length) console.log(`  kana without an example word: ${kanaWithoutExample.join(" ")}`);
  if (noSvg.length) console.log(`  jōyō kanji without stroke order: ${noSvg.join(" ")}`);
  const wordsWithSentences = new Set(sentenceLinks.map((l) => l.wordId));
  const pathWordsWithout = path.filter((p) => p.kind === "word" && !wordsWithSentences.has(p.key.slice(5))).length;
  console.log(`  example sentences: ${sentences.length}, for ${wordsWithSentences.size} words (${pathWordsWithout} path words have none)`);
  console.log(`  dictionary search: ${searchRows} terms`);
  console.log(`  word lookups: ${entries} JMdict entries`);
  console.log(`  SFX dictionary: ${sfx.length} entries (${sfx.filter((w) => w.source === "koihongo").length} written for Koihongo)`);
  console.log(`  default mnemonics: ${Object.keys(mnemonics).length} items`);
  const regionLevels = [...new Set(levels.map((l) => l.region))].map((r) => `${r} ${levels.filter((l) => l.region === r).length}`);
  console.log(`  levels: ${levels.length} (${regionLevels.join(", ")})`);
}

await main();
