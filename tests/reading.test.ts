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
  await updateSeriesInfo(db, seriesId, { synopsis: "  A noble girl remembers her past life.  ", genres: "Otome isekai, Romance" });
  await addSeriesTitle(db, seriesId, "悪役令嬢");
  await addSeriesTitle(db, seriesId, "The Villainess");
  const blank = await addSeriesTitle(db, seriesId, "");
  await setSeriesTitle(db, await addSeriesTitle(db, seriesId, "x"), "Villainess Route");
  await setSeriesTitle(db, blank, " "); // left empty: removed
  const cast = await addSeriesBox(db, seriesId, "Cast");
  await setSeriesBox(db, cast, "Cast", "Claire: the villainess");
  await addSeriesBox(db, seriesId, "Setting"); // nothing written: left out
  await updateBook(db, book.id, { about: "The ball scene." });

  assert.equal(
    await readingContext(db, book.id),
    [
      "Series: Villainess",
      "Also known as: 悪役令嬢; The Villainess; Villainess Route",
      "Synopsis:\nA noble girl remembers her past life.",
      "Genre: Otome isekai, Romance",
      "Cast:\nClaire: the villainess",
      "This chapter: Ch 2",
      "Notes on this chapter:\nThe ball scene.",
    ].join("\n\n"),
  );

  // A book in no series: just its own notes.
  await setBookSeries(db, book.id, null);
  assert.equal(await readingContext(db, book.id), "Book: Ch 2\n\nNotes:\nThe ball scene.");
});

test("upgrading: a Japanese title typed in separately becomes an 'also known as' name", async () => {
  const db = openTestDb(() => {});
  await migrate(db, 9);
  await db.batch([
    { sql: "INSERT INTO series (title, japanese_title, created_at) VALUES ('Villainess', ' 悪役令嬢 ', 1), ('Other', '', 1)" },
    { sql: "INSERT INTO series_titles (series_id, title) VALUES (1, 'The Villainess')" },
  ]);
  await migrate(db);
  const titles = await db.all<{ series_id: number; title: string }>("SELECT series_id, title FROM series_titles ORDER BY id");
  assert.deepEqual(titles.map((r) => [r.series_id, r.title]), [[1, "The Villainess"], [1, "悪役令嬢"]]);
});

test("chapters: the number in a title, however it's written", async () => {
  const { chapterNumber } = await import("../src/reading.ts");
  const cases: [string, string | null][] = [
    ["Chapter 12", "12"],
    ["Koi Story · Ch.3", "3"],
    ["ch 12.5 - Extra", "12.5"],
    ["第１２話", "12"],
    ["悪役令嬢 5話", "5"],
    ["クズな元婚約者を差し置いて、まさかあなたがヤンデレなんですか！？ Chapter 1", "1"],
    ["Vol 2 page 7", "7"],
    ["Chapter 007", "7"],
    ["Prologue", null],
  ];
  for (const [title, n] of cases) assert.equal(chapterNumber(title), n, title);
});

test("chapters: a subtitle only when the title says more than series and number", async () => {
  const { chapterSubtitle } = await import("../src/reading.ts");
  assert.equal(chapterSubtitle("Koi Story · Chapter 3: The Pond", "Koi Story"), "The Pond");
  assert.equal(chapterSubtitle("クズな元婚約者を差し置いて、まさかあなたがヤンデレなんですか！？ Chapter 1", "クズな元婚約者を差し置いて、まさかあなたがヤンデレなんですか！？"), "");
  assert.equal(chapterSubtitle("Chapter 2", "Koi Story"), "");
  assert.equal(chapterSubtitle("第3話 はじまり", "X"), "はじまり");
  assert.equal(chapterSubtitle("Prologue", "Koi Story"), "Prologue");
});

test("chapters: reading order by number (2 before 10), else by title", async () => {
  const { byChapter } = await import("../src/reading.ts");
  const titles = ["Chapter 10", "Extra", "Chapter 2", "Chapter 1.5", "Chapter 1"];
  assert.deepEqual([...titles].map((title) => ({ title })).sort(byChapter).map((b) => b.title), ["Chapter 1", "Chapter 1.5", "Chapter 2", "Chapter 10", "Extra"]);
});

