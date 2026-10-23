// Reading: your own manga (folders of page images or .cbz files), read from
// where they are on your PC. You mark speech bubbles, SFX and so on with a box
// and write down what they say and mean; text you've marked before is
// recognised on any page of any book ("seen before"), and everything you've
// marked builds a glossary. Files are only read, by src-tauri/src/books.rs.

import { invoke } from "@tauri-apps/api/core";
import type { Db } from "./db/db.ts";

export type Book = {
  id: number;
  title: string;
  path: string;
  /** made: a chapter you put together from separate images (Koihongo keeps copies). */
  kind: "folder" | "cbz" | "made";
  pages: number;
  /** The page you're on (0-based). */
  page: number;
  right_to_left: number;
  about: string;
  added_at: number;
  opened_at: number | null;
  /** The series it's in, if any. */
  series_id: number | null;
  series_title: string | null;
  /** How many marks it has (listBooks only). */
  marks?: number;
};

/** A book found on disk by book_pick, not on the shelf yet; `series`: the folder of chapters it was in. */
export type FoundBook = { path: string; title: string; kind: Book["kind"]; pages: number; series?: string | null };

/** A series on your bookshelf: a folder-like tile holding its chapters. */
export type Series = {
  id: number;
  /** Its name on your shelf. */
  title: string;
  /** Unused since migration 10 (it became one of its "also known as" names). */
  japanese_title: string;
  synopsis: string;
  /** A cover you picked (a file in Documents\Koihongo\Covers); null: the first chapter's first page. */
  cover: string | null;
  created_at: number;
  chapters: number;
  /** When something in it was last read or added. */
  active: number;
};

/** A series' other titles ("also known as") and your boxes (Cast, Genre…), for its info page. */
export type SeriesExtras = {
  titles: { id: number; title: string }[];
  boxes: { id: number; label: string; text: string }[];
};

/** Boxes offered on a series page, each with a hint of what goes in it. */
export const BOX_IDEAS: { label: string; hint: string }[] = [
  { label: "Cast", hint: "Who's who: names (with readings), roles, how they relate" },
  { label: "Genre", hint: "e.g. otome isekai, villainess, romantic comedy" },
  { label: "Setting", hint: "Where and when: a fantasy kingdom, a modern high school…" },
  { label: "Names and terms", hint: "Made-up words, places, titles and how you'd translate them" },
  { label: "How characters talk", hint: "Formal, rough, a dialect, a verbal tic, what they call each other" },
];

/** "Series · Chapter", or just the book's title when it's in no series. */
const FULL_TITLE = "CASE WHEN s.title IS NULL THEN b.title ELSE s.title || ' · ' || b.title END";

export type MarkKind = "speech" | "sfx" | "sign" | "narration" | "other";

export const MARK_KINDS: { kind: MarkKind; name: string; hint: string }[] = [
  { kind: "speech", name: "Speech", hint: "A speech or thought bubble" },
  { kind: "sfx", name: "SFX", hint: "A sound effect drawn on the page" },
  { kind: "sign", name: "Sign", hint: "Text in the scene: signs, screens, letters…" },
  { kind: "narration", name: "Narration", hint: "A narration box" },
  { kind: "other", name: "Other", hint: "Anything else worth noting" },
];

/** A box on the page; all four are fractions of the page's width or height. */
export type Box = { x: number; y: number; w: number; h: number };

export type Mark = Box & {
  id: number;
  book_id: number;
  page: string;
  kind: MarkKind;
  text: string;
  reading: string;
  meaning: string;
  notes: string;
  created_at: number;
  updated_at: number;
};

export type MarkText = Pick<Mark, "text" | "reading" | "meaning" | "notes">;

// --- Matching text you've seen before ---

const KATAKANA = /[ァ-ヶ]/g;

/**
 * Text written so that the same words match however they're written: width,
 * katakana or hiragana, spaces and punctuation don't matter. SFX are matched
 * more loosely, since they're stretched and repeated freely: ドーン and ドン,
 * ドンッ and ドン, and ゴゴゴゴ and ゴゴゴ all match.
 */
