import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { groupPieces, lookUpWords, readingOf, type Piece } from "../src/words.ts";
import { openTestDb } from "./nodeDb.ts";

/** A piece the way IPADIC gives it: "動詞,自立,*,*,五段・タ行,連用形,待つ,マチ". */
function P(surface: string, fields: string): Piece {
  const f = fields.split(",").map((v) => (v === "*" ? "" : v));
  return { surface, pos: [f[0], f[1], f[2], f[3]], conjugation: [f[4], f[5]], base: f[6] ?? "", reading: f[7] ?? "" };
}

// Real splits of bubbles from a test page.
const MOU_MACHIMASEN = [P("もう", "副詞,一般,*,*,*,*,もう,モウ"), P("待ち", "動詞,自立,*,*,五段・タ行,連用形,待つ,マチ"), P("ませ", "助動詞,*,*,*,特殊・マス,未然形,ます,マセ"), P("ん", "助動詞,*,*,*,不変化型,基本形,ん,ン")];
const FUTARIKIRI = [P("やっと", "副詞,一般,*,*,*,*,やっと,ヤット"), P("二", "名詞,数,*,*,*,*,二,ニ"), P("人", "名詞,接尾,助数詞,*,*,*,人,ニン"), P("きり", "名詞,非自立,副詞可能,*,*,*,きり,キリ"), P("だ", "助動詞,*,*,*,特殊・ダ,基本形,だ,ダ")];
const TABESASERARE = [P("食べ", "動詞,自立,*,*,一段,未然形,食べる,タベ"), P("させ", "動詞,接尾,*,*,一段,未然形,させる,サセ"), P("られ", "動詞,接尾,*,*,一段,連用形,られる,ラレ"), P("たく", "助動詞,*,*,*,特殊・タイ,連用テ接続,たい,タク"), P("なかっ", "助動詞,*,*,*,特殊・ナイ,連用タ接続,ない,ナカッ"), P("た", "助動詞,*,*,*,特殊・タ,基本形,た,タ")];

test("word help: a verb keeps its endings; particles and helpers on their own are grammar", () => {
  const words = groupPieces(MOU_MACHIMASEN);
  assert.deepEqual(words.map((w) => [w.surface, w.base, w.role]), [
    ["もう", "もう", "word"],
    ["待ちません", "待つ", "word"],
  ]);
  assert.deepEqual(groupPieces(TABESASERARE).map((w) => [w.surface, w.base]), [["食べさせられたくなかった", "食べる"]]);
  assert.deepEqual(groupPieces(FUTARIKIRI).at(-1), { surface: "だ", base: "だ", pieces: [FUTARIKIRI[4]], role: "grammar", status: "grammar" });
  // A noun + する is one verb; て + いる stays with it.
  const promised = groupPieces([P("約束", "名詞,サ変接続,*,*,*,*,約束,ヤクソク"), P("し", "動詞,自立,*,*,サ変・スル,連用形,する,シ"), P("て", "助詞,接続助詞,*,*,*,*,て,テ"), P("た", "動詞,非自立,*,*,一段,連用形,いる,タ"), P("よね", "助詞,終助詞,*,*,*,*,よね,ヨネ")]);
  assert.deepEqual(promised.map((w) => [w.surface, w.base, w.role]), [
    ["約束してた", "約束する", "word"],
    ["よね", "よね", "grammar"],
  ]);
  // Names and punctuation.
  const sorry = groupPieces([P("ごめん", "感動詞,*,*,*,*,*,ごめん,ゴメン"), P("優里", "名詞,固有名詞,人名,名,*,*,優里,ユリ"), P("！", "記号,一般,*,*,*,*,！,！")]);
  assert.deepEqual(sorry.map((w) => w.role), ["word", "name", "symbol"]);
});