test("time ago, in short steps", async () => {
  const { timeAgo } = await import("../src/reading.ts");
  const MIN = 60_000;
  assert.deepEqual(
    [0, 5 * MIN, 3 * 60 * MIN, 2 * 1440 * MIN, 8 * 1440 * MIN, 40 * 1440 * MIN, 400 * 1440 * MIN].map((ago) => timeAgo(T0 - ago, T0)),
    ["just now", "5m ago", "3h ago", "2d ago", "1w ago", "1mo ago", "1y ago"],
  );
});

test("tag boxes: text to tags and back", async () => {
  const { joinTags, splitTags } = await import("../src/reading.ts");
  assert.deepEqual(splitTags("Romance, Fantasy\nIsekai、悪役令嬢 ,, "), ["Romance", "Fantasy", "Isekai", "悪役令嬢"]);
  assert.deepEqual(splitTags(""), []);
  assert.equal(joinTags([" Romance ", "", "Fantasy"]), "Romance, Fantasy");
});

test("upgrading: a Genre box you'd made becomes the series' genres", async () => {
  const db = openTestDb(() => {});
  await migrate(db, 10);
  await db.batch([
    { sql: "INSERT INTO series (title, created_at) VALUES ('Villainess', 1), ('Other', 1)" },
    { sql: "INSERT INTO series_boxes (series_id, label, text) VALUES (1, ' genre ', 'Otome isekai, Romance'), (1, 'Cast', 'Claire'), (2, 'Genre', '  ')" },
  ]);
  await migrate(db);
  const series = await db.all<{ id: number; genres: string }>("SELECT id, genres FROM series ORDER BY id");
  assert.deepEqual(series.map((s) => s.genres), ["Otome isekai, Romance", ""]);
  const boxes = await db.all<{ label: string }>("SELECT label FROM series_boxes");
  assert.deepEqual(boxes.map((b) => b.label), ["Cast"]);
});

test("context: parts you switch off aren't sent", async () => {
  const { contextText, contextOff } = await import("../src/reading.ts");
  const series = {
    title: "Villainess",
    synopsis: "A noble girl remembers her past life.",
    genres: "Otome isekai",
    titles: [{ id: 1, title: "The Villainess" }],
    boxes: [
      { id: 7, label: "Cast", text: "Claire" },
      { id: 8, label: "Setting", text: "A fantasy kingdom" },
    ],
  };
  assert.equal(contextText({ series, chapter: undefined }).split("\n\n").length, 6);
  const off = ["synopsis", "box:7", "aka"];
  assert.equal(contextText({ series: { ...series, off } }), "Series: Villainess\n\nGenre: Otome isekai\n\nSetting:\nA fantasy kingdom");
  assert.deepEqual(contextOff('["synopsis"]'), ["synopsis"]);
  assert.deepEqual(contextOff("not json"), [], "a broken value sends everything rather than failing");

  // Stored per series and used by readingContext.
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, [{ path: "C:/m/Ch 1", title: "Ch 1", kind: "folder", pages: 3, series: "Villainess" }], T0);
  const [book] = await listBooks(db);
  await updateSeriesInfo(db, book.series_id!, { synopsis: "Secret plot", context_off: JSON.stringify(["synopsis"]) });
  assert.equal(await readingContext(db, book.id), "Series: Villainess\n\nThis chapter: Ch 1");
});

