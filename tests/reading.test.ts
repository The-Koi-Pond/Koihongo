import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import {
  addBooks,
  addSeriesBox,
  addSeriesTitle,
  createSeries,
  addMark,
  deleteMark,
  glossary,
  listSeries,
  listBooks,
  marksPerPage,
  pageMarks,
  pageRenamed,
  pagesChanged,
  readingContext,
  relinkBook,
  removeBook,
  removeSeries,
  savePlace,
  seenBefore,
  setBookSeries,
  setSeriesBox,
  setSeriesTitle,
  textKey,
  updateBook,
  updateMark,
  updateSeriesInfo,
  type MarkKind,
} from "../src/reading.ts";
import { openTestDb } from "./nodeDb.ts";

const T0 = new Date("2026-03-02T10:00:00").getTime();
const BOX = { x: 0.1, y: 0.1, w: 0.2, h: 0.1 };

async function setup() {
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(
    db,
    [
      { path: "C:/manga/Koi Story/Chapter 1", title: "Koi Story · Chapter 1", kind: "folder", pages: 20 },
      { path: "C:/manga/Other.cbz", title: "Other", kind: "cbz", pages: 30 },
    ],
    T0,
  );
  const [koi, other] = await listBooks(db); // added together: in the order found
  return { db, koi: koi.id, other: other.id };
}

async function mark(db: Awaited<ReturnType<typeof setup>>["db"], book: number, page: string, kind: MarkKind, text: string, meaning = "", at = T0) {
  const id = await addMark(db, book, page, kind, BOX, at);
  await updateMark(db, id, kind, { text, reading: "", meaning, notes: "" }, at);
  return id;
}

test("text keys: the same words match however they're written", () => {
  assert.equal(textKey("ドン！", "speech"), textKey("どん", "speech"));
  assert.equal(textKey("ｶﾞｯ", "speech"), textKey("ガッ", "speech"), "half-width katakana");
  assert.equal(textKey(" お は よ う 。", "speech"), "おはよう");
  // SFX stretch and repeat freely.
  for (const same of ["ドーン", "ドンッ", "ドン!!", "どん"]) assert.equal(textKey(same, "sfx"), textKey("ドン", "sfx"), same);
  assert.equal(textKey("ゴゴゴゴゴ", "sfx"), textKey("ゴゴゴ", "sfx"));
  assert.equal(textKey("ドキドキドキ", "sfx"), textKey("ドキドキ", "sfx"));
  // ...but words in speech keep their long vowels and doubles.
  assert.notEqual(textKey("ビール", "speech"), textKey("ビル", "speech"));
  assert.notEqual(textKey("ここ", "sfx"), textKey("こ", "sfx"));
});

test("the shelf: adding the same place twice keeps one book", async () => {
  const { db } = await setup();
  const added = await addBooks(db, [{ path: "C:/manga/Other.cbz", title: "Other again", kind: "cbz", pages: 30 }], T0 + 1);
  assert.equal(added, 0);
  assert.equal((await listBooks(db)).length, 2);
});

test("the shelf: the book you read last comes first, with its mark count", async () => {
  const { db, koi } = await setup();
  await mark(db, koi, "001.jpg", "sfx", "ドン");
  await savePlace(db, koi, 4, 21, T0 + 1000);
  const [first] = await listBooks(db);
  assert.deepEqual({ id: first.id, page: first.page, pages: first.pages, marks: first.marks }, { id: koi, page: 4, pages: 21, marks: 1 });
});

test("marks: a page's marks in the order made; saving keeps the box", async () => {
  const { db, koi } = await setup();
  const a = await mark(db, koi, "001.jpg", "speech", "おはよう", "good morning");
  const b = await mark(db, koi, "001.jpg", "sfx", "ドン", "", T0 + 1);
  await mark(db, koi, "002.jpg", "sfx", "ゴゴゴ");
  const marks = await pageMarks(db, koi, "001.jpg");
  assert.deepEqual(marks.map((m) => m.id), [a, b]);
  assert.deepEqual({ x: marks[0].x, w: marks[0].w, meaning: marks[0].meaning }, { x: 0.1, w: 0.2, meaning: "good morning" });
  await deleteMark(db, b);
  assert.equal((await pageMarks(db, koi, "001.jpg")).length, 1);
});