function dictDb() {
  return openTestDb((c) => {
    const entry = c.prepare("INSERT INTO dict_entries (id, written, reading, senses, common, priority) VALUES (?, ?, ?, ?, ?, ?)");
    const form = c.prepare("INSERT INTO dict_forms (form, entry_id) VALUES (?, ?)");
    const add = (id: string, written: string, reading: string, gloss: string, common: number, forms: string[]) => {
      entry.run(id, written, reading, JSON.stringify([{ pos: ["n"], glosses: [gloss] }]), common, common ? 5 : 99);
      for (const f of forms) form.run(f, id);
    };
    add("1", "二人", "ふたり", "two people", 1, ["二人", "ふたり"]);
    add("2", "二人きり", "ふたりきり", "just the two of us", 0, ["二人きり", "二人っきり", "ふたりきり"]);
    add("3", "待つ", "まつ", "to wait", 1, ["待つ", "まつ"]);
    add("4", "やっと", "やっと", "at last", 1, ["やっと"]);
    add("5", "人", "ひと", "person", 1, ["人", "ひと"]);
    add("6", "人", "にん", "counter for people", 0, ["人", "にん"]);
  });
}

test("word help: neighbouring nouns join into the longest dictionary word, and each word finds its entry", async () => {
  const db = dictDb();
  await migrate(db);
  const words = await lookUpWords(db, groupPieces(FUTARIKIRI));
  assert.deepEqual(words.map((w) => [w.surface, w.entry?.written ?? null]), [
    ["やっと", "やっと"],
    ["二人きり", "二人きり"],
    ["だ", null],
  ]);
  const wait = await lookUpWords(db, groupPieces(MOU_MACHIMASEN));
  assert.equal(wait[1].entry?.written, "待つ");
  // A lone 人 read にん gets the にん entry, not the more common ひと.
  const alone = await lookUpWords(db, groupPieces([P("人", "名詞,接尾,助数詞,*,*,*,人,ニン")]));
  assert.equal(alone[0].entry?.reading, "にん");
});

test("word help: the reading uses JMdict for joined words and flags names", async () => {
  const db = dictDb();
  await migrate(db);
  assert.deepEqual(readingOf(await lookUpWords(db, groupPieces(FUTARIKIRI))), { reading: "やっと ふたりきり だ", unsure: false });
  assert.deepEqual(readingOf(groupPieces(MOU_MACHIMASEN)), { reading: "もう まちません", unsure: false });
  assert.deepEqual(readingOf(groupPieces([P("ごめん", "感動詞,*,*,*,*,*,ごめん,ゴメン"), P("優里", "名詞,固有名詞,人名,名,*,*,優里,ユリ"), P("！", "記号,一般,*,*,*,*,！,！")])), {
    reading: "ごめん ゆり！",
    unsure: true,
  });
  // A kanji word the splitter didn't know stays as written, and is unsure.
  assert.equal(readingOf(groupPieces([P("溺愛", "名詞,一般,*,*,*,*,*,*")])).unsure, true);
});

test("word help: a noun + する verb finds the noun's entry; the explaining の is grammar", async () => {
  const db = openTestDb((c) => {
    c.prepare("INSERT INTO dict_entries (id, written, reading, senses, common, priority) VALUES ('7', '溺愛', 'できあい', '[{\"pos\":[\"n\",\"vs\"],\"glosses\":[\"doting\"]}]', 0, 99)").run();
    c.prepare("INSERT INTO dict_forms (form, entry_id) VALUES ('溺愛', '7')").run();
  });
  await migrate(db);
  const [dote] = await lookUpWords(db, groupPieces([P("溺愛", "名詞,サ変接続,*,*,*,*,溺愛,デキアイ"), P("する", "動詞,自立,*,*,サ変・スル,基本形,する,スル")]));
  assert.deepEqual([dote.surface, dote.base, dote.entry?.written], ["溺愛する", "溺愛する", "溺愛"]);
  assert.equal(readingOf([dote]).reading, "できあいする", "its own reading, not the noun's");
  const nai = groupPieces([P("い", "動詞,自立,*,*,一段,未然形,いる,イ"), P("ない", "助動詞,*,*,*,特殊・ナイ,基本形,ない,ナイ"), P("の", "名詞,非自立,一般,*,*,*,の,ノ"), P("だ", "助動詞,*,*,*,特殊・ダ,基本形,だ,ダ")]);
  assert.deepEqual(nai.map((w) => [w.surface, w.role]), [
    ["いない", "word"],
    ["の", "grammar"],
    ["だ", "grammar"],
  ]);
});