test("bookmarks: one per series, moving with you; gone with its chapter", async () => {
  const { setBookmark, clearBookmark, getBook } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  const ch = (n: number) => ({ path: `C:/m/Ch ${n}`, title: `Ch ${n}`, kind: "folder" as const, pages: 20, series: "Koi" });
  await addBooks(db, [ch(1), ch(2)], T0);
  const [one, two] = await listBooks(db);
  const seriesId = one.series_id!;
  const series = async () => (await listSeries(db))[0];

  await setBookmark(db, seriesId, one.id, "005.jpg", 5);
  await setBookmark(db, seriesId, two.id, "012.jpg", 12); // replaces the first
  assert.deepEqual([(await series()).bookmark_book, (await series()).bookmark_page, (await series()).bookmark_page_no], [two.id, "012.jpg", 12]);
  const book = (await getBook(db, two.id))!;
  assert.deepEqual([book.bookmark_book, book.bookmark_page], [two.id, "012.jpg"], "the reader knows it");

  await clearBookmark(db, seriesId);
  assert.equal((await series()).bookmark_book, null);

  // Taking the chapter out of the series, or off the shelf, takes its bookmark with it.
  await setBookmark(db, seriesId, two.id, "012.jpg", 12);
  await setBookSeries(db, two.id, null);
  assert.equal((await series()).bookmark_book, null);
  await setBookmark(db, seriesId, one.id, "001.jpg", 1);
  await removeBook(db, one.id);
  assert.equal((await series()).bookmark_book, null);
});

test("categories: new things go where you're looking; moving and removing keep everything", async () => {
  const { listCategories, createCategory, renameCategory, deleteCategory, setCategory } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  assert.deepEqual((await listCategories(db)).map((c) => c.name), ["Manga", "Manhwa"], "starting categories");
  const novels = await createCategory(db, "Light novels");
  await addBooks(db, [{ path: "C:/m/Koi/Ch 1", title: "Ch 1", kind: "folder", pages: 9, series: "Koi" }], T0, undefined, novels);
  await addBooks(db, [{ path: "C:/m/One", title: "One shot", kind: "folder", pages: 9 }], T0, undefined, 1);
  const [koi] = await listSeries(db);
  assert.equal(koi.category_id, novels, "a series made from a folder goes into the category");
  const books = await listBooks(db);
  const chapter = books.find((b) => b.title === "Ch 1")!;
  const oneShot = books.find((b) => b.title === "One shot")!;
  assert.equal(chapter.category_id, null, "a chapter goes by its series");
  assert.equal(oneShot.category_id, 1);

  // Taken out of its series, a chapter stays in the series' category.
  await setBookSeries(db, chapter.id, null);
  assert.equal((await listBooks(db)).find((b) => b.id === chapter.id)!.category_id, novels);

  await setCategory(db, { series: koi.id }, 1);
  // A removed series' chapters stay in its category.
  const extras = await createSeries(db, "Extras", T0, novels);
  await setBookSeries(db, oneShot.id, extras);
  await removeSeries(db, extras);
  assert.equal((await listBooks(db)).find((b) => b.id === oneShot.id)!.category_id, novels);
  await renameCategory(db, novels, "Novels");
  assert.deepEqual((await listCategories(db)).map((c) => c.name), ["Manga", "Manhwa", "Novels"]);
  await deleteCategory(db, novels);
  assert.equal((await listBooks(db)).find((b) => b.id === chapter.id)!.category_id, null, "uncategorised, not deleted");
  assert.equal((await listSeries(db))[0].category_id, 1);
  assert.equal((await listBooks(db)).length, 2);
});

test("upgrading: everything already on the shelf is manga", async () => {
  const db = openTestDb(() => {});
  await migrate(db, 13);
  await db.batch([
    { sql: "INSERT INTO series (title, created_at) VALUES ('Koi', 1)" },
    { sql: "INSERT INTO books (title, path, kind, pages, added_at, series_id) VALUES ('Ch 1', 'a', 'folder', 1, 1, 1), ('Loose', 'b', 'folder', 1, 1, NULL)" },
  ]);
  await migrate(db);
  assert.equal((await listSeries(db))[0].category_id, 1);
  const books = await listBooks(db);
  assert.deepEqual(books.map((b) => [b.title, b.category_id]).sort(), [["Ch 1", null], ["Loose", 1]]);
});