export function textKey(text: string, kind: MarkKind): string {
  let key = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\p{P}\p{S}]/gu, "");
  if (kind === "sfx") {
    key = key
      .replace(/[ー〜]/g, "")
      .replace(/っ+$/, "")
      // Three or more of the same sound count as two: ゴゴゴゴ = ゴゴゴ = ゴゴ, ドキドキドキ = ドキドキ.
      .replace(/(.+?)\1{2,}/gu, "$1$1");
  }
  return key;
}

/** One meaning you gave this text before, and where you last saw it. */
export type SeenBefore = {
  text: string;
  reading: string;
  meaning: string;
  notes: string;
  times: number;
  last: { bookId: number; title: string; page: string };
};

/**
 * Earlier marks with the same text (any book, any kind) that you wrote a
 * meaning for: one entry per different meaning, most recent first.
 */
export async function seenBefore(db: Db, key: string, exceptMarkId: number): Promise<SeenBefore[]> {
  if (!key) return [];
  const rows = await db.all<MarkText & { book_id: number; title: string; page: string }>(
    `SELECT m.text, m.reading, m.meaning, m.notes, m.book_id, ${FULL_TITLE} AS title, m.page
     FROM book_marks m JOIN books b ON b.id = m.book_id LEFT JOIN series s ON s.id = b.series_id
     WHERE m.text_key = ? AND m.id != ? AND m.meaning != ''
     ORDER BY m.updated_at DESC, m.id DESC`,
    [key, exceptMarkId],
  );
  const byMeaning = new Map<string, SeenBefore>();
  for (const r of rows) {
    const id = `${r.reading.trim()}\n${r.meaning.trim().toLowerCase()}`;
    const seen = byMeaning.get(id);
    if (seen) seen.times++;
    else byMeaning.set(id, { ...r, times: 1, last: { bookId: r.book_id, title: r.title, page: r.page } });
  }
  return [...byMeaning.values()];
}

/** Everything you've written down, grouped by text (see textKey). */
export type GlossaryEntry = {
  key: string;
  /** The most recent way it was written. */
  text: string;
  kinds: MarkKind[];
  meanings: { reading: string; meaning: string }[];
  /** Every mark with this text, newest first. */
  places: { markId: number; bookId: number; title: string; page: string }[];
};

/** Your glossary: marked text you've written something for, most recently updated first. */
export async function glossary(db: Db): Promise<GlossaryEntry[]> {
  const rows = await db.all<Mark & { text_key: string; title: string }>(
    `SELECT m.*, ${FULL_TITLE} AS title FROM book_marks m JOIN books b ON b.id = m.book_id LEFT JOIN series s ON s.id = b.series_id
     WHERE m.text_key != '' ORDER BY m.updated_at DESC, m.id DESC`,
  );
  const byKey = new Map<string, GlossaryEntry>();
  for (const r of rows) {
    let entry = byKey.get(r.text_key);
    if (!entry) byKey.set(r.text_key, (entry = { key: r.text_key, text: r.text, kinds: [], meanings: [], places: [] }));
    if (!entry.kinds.includes(r.kind)) entry.kinds.push(r.kind);
    const meaning = r.meaning.trim();
    if (meaning && !entry.meanings.some((m) => m.meaning.toLowerCase() === meaning.toLowerCase() && m.reading === r.reading.trim())) {
      entry.meanings.push({ reading: r.reading.trim(), meaning });
    }
    entry.places.push({ markId: r.id, bookId: r.book_id, title: r.title, page: r.page });
  }
  return [...byKey.values()];
}

// --- The shelf ---

/** Your books, the one you read last first (books added together in the order found), with how many marks each has. */
export async function listBooks(db: Db): Promise<Book[]> {
  return db.all<Book>(
    `SELECT b.*, s.title AS series_title, (SELECT count(*) FROM book_marks m WHERE m.book_id = b.id) AS marks
     FROM books b LEFT JOIN series s ON s.id = b.series_id ORDER BY coalesce(b.opened_at, b.added_at) DESC, b.id`,
  );
}

export async function getBook(db: Db, id: number): Promise<Book | undefined> {
  const [book] = await db.all<Book>("SELECT b.*, s.title AS series_title FROM books b LEFT JOIN series s ON s.id = b.series_id WHERE b.id = ?", [id]);
  return book;
}