test("seen before: across books, one entry per meaning, without the mark itself", async () => {
  const { db, koi, other } = await setup();
  await mark(db, koi, "003.jpg", "sfx", "ドーン", "boom (explosion)", T0);
  await mark(db, koi, "009.jpg", "sfx", "ドン", "boom (explosion)", T0 + 1);
  await mark(db, other, "012.jpg", "sfx", "ドンッ", "thud (a door slamming)", T0 + 2);
  await mark(db, koi, "010.jpg", "sfx", "ドン", ""); // no meaning yet: not a suggestion
  const now = await mark(db, other, "020.jpg", "sfx", "ドン!!");

  const seen = await seenBefore(db, textKey("ドン!!", "sfx"), now);
  assert.deepEqual(
    seen.map((s) => [s.meaning, s.times, s.last.title, s.last.page]),
    [
      ["thud (a door slamming)", 1, "Other", "012.jpg"],
      ["boom (explosion)", 2, "Koi Story · Chapter 1", "009.jpg"],
    ],
  );
  assert.deepEqual(await seenBefore(db, "", now), [], "empty text matches nothing");
});

test("glossary: grouped by text, with every place it was seen", async () => {
  const { db, koi, other } = await setup();
  await mark(db, koi, "001.jpg", "sfx", "ゴゴゴ", "menacing rumble", T0);
  await mark(db, other, "005.jpg", "sfx", "ゴゴゴゴ", "menacing rumble", T0 + 1);
  await mark(db, other, "006.jpg", "speech", "ありがとう", "thank you", T0 + 2);
  await addMark(db, koi, "002.jpg", "speech", BOX, T0); // nothing written yet: left out
  const entries = await glossary(db);
  assert.deepEqual(entries.map((e) => e.text), ["ありがとう", "ゴゴゴゴ"]);
  assert.deepEqual(entries[1].meanings, [{ reading: "", meaning: "menacing rumble" }]);
  assert.deepEqual(entries[1].places.map((p) => p.title), ["Other", "Koi Story · Chapter 1"]);
});

test("a moved book keeps its marks; removing a book removes only its marks", async () => {
  const { db, koi, other } = await setup();
  await mark(db, koi, "001.jpg", "sfx", "ドン");
  await mark(db, other, "001.jpg", "sfx", "ドン");
  await relinkBook(db, koi, "D:/manga/Koi Story/Chapter 1");
  assert.equal((await pageMarks(db, koi, "001.jpg")).length, 1);
  await removeBook(db, koi);
  assert.deepEqual((await listBooks(db)).map((b) => b.id), [other]);
  assert.equal((await pageMarks(db, other, "001.jpg")).length, 1);
});

test("a chapter you made: removing a page removes its marks, and your place stays inside the book", async () => {
  const { db, koi, other } = await setup();
  await mark(db, koi, "a.png", "sfx", "ドン");
  await mark(db, koi, "b.png", "sfx", "ゴゴゴ");
  await mark(db, koi, "b.png", "speech", "なに？");
  await mark(db, other, "b.png", "sfx", "ドン"); // another book's page with the same name
  assert.deepEqual(await marksPerPage(db, koi), { "a.png": 1, "b.png": 2 });
  await savePlace(db, koi, 2, 3, T0);

  await pagesChanged(db, koi, ["a.png", "b.png", "c.png"], ["a.png"]);
  assert.deepEqual(await marksPerPage(db, koi), { "a.png": 1 });
  assert.deepEqual(await marksPerPage(db, other), { "b.png": 1 });
  const book = (await listBooks(db)).find((b) => b.id === koi)!;
  assert.deepEqual({ pages: book.pages, page: book.page }, { pages: 1, page: 0 });
});