test("marks: sections by kind, numbered within, in the order you drag them", async () => {
  const { reorderMarks, markSections, markNumbers, updateMark } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  const book = await addBooks(db, [{ path: "C:/m/A", title: "A", kind: "folder", pages: 3 }], T0).then(async () => (await listBooks(db))[0].id);
  const a = await addMark(db, book, "001.jpg", "speech", BOX, T0);
  const b = await addMark(db, book, "001.jpg", "sfx", BOX, T0);
  const c = await addMark(db, book, "001.jpg", "speech", BOX, T0);
  const other = await addMark(db, book, "002.jpg", "speech", BOX, T0);
  let marks = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markSections(marks).map((s) => [s.kind, s.marks.map((m) => m.id)]), [["speech", [a, c]], ["sfx", [b]]]);
  assert.deepEqual([...markNumbers(marks)], [[a, 1], [c, 2], [b, 1]], "SFX starts its own count");

  await reorderMarks(db, [c, a, b]);
  marks = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markSections(marks)[0].marks.map((m) => m.id), [c, a]);
  // A new mark goes last; one changing kind joins that section in its place.
  const d = await addMark(db, book, "001.jpg", "sfx", BOX, T0);
  await updateMark(db, c, "sfx", { text: "", reading: "", meaning: "", notes: "" }, T0);
  marks = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markSections(marks).map((s) => s.marks.map((m) => m.id)), [[a], [c, b, d]]);
  assert.equal((await pageMarks(db, book, "002.jpg"))[0].id, other);
});

test("upgrading: marks keep the order they were made in", async () => {
  const db = openTestDb(() => {});
  await migrate(db, 14);
  await db.batch([
    { sql: "INSERT INTO books (title, path, kind, pages, added_at) VALUES ('A', 'a', 'folder', 1, 1)" },
    { sql: "INSERT INTO book_marks (book_id, page, kind, x, y, w, h, created_at, updated_at) VALUES (1, 'p', 'speech', 0, 0, 1, 1, 1, 1), (1, 'p', 'speech', 0, 0, 1, 1, 2, 2)" },
  ]);
  await migrate(db);
  assert.deepEqual((await pageMarks(db, 1, "p")).map((m) => [m.id, m.position]), [[1, 1], [2, 2]]);
});

test("marks: one mark can have more boxes (a bubble in two parts)", async () => {
  const { markBoxes, setMoreBoxes } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, [{ path: "C:/m/A", title: "A", kind: "folder", pages: 1 }], T0);
  const book = (await listBooks(db))[0].id;
  const id = await addMark(db, book, "001.jpg", "speech", BOX, T0);
  let [mark] = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markBoxes(mark), [BOX]);
  const second = { x: 0.5, y: 0.6, w: 0.1, h: 0.2 };
  await setMoreBoxes(db, id, [second]);
  [mark] = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markBoxes(mark), [BOX, second]);
  await setMoreBoxes(db, id, []);
  [mark] = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markBoxes(mark), [BOX]);
});