/**
 * Puts books on the shelf; ones already there (same place on disk) are left as
 * they are. They go into series `seriesId` if given, or else into the series
 * they were found in (made if you don't have one by that name yet). Returns
 * how many were new.
 */
export async function addBooks(db: Db, found: FoundBook[], now: number, seriesId?: number): Promise<number> {
  const before = await db.all<{ path: string }>("SELECT path FROM books");
  const known = new Set(before.map((b) => b.path));
  const fresh = found.filter((f, i) => !known.has(f.path) && found.findIndex((g) => g.path === f.path) === i);
  const seriesIds = new Map<string, number>();
  if (seriesId === undefined) {
    for (const name of new Set(fresh.flatMap((f) => (f.series ? [f.series] : [])))) seriesIds.set(name, await seriesNamed(db, name, now));
  }
  await db.batch(
    fresh.map((f) => ({
      sql: "INSERT INTO books (title, path, kind, pages, added_at, series_id) VALUES (?, ?, ?, ?, ?, ?)",
      params: [f.title, f.path, f.kind, f.pages, now, seriesId ?? (f.series ? seriesIds.get(f.series)! : null)],
    })),
  );
  return fresh.length;
}

// --- Series ---

/** Your series, with how many chapters each has. */
export async function listSeries(db: Db): Promise<Series[]> {
  return db.all<Series>(
    `SELECT s.*, count(b.id) AS chapters, max(s.created_at, coalesce(max(coalesce(b.opened_at, b.added_at)), 0)) AS active
     FROM series s LEFT JOIN books b ON b.series_id = s.id GROUP BY s.id ORDER BY s.title`,
  );
}

/** Makes a series and returns its id. */
export async function createSeries(db: Db, title: string, now: number): Promise<number> {
  await db.batch([{ sql: "INSERT INTO series (title, created_at) VALUES (?, ?)", params: [title.trim(), now] }]);
  const [{ id }] = await db.all<{ id: number }>("SELECT max(id) AS id FROM series");
  return id;
}

/** Your series called `title` (any capitals), made if there isn't one. */
async function seriesNamed(db: Db, title: string, now: number): Promise<number> {
  const [found] = await db.all<{ id: number }>("SELECT id FROM series WHERE lower(title) = lower(?) ORDER BY id LIMIT 1", [title.trim()]);
  return found?.id ?? createSeries(db, title, now);
}

export async function renameSeries(db: Db, id: number, title: string): Promise<void> {
  await db.batch([{ sql: "UPDATE series SET title = ? WHERE id = ?", params: [title.trim(), id] }]);
}

/** Removes a series; its chapters go back on the shelf by themselves (nothing is deleted). */
export async function removeSeries(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: "UPDATE books SET series_id = NULL WHERE series_id = ?", params: [id] },
    { sql: "DELETE FROM series_titles WHERE series_id = ?", params: [id] },
    { sql: "DELETE FROM series_boxes WHERE series_id = ?", params: [id] },
    { sql: "DELETE FROM series WHERE id = ?", params: [id] },
  ]);
}

// --- A series' info: the context sent with translation requests ---

export async function seriesExtras(db: Db, seriesId: number): Promise<SeriesExtras> {
  const [titles, boxes] = await Promise.all([
    db.all<{ id: number; title: string }>("SELECT id, title FROM series_titles WHERE series_id = ? ORDER BY id", [seriesId]),
    db.all<{ id: number; label: string; text: string }>("SELECT id, label, text FROM series_boxes WHERE series_id = ? ORDER BY id", [seriesId]),
  ]);
  return { titles, boxes };
}