test("a renamed page keeps its marks (only that book's)", async () => {
  const { db, koi, other } = await setup();
  await mark(db, koi, "scan 3.png", "sfx", "ドン");
  await mark(db, other, "scan 3.png", "sfx", "ドン");
  await pageRenamed(db, koi, "scan 3.png", "cover.png");
  assert.deepEqual(await marksPerPage(db, koi), { "cover.png": 1 });
  assert.deepEqual(await marksPerPage(db, other), { "scan 3.png": 1 });
});

test("series: a folder of chapters makes its series once; chapters can move in and out", async () => {
  const db = openTestDb(() => {});
  await migrate(db);
  const found = (n: number) => ({ path: `C:/manga/Koi/Ch ${n}`, title: `Ch ${n}`, kind: "folder" as const, pages: 5, series: "Koi" });
  await addBooks(db, [found(1), found(2)], T0);
  await addBooks(db, [{ ...found(3), series: "KOI" }], T0 + 1); // same series, any capitals
  await addBooks(db, [{ path: "C:/manga/One shot", title: "One shot", kind: "folder", pages: 9 }], T0 + 2);
  let series = await listSeries(db);
  assert.deepEqual(series.map((s) => [s.title, s.chapters]), [["Koi", 3]]);
  const books = await listBooks(db);
  assert.deepEqual(books.filter((b) => b.series_title === "Koi").map((b) => b.title).sort(), ["Ch 1", "Ch 2", "Ch 3"]);

  // Seen before and the glossary name the series.
  const ch1 = books.find((b) => b.title === "Ch 1")!.id;
  await mark(db, ch1, "001.jpg", "sfx", "ドン", "boom");
  assert.equal((await glossary(db))[0].places[0].title, "Koi · Ch 1");

  // A series you make yourself, and adding straight into it.
  const extras = await createSeries(db, "Extras", T0 + 3);
  await addBooks(db, [{ path: "C:/manga/Koi/Omake", title: "Omake", kind: "folder", pages: 2, series: "Koi" }], T0 + 4, extras);
  const oneShot = books.find((b) => b.title === "One shot")!.id;
  await setBookSeries(db, oneShot, extras);
  series = await listSeries(db);
  assert.deepEqual(series.map((s) => [s.title, s.chapters]), [["Extras", 2], ["Koi", 3]]);

  // Removing a series keeps its chapters, back on the shelf.
  await removeSeries(db, extras);
  assert.deepEqual((await listSeries(db)).map((s) => s.title), ["Koi"]);
  assert.equal((await listBooks(db)).length, 5);
  assert.equal((await listBooks(db)).find((b) => b.id === oneShot)!.series_id, null);
});

test("series info becomes the context sent with translation requests", async () => {
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, [{ path: "C:/m/Ch 2", title: "Ch 2", kind: "folder", pages: 3, series: "Villainess" }], T0);
  const [book] = await listBooks(db);
  const seriesId = book.series_id!;
  await updateSeriesInfo(db, seriesId, { japanese_title: "悪役令嬢", synopsis: "  A noble girl remembers her past life.  " });
  await addSeriesTitle(db, seriesId, "The Villainess");
  const blank = await addSeriesTitle(db, seriesId, "");
  await setSeriesTitle(db, await addSeriesTitle(db, seriesId, "x"), "Villainess Route");
  await setSeriesTitle(db, blank, " "); // left empty: removed
  const cast = await addSeriesBox(db, seriesId, "Cast");
  await setSeriesBox(db, cast, "Cast", "Claire: the villainess");
  await addSeriesBox(db, seriesId, "Genre"); // nothing written: left out
  await updateBook(db, book.id, { about: "The ball scene." });

  assert.equal(
    await readingContext(db, book.id),
    [
      "Series: Villainess",
      "Japanese title: 悪役令嬢",
      "Also known as: The Villainess; Villainess Route",
      "Synopsis:\nA noble girl remembers her past life.",
      "Cast:\nClaire: the villainess",
      "This chapter: Ch 2",
      "Notes on this chapter:\nThe ball scene.",
    ].join("\n\n"),
  );

  // A book in no series: just its own notes.
  await setBookSeries(db, book.id, null);
  assert.equal(await readingContext(db, book.id), "Book: Ch 2\n\nNotes:\nThe ball scene.");
});