test("marks: boxes move and resize, staying on the page", async () => {
  const { adjustBox, setMarkBox, markBoxes, setMoreBoxes } = await import("../src/reading.ts");
  const box = { x: 0.2, y: 0.2, w: 0.2, h: 0.1 };
  const near = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    assert.ok((["x", "y", "w", "h"] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-9), `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  near(adjustBox(box, "move", 0.1, 0.05), { x: 0.3, y: 0.25, w: 0.2, h: 0.1 });
  near(adjustBox(box, "move", 2, -2), { x: 0.8, y: 0, w: 0.2, h: 0.1 }, );
  near(adjustBox(box, "se", 0.1, 0.1), { x: 0.2, y: 0.2, w: 0.3, h: 0.2 });
  near(adjustBox(box, "w", -0.1, 0.5), { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, );
  near(adjustBox(box, "e", -0.3, 0), { x: 0.1, y: 0.2, w: 0.1, h: 0.1 }); // dragged past the left side: flips
  near(adjustBox(box, "nw", -1, -1), { x: 0, y: 0, w: 0.4, h: 0.3 });

  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, [{ path: "C:/m/A", title: "A", kind: "folder", pages: 1 }], T0);
  const book = (await listBooks(db))[0].id;
  const id = await addMark(db, book, "001.jpg", "speech", BOX, T0);
  await setMoreBoxes(db, id, [BOX]);
  let [mark] = await pageMarks(db, book, "001.jpg");
  const moved = { x: 0.5, y: 0.5, w: 0.1, h: 0.1 };
  const returned = await setMarkBox(db, mark, 1, moved);
  [mark] = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markBoxes(mark), [BOX, moved]);
  assert.deepEqual(markBoxes(returned), [BOX, moved]);
  await setMarkBox(db, mark, 0, moved);
  [mark] = await pageMarks(db, book, "001.jpg");
  assert.deepEqual(markBoxes(mark), [moved, moved]);
});

test("marks: text manga-ocr wasn't sure of stays marked until changed or confirmed", async () => {
  const { updateMark } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, [{ path: "C:/m/A", title: "A", kind: "folder", pages: 1 }], T0);
  const book = (await listBooks(db))[0].id;
  const id = await addMark(db, book, "001.jpg", "sfx", BOX, T0);
  const text = { text: "フッ", reading: "", meaning: "", notes: "" };
  const unsure = async () => (await pageMarks(db, book, "001.jpg"))[0].unsure;
  assert.equal(await unsure(), 0);
  await updateMark(db, id, "sfx", text, T0, true);
  assert.equal(await unsure(), 1);
  await updateMark(db, id, "sfx", { ...text, meaning: "a puff" }, T0);
  assert.equal(await unsure(), 1, "left out: unchanged");
  await updateMark(db, id, "sfx", text, T0, false);
  assert.equal(await unsure(), 0);
});

test("a card's picture: the boxes with room around them, kept on the page", async () => {
  const { aroundBoxes } = await import("../src/reading.ts");
  const near = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    assert.ok((["x", "y", "w", "h"] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-9), `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  near(aroundBoxes([{ x: 0.4, y: 0.4, w: 0.1, h: 0.1 }], 0.5), { x: 0.35, y: 0.35, w: 0.2, h: 0.2 });
  near(aroundBoxes([{ x: 0.0, y: 0.9, w: 0.1, h: 0.1 }, { x: 0.2, y: 0.8, w: 0.1, h: 0.1 }], 1), { x: 0, y: 0.6, w: 0.6, h: 0.4 });
});

test("deck cards can carry a picture", async () => {
  const { addDeckCard, createDeck, deckCards } = await import("../src/decks.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  const deck = await createDeck(db, "Manga words", T0);
  await addDeckCard(db, deck, "溺愛", "できあい\nblind love", null, T0, "data:image/jpeg;base64,AAAA");
  await addDeckCard(db, deck, "もう", "already", null, T0);
  const cards = await deckCards(db, deck);
  assert.deepEqual(cards.map((c) => [c.front, c.image]).sort(), [["もう", null], ["溺愛", "data:image/jpeg;base64,AAAA"]]);
});

test("upgrading: a Manhwa category is added, unless you made one", async () => {
  const { listCategories } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db, 18);
  await db.batch([{ sql: "INSERT INTO categories (name, position) VALUES ('manhwa', 1)" }]);
  await migrate(db);
  assert.deepEqual((await listCategories(db)).map((c) => c.name), ["Manga", "manhwa"]);
});

test("scroll mode is set for a whole series (or a book by itself), and the next chapter follows in order", async () => {
  const { setScrolling, nextChapter, getBook } = await import("../src/reading.ts");
  const db = openTestDb(() => {});
  await migrate(db);
  await addBooks(db, ["Ch 2", "Ch 10", "Ch 1"].map((t) => ({ path: `C:/w/Solo/${t}`, title: t, kind: "folder" as const, pages: 3, series: "Solo" })), T0);
  await addBooks(db, [{ path: "C:/w/Oneshot", title: "Oneshot", kind: "folder", pages: 3 }], T0);
  const books = await listBooks(db);
  const ch = (t: string) => books.find((b) => b.title === t)!;
  await setScrolling(db, ch("Ch 2"), true);
  assert.equal((await getBook(db, ch("Ch 10").id))?.scrolling, 1, "the whole series");
  assert.equal((await getBook(db, ch("Oneshot").id))?.scrolling, 0);
  await setScrolling(db, ch("Oneshot"), true);
  assert.equal((await getBook(db, ch("Oneshot").id))?.scrolling, 1);
  assert.equal((await nextChapter(db, ch("Ch 2")))?.title, "Ch 10");
  assert.equal(await nextChapter(db, ch("Ch 10")), undefined);
  assert.equal(await nextChapter(db, ch("Oneshot")), undefined);
});