export async function updateSeriesInfo(db: Db, id: number, fields: Partial<Pick<Series, "synopsis">>): Promise<void> {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  await db.batch([{ sql: `UPDATE series SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, params: [...entries.map(([, v]) => v), id] }]);
}

/** Adds an English title (maybe empty, for you to fill in) and returns its id. */
export async function addSeriesTitle(db: Db, seriesId: number, title: string): Promise<number> {
  await db.batch([{ sql: "INSERT INTO series_titles (series_id, title) VALUES (?, ?)", params: [seriesId, title] }]);
  const [{ id }] = await db.all<{ id: number }>("SELECT max(id) AS id FROM series_titles");
  return id;
}

/** Changes an English title; an empty one is removed. */
export async function setSeriesTitle(db: Db, id: number, title: string): Promise<void> {
  await db.batch([
    title.trim()
      ? { sql: "UPDATE series_titles SET title = ? WHERE id = ?", params: [title.trim(), id] }
      : { sql: "DELETE FROM series_titles WHERE id = ?", params: [id] },
  ]);
}

/** Adds a box (Cast, Genre…) and returns its id. */
export async function addSeriesBox(db: Db, seriesId: number, label: string): Promise<number> {
  await db.batch([{ sql: "INSERT INTO series_boxes (series_id, label) VALUES (?, ?)", params: [seriesId, label] }]);
  const [{ id }] = await db.all<{ id: number }>("SELECT max(id) AS id FROM series_boxes");
  return id;
}

export async function setSeriesBox(db: Db, id: number, label: string, text: string): Promise<void> {
  await db.batch([{ sql: "UPDATE series_boxes SET label = ?, text = ? WHERE id = ?", params: [label.trim(), text, id] }]);
}

export async function deleteSeriesBox(db: Db, id: number): Promise<void> {
  await db.batch([{ sql: "DELETE FROM series_boxes WHERE id = ?", params: [id] }]);
}

/** What context there is for a chapter: its series' info (if it's in one) and its own notes. */
export type ContextParts = {
  series?: Pick<Series, "title" | "synopsis"> & SeriesExtras;
  chapter?: { title: string; about: string };
};

/**
 * The context written out as plain text, the way it's sent with a
 * translation request (empty parts are left out).
 */
export function contextText({ series, chapter }: ContextParts): string {
  const parts: string[] = [];
  const add = (label: string, text: string | undefined) => text?.trim() && parts.push(`${label}: ${text.trim()}`);
  const block = (label: string, text: string | undefined) => text?.trim() && parts.push(`${label}:\n${text.trim()}`);
  if (series) {
    add("Series", series.title);
    add("Also known as", series.titles.map((t) => t.title.trim()).filter(Boolean).join("; "));
    block("Synopsis", series.synopsis);
    for (const box of series.boxes) block(box.label.trim() || "Notes", box.text);
  }
  if (chapter) {
    add(series ? "This chapter" : "Book", chapter.title);
    block(series ? "Notes on this chapter" : "Notes", chapter.about);
  }
  return parts.join("\n\n");
}

/** The context for reading this book: its series' info and its own notes, as sent with translation requests. */
export async function readingContext(db: Db, bookId: number): Promise<string> {
  const [book] = await db.all<{ title: string; about: string; series_id: number | null }>("SELECT title, about, series_id FROM books WHERE id = ?", [bookId]);
  if (!book) return "";
  let series: ContextParts["series"];
  if (book.series_id !== null) {
    const [row] = await db.all<Pick<Series, "title" | "synopsis">>("SELECT title, synopsis FROM series WHERE id = ?", [
      book.series_id,
    ]);
    if (row) series = { ...row, ...(await seriesExtras(db, book.series_id)) };
  }
  return contextText({ series, chapter: { title: book.title, about: book.about } });
}

/** Puts a book in a series, or (null) on the shelf by itself. */
export async function setBookSeries(db: Db, bookId: number, seriesId: number | null): Promise<void> {
  await db.batch([{ sql: "UPDATE books SET series_id = ? WHERE id = ?", params: [seriesId, bookId] }]);
}

export async function updateBook(db: Db, id: number, fields: Partial<Pick<Book, "title" | "about" | "right_to_left">>): Promise<void> {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  await db.batch([
    { sql: `UPDATE books SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`, params: [...entries.map(([, v]) => v as string | number), id] },
  ]);
}

/** Remembers where you are in a book (and how many pages it has now). */
export async function savePlace(db: Db, id: number, page: number, pages: number, now: number): Promise<void> {
  await db.batch([{ sql: "UPDATE books SET page = ?, pages = ?, opened_at = ? WHERE id = ?", params: [page, pages, now, id] }]);
}

/** Points a book at its new place on disk (after you moved or renamed it); its marks stay. */
export async function relinkBook(db: Db, id: number, path: string): Promise<void> {
  await db.batch([{ sql: "UPDATE books SET path = ? WHERE id = ?", params: [path, id] }]);
}

/** Takes a book off the shelf with its marks. Its files are not touched. */
export async function removeBook(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM book_marks WHERE book_id = ?", params: [id] },
    { sql: "DELETE FROM books WHERE id = ?", params: [id] },
  ]);
}

// --- Marks ---

/** A page's marks, in the order you made them. */
export async function pageMarks(db: Db, bookId: number, page: string): Promise<Mark[]> {
  return db.all<Mark>("SELECT * FROM book_marks WHERE book_id = ? AND page = ? ORDER BY created_at, id", [bookId, page]);
}

/** Adds an empty mark and returns its id. */
export async function addMark(db: Db, bookId: number, page: string, kind: MarkKind, box: Box, now: number): Promise<number> {
  await db.batch([
    {
      sql: "INSERT INTO book_marks (book_id, page, kind, x, y, w, h, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [bookId, page, kind, box.x, box.y, box.w, box.h, now, now],
    },
  ]);
  const [{ id }] = await db.all<{ id: number }>("SELECT max(id) AS id FROM book_marks");
  return id;
}

/** Saves a mark's text and kind (its text_key follows from both). */
export async function updateMark(db: Db, id: number, kind: MarkKind, fields: MarkText, now: number): Promise<void> {
  await db.batch([
    {
      sql: `UPDATE book_marks SET kind = ?, text = ?, text_key = ?, reading = ?, meaning = ?, notes = ?, updated_at = ? WHERE id = ?`,
      params: [kind, fields.text, textKey(fields.text, kind), fields.reading, fields.meaning, fields.notes, now, id],
    },
  ]);
}

export async function deleteMark(db: Db, id: number): Promise<void> {
  await db.batch([{ sql: "DELETE FROM book_marks WHERE id = ?", params: [id] }]);
}

/** How many marks each page of a book has (pages with none are left out). */
export async function marksPerPage(db: Db, bookId: number): Promise<Record<string, number>> {
  const rows = await db.all<{ page: string; n: number }>("SELECT page, count(*) AS n FROM book_marks WHERE book_id = ? GROUP BY page", [bookId]);
  return Object.fromEntries(rows.map((r) => [r.page, r.n]));
}

// --- Chapters you make from separate images ---

/** Makes a new, empty chapter (its folder is in Documents\Koihongo\Books), in a series if given, and returns its id. */
export async function makeChapter(db: Db, title: string, now: number, seriesId?: number): Promise<number> {
  const made = await invoke<FoundBook>("book_new", { title });
  await addBooks(db, [made], now, seriesId);
  const [{ id }] = await db.all<{ id: number }>("SELECT id FROM books WHERE path = ?", [made.path]);
  return id;
}

/** Asks you for images and copies them in after the last page: the new pages' names, or null if you cancel. */
export function addImages(path: string): Promise<string[] | null> {
  return invoke<string[] | null>("book_add_images", { path });
}

/**
 * Sets a chapter's pages to `pages`, in that order. Pages left out are
 * deleted (Koihongo's copies, not your originals), with their marks.
 */
export async function arrangeChapter(db: Db, book: Pick<Book, "id" | "path">, before: string[], pages: string[]): Promise<void> {
  await invoke("book_arrange", { path: book.path, pages });
  await pagesChanged(db, book.id, before, pages);
}

/** Renames a page of a chapter you made (its marks go with it) and returns its new file name. */
export async function renamePage(db: Db, book: Pick<Book, "id" | "path">, page: string, name: string): Promise<string> {
  const renamed = await invoke<string>("book_rename_page", { path: book.path, page, name });
  await pageRenamed(db, book.id, page, renamed);
  return renamed;
}

/** After a page was renamed: its marks follow it. */
export async function pageRenamed(db: Db, bookId: number, from: string, to: string): Promise<void> {
  await db.batch([{ sql: "UPDATE book_marks SET page = ? WHERE book_id = ? AND page = ?", params: [to, bookId, from] }]);
}

/** After a chapter's pages changed: removed pages lose their marks, and your place stays inside the book. */
export async function pagesChanged(db: Db, bookId: number, before: string[], pages: string[]): Promise<void> {
  const gone = before.filter((p) => !pages.includes(p));
  await db.batch([
    ...gone.map((page) => ({ sql: "DELETE FROM book_marks WHERE book_id = ? AND page = ?", params: [bookId, page] })),
    { sql: "UPDATE books SET pages = ?, page = min(page, max(? - 1, 0)) WHERE id = ?", params: [pages.length, pages.length, bookId] },
  ]);
}

// --- Files (src-tauri/src/books.rs) ---

/** Asks you for a manga folder, or .cbz files: the books found there, or null if you cancel. */
export function pickBooks(kind: "folder" | "files"): Promise<FoundBook[] | null> {
  return invoke<FoundBook[] | null>("book_pick", { kind });
}

/** A book's page names in reading order (fails if the book has moved). */
export function bookPages(path: string): Promise<string[]> {
  return invoke<string[]>("book_pages", { path });
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
};

/** A page as an object URL for <img>; call URL.revokeObjectURL when done with it. */
export async function pageUrl(path: string, name: string): Promise<string> {
  return imageUrl(name, await invoke<ArrayBuffer>("book_page", { path, name }));
}

function imageUrl(name: string, bytes: ArrayBuffer): string {
  const type = IMAGE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
  return URL.createObjectURL(new Blob([bytes], { type }));
}

// --- Series covers you picked ---

/** Asks you for an image and makes it the series' cover (a copy is kept); false if you cancel. */
export async function pickSeriesCover(db: Db, seriesId: number): Promise<boolean> {
  const name = await invoke<string | null>("series_cover_pick", { seriesId });
  if (!name) return false;
  await setSeriesCover(db, seriesId, name);
  return true;
}

/** Back to the first chapter's first page as the cover (the copy is deleted). */
export async function clearSeriesCover(db: Db, seriesId: number): Promise<void> {
  await invoke("series_cover_remove", { seriesId });
  await setSeriesCover(db, seriesId, null);
}

export async function setSeriesCover(db: Db, seriesId: number, name: string | null): Promise<void> {
  await db.batch([{ sql: "UPDATE series SET cover = ? WHERE id = ?", params: [name, seriesId] }]);
}

/** A series cover as an object URL for <img>; call URL.revokeObjectURL when done with it. */
export async function coverUrl(name: string): Promise<string> {
  return imageUrl(name, await invoke<ArrayBuffer>("series_cover", { name }));
}

// --- Chapters in a series ---

/**
 * The chapter number in a title: "Chapter 12", "Ch.12", "ch 12.5", "第12話",
 * "12話", else the last number in it. Full-width digits count. null if none.
 */
export function chapterNumber(title: string): string | null {
  const t = title.normalize("NFKC");
  const m = t.match(/(?:chapter|chap\.?|ch\.?|#|第)\s*(\d+(?:\.\d+)?)/i) ?? t.match(/(\d+(?:\.\d+)?)\s*(?:話|章)/) ?? t.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
  return m ? String(Number(m[1])) : null;
}

/**
 * What a chapter's title says beyond its series and number, e.g. "Koi Story ·
 * Chapter 3: The Pond" → "The Pond"; "" when that's all it says.
 */
export function chapterSubtitle(title: string, seriesTitle: string): string {
  let t = title.normalize("NFKC").trim();
  const series = seriesTitle.normalize("NFKC").trim();
  if (series && t.toLowerCase().startsWith(series.toLowerCase())) t = t.slice(series.length);
  t = t.replace(/(?:chapter|chap\.?|ch\.?|#|第)\s*\d+(?:\.\d+)?\s*(?:話|章)?/i, "").replace(/^\s*\d+(?:\.\d+)?\s*(?:話|章)?(?=\s|$|[:·\-–—])/, "");
  return t.replace(/^[\s·:\-–—|]+|[\s·:\-–—|]+$/g, "");
}

/** Chapters in reading order: by number when both have one, else by title (2 before 10). */
export function byChapter(a: Pick<Book, "title">, b: Pick<Book, "title">): number {
  const x = chapterNumber(a.title);
  const y = chapterNumber(b.title);
  if (x !== null && y !== null && Number(x) !== Number(y)) return Number(x) - Number(y);
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

/** "just now", "5m ago", "3h ago", "2d ago", "1w ago", "4mo ago", "2y ago". */
export function timeAgo(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
