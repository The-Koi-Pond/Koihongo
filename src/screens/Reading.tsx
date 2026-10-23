import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileArchive,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  ImageUp,
  Images,
  Info,
  NotebookText,
  Pencil,
  Plus,
  Search,
  SkipBack,
  SquarePlus,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  UnfoldHorizontal,
  ZoomIn,
  ZoomOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { tauriDb } from "../db/tauriDb.ts";
import {
  addBooks,
  addImages,
  addMark,
  adjustBox,
  addSeriesBox,
  addSeriesTitle,
  arrangeChapter,
  bookPages,
  byChapter,
  clearBookmark,
  chapterNumber,
  chapterSubtitle,
  clearSeriesCover,
  createCategory,
  BOX_IDEAS,
  contextOff,
  contextText,
  coverUrl,
  createSeries,
  deleteCategory,
  deleteMark,
  deleteSeriesBox,
  getBook,
  glossary,
  joinTags,
  listBooks,
  listCategories,
  listSeries,
  makeChapter,
  MARK_KINDS,
  markBoxes,
  markNumbers,
  markSections,
  marksPerPage,
  pageMarks,
  pageUrl,
  pickBooks,
  pickSeriesCover,
  relinkBook,
  removeBook,
  removeSeries,
  renameCategory,
  reorderMarks,
  renamePage,
  renameSeries,
  savePlace,
  seenBefore,
  seriesExtras,
  seriesParts,
  setBookmark,
  setCategory,
  setMarkBox,
  setMoreBoxes,
  sfxDictionary,
  setBookSeries,
  setSeriesBox,
  setSeriesTitle,
  splitTags,
  textKey,
  timeAgo,
  updateBook,
  updateMark,
  updateSeriesInfo,
  type Book,
  type Box,
  type BoxGrip,
  type Category,
  type ContextPart,
  type GlossaryEntry,
  type Mark,
  type MarkKind,
  type MarkText,
  type SeenBefore,
  type Series,
  type SfxMeaning,
  type SeriesExtras,
} from "../reading.ts";

type View = { mode: "shelf"; series?: number } | { mode: "book"; id: number; page?: string } | { mode: "pages"; id: number } | { mode: "glossary" };

/** Reading: your bookshelf (or one series on it), a book open in the reader, a chapter's page editor, or your glossary. */
export function Reading() {
  const [view, setView] = useState<View>({ mode: "shelf" });
  const [category, setCategory] = useState<CategoryTab>(loadCategoryTab);
  const chooseCategory = (tab: CategoryTab) => {
    setCategory(tab);
    saveCategoryTab(tab);
  };
  /** The shelf you came from (a series, or the whole shelf), for the reader's back button. */
  const [from, setFrom] = useState<number>();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const shelf = (series?: number) => {
    setFrom(series);
    setView({ mode: "shelf", series });
  };
  if (view.mode === "book") {
    const id = view.id;
    return <Reader key={`${id}:${view.page}`} id={id} startPage={view.page} onBack={() => shelf(from)} onEditPages={() => setView({ mode: "pages", id })} />;
  }
  if (view.mode === "pages") return <PageEditor id={view.id} onBack={() => shelf(from)} onRead={() => setView({ mode: "book", id: view.id })} />;
  if (view.mode === "glossary") return <Glossary onBack={() => shelf()} onOpen={(id, page) => setView({ mode: "book", id, page })} />;
  return (
    <Shelf
      key={view.series ?? "top"}
      seriesId={view.series}
      onSeries={shelf}
      onOpen={(id, page) => setView({ mode: "book", id, page })}
      onMade={(id) => setView({ mode: "pages", id })}
      onGlossary={() => setView({ mode: "glossary" })}
      category={category}
      onCategory={chooseCategory}
    />
  );
}

/** A bookshelf tab: everything, a category's id, or the uncategorised. */
type CategoryTab = "all" | "none" | number;
const CATEGORY_KEY = "koihongo.readingCategory";

function loadCategoryTab(): CategoryTab {
  try {
    const saved = localStorage.getItem(CATEGORY_KEY);
    return saved === null || saved === "all" ? "all" : saved === "none" ? "none" : Number(saved) || "all";
  } catch {
    return "all";
  }
}

function saveCategoryTab(tab: CategoryTab) {
  try {
    localStorage.setItem(CATEGORY_KEY, String(tab));
  } catch {
    // Not remembered this time; harmless.
  }
}

/** Where a page is, for people: "ch1/012.jpg" → "p. 12", "cover.jpg" → "cover". */
function pageLabel(page: string): string {
  const name = pageStem(page);
  return /^\d+$/.test(name) ? `p. ${Number(name)}` : name;
}

/** A page's name without its folder and file type: "ch1/cover.jpg" → "cover". */
function pageStem(page: string): string {
  return page.split("/").pop()!.replace(/\.[^.]+$/, "");
}

/** True while typing in a text box (so arrow keys move the cursor, not the page). */
function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const naturally = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

// --- The bookshelf ---

/**
 * The whole shelf (series and the books in no series, the most recently
 * read first), or one series (`seriesId`: its chapters in order).
 */
function Shelf({
  seriesId,
  onSeries,
  onOpen,
  onMade,
  onGlossary,
  category: chosen,
  onCategory,
}: {
  seriesId?: number;
  /** The category tab shown on the whole shelf. */
  category: CategoryTab;
  onCategory: (tab: CategoryTab) => void;
  onSeries: (id?: number) => void;
  /** Opens a book, at `page` if given (a bookmark). */
  onOpen: (id: number, page?: string) => void;
  /** Opens a chapter you made in the page editor (just made, or its pencil clicked). */
  onMade: (id: number) => void;
  onGlossary: () => void;
}) {
  const [books, setBooks] = useState<Book[]>();
  const [series, setSeries] = useState<Series[]>();
  const [categories, setCategories] = useState<Category[]>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  /** A name being typed: for a new chapter, a new series, or renaming this series. */
  const [naming, setNaming] = useState<{ what: "chapter" | "series" | "rename"; text: string }>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  /** The chapter whose title is being edited, in the series' list. */
  const [renamingChapter, setRenamingChapter] = useState<number>();
  const load = useCallback(() => {
    Promise.all([listBooks(tauriDb), listSeries(tauriDb), listCategories(tauriDb)])
      .then(([b, s, c]) => {
        setBooks(b);
        setSeries(s);
        setCategories(c);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  const current = series?.find((s) => s.id === seriesId);
  // A tab for a category that's gone (or not loaded yet) shows everything.
  const category: CategoryTab = typeof chosen === "number" && categories && !categories.some((c) => c.id === chosen) ? "all" : chosen;
  /** Where new things go: the category you're looking at. */
  const newCategory = typeof category === "number" ? category : null;
  const { drag, dragHandlers } = useShelfDrag(async (item, target) => {
    try {
      if (target.startsWith("cat:")) {
        const to = target === "cat:none" ? null : Number(target.slice(4));
        const now = "book" in item ? item.book.category_id : item.series.category_id;
        if (to === now) return;
        await setCategory(tauriDb, "book" in item ? { book: item.book.id } : { series: item.series.id }, to);
        setMessage(`Moved ${dragTitle(item)} to ${categories?.find((c) => c.id === to)?.name ?? "Uncategorised"}.`);
      } else if ("book" in item) {
        const to = target === "shelf" ? null : Number(target);
        if (to === item.book.series_id) return;
        await setBookSeries(tauriDb, item.book.id, to);
        setMessage(to === null ? `Took ${item.book.title} out of ${current?.title ?? "its series"}.` : `Moved ${item.book.title} into ${series?.find((s) => s.id === to)?.title}.`);
      } else return; // a series dropped on a series
      load();
    } catch (e) {
      setError(String(e));
    }
  });
  const dropClass = (target: string) => (drag?.over === target ? "drop-over" : drag ? "drop-ready" : "");

  async function add(kind: "folder" | "files") {
    setError(undefined);
    setMessage(undefined);
    try {
      const found = await pickBooks(kind);
      if (!found) return; // cancelled
      if (found.length === 0) {
        setMessage("No pages found there. Pick a folder with page images in it (or with chapter folders inside), or .cbz files.");
        return;
      }
      const added = await addBooks(tauriDb, found, Date.now(), seriesId, newCategory);
      const already = found.length - added;
      const into = current?.title ?? (found.every((f) => f.series && f.series === found[0].series) ? found[0].series : undefined);
      setMessage(
        [
          added > 0 && `Added ${added} ${added === 1 ? "book" : "books"}${into ? ` to ${into}` : ""}.`,
          already > 0 && `${already} already on your shelf.`,
        ]
          .filter(Boolean)
          .join(" "),
      );
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    const text = naming?.text.trim();
    if (!naming || !text) return;
    try {
      if (naming.what === "chapter") return onMade(await makeChapter(tauriDb, text, Date.now(), seriesId, newCategory));
      if (naming.what === "series") {
        const id = await createSeries(tauriDb, text, Date.now(), newCategory);
        return onSeries(id);
      }
      if (seriesId !== undefined) await renameSeries(tauriDb, seriesId, text);
      setNaming(undefined);
      load();
    } catch (err) {
      setError(String(err));
    }
  }

  // What's on this shelf: tiles for series and books.
  type Tile = { series: Series; chapters: Book[] } | { book: Book };
  const tiles: Tile[] = [];
  if (books && series) {
    if (current) {
      for (const b of books.filter((b) => b.series_id === current.id).sort(byChapter)) tiles.push({ book: b });
    } else {
      const recent = (t: Tile) => ("book" in t ? (t.book.opened_at ?? t.book.added_at) : t.series.active);
      for (const s of series) tiles.push({ series: s, chapters: books.filter((b) => b.series_id === s.id).sort((x, y) => naturally(x.title, y.title)) });
      for (const b of books.filter((b) => b.series_id === null)) tiles.push({ book: b });
      tiles.sort((a, b) => recent(b) - recent(a));
    }
  }
  const tileCategory = (t: Tile) => ("book" in t ? t.book.category_id : t.series.category_id);
  const inTab = (t: Tile, tab: CategoryTab) => tab === "all" || (tab === "none" ? tileCategory(t) === null : tileCategory(t) === tab);
  const shown = current ? tiles : tiles.filter((t) => inTab(t, category));
  const counts = new Map<CategoryTab, number>([["all", tiles.length], ["none", tiles.filter((t) => tileCategory(t) === null).length]]);
  for (const c of categories ?? []) counts.set(c.id, tiles.filter((t) => tileCategory(t) === c.id).length);

  const naming_form = naming && (
    <form className="deck-new make-chapter" onSubmit={submitName}>
      <input
        autoFocus
        value={naming.text}
        onChange={(e) => setNaming({ ...naming, text: e.target.value })}
        onKeyDown={(e) => e.key === "Escape" && setNaming(undefined)}
        placeholder={naming.what === "chapter" ? "Name it, e.g. Chapter 3" : naming.what === "series" ? "The manga's name, e.g. Koi Story" : "Series name"}
        aria-label={naming.what === "chapter" ? "New chapter name" : naming.what === "series" ? "New series name" : "Series name"}
      />
      <button type="submit" className="primary" disabled={!naming.text.trim()}>
        {naming.what === "rename" ? "Rename" : "Make it"}
      </button>
      {naming.what === "chapter" && (
        <p className="muted make-chapter-hint">
          For pages that aren't in one folder: you add the images one or a few at a time and put them in order. Koihongo keeps its own copies in
          Documents\Koihongo\Books.
        </p>
      )}
      {naming.what === "series" && (
        <p className="muted make-chapter-hint">A series holds its chapters together on your shelf. No files are moved.</p>
      )}
    </form>
  );
  const toggle = (what: "chapter" | "series" | "rename", text = "") => setNaming(naming?.what === what ? undefined : { what, text });
  const addItems = [
    { icon: FolderOpen, text: "Add a folder", onClick: () => add("folder") },
    { icon: FileArchive, text: "Add .cbz files", onClick: () => add("files") },
    { icon: ImagePlus, text: "Make a chapter", onClick: () => setNaming({ what: "chapter", text: "" }) },
    { icon: FolderPlus, text: "New series", onClick: () => setNaming({ what: "series", text: "" }) },
  ];

  return (
    <>
      {current ? (
        <>
          {/* Back on the left, removing the series on the right. */}
          <div className="series-top">
            <button
              type="button"
              className={`deck-back ${dropClass("shelf")}`}
              onClick={() => onSeries()}
              data-drop="shelf"
              title="Back to the bookshelf. Drop a chapter here to take it out of this series."
            >
              <ArrowLeft size={16} aria-hidden="true" /> Bookshelf
            </button>
            <button
              type="button"
              className={`series-remove ${confirmRemove ? "danger" : ""}`}
              onClick={async () => {
                if (!confirmRemove) return setConfirmRemove(true);
                if (current.cover) await clearSeriesCover(tauriDb, current.id);
                await removeSeries(tauriDb, current.id);
                onSeries();
              }}
              onBlur={() => setConfirmRemove(false)}
            >
              <Trash2 size={16} strokeWidth={2.25} aria-hidden="true" /> {confirmRemove ? "Click again: chapters go back on the shelf" : "Remove series"}
            </button>
          </div>
          <h1 className="series-title">
            <FolderClosed size={26} strokeWidth={2} aria-hidden="true" /> {current.title}
            <button type="button" className="icon-action" onClick={() => toggle("rename", current.title)} title="Rename this series" aria-label="Rename series">
              <Pencil size={15} strokeWidth={1.75} />
            </button>
          </h1>
          {naming?.what === "rename" && naming_form}
          <SeriesInfo
            key={current.id}
            series={current}
            first={tiles.flatMap((t) => ("book" in t && t.book.pages > 0 ? [t.book] : []))[0]}
            onCoverChanged={load}
            chapters={tiles.flatMap((t) => ("book" in t ? [t.book] : []))}
            onOpen={onOpen}
          />
          <h2 className="series-chapters">
            Chapters <span className="series-chapters-count">{current.chapters}</span>
          </h2>
        </>
      ) : (
        <>
          <div className="reading-top">
            <h1>
              <span lang="ja">読書</span> Reading
            </h1>
            <button type="button" onClick={onGlossary}>
              <NotebookText size={16} strokeWidth={2.25} aria-hidden="true" /> Glossary
            </button>
          </div>
          <p className="muted reading-intro">
            Read your own manga with help. Mark speech bubbles and sound effects, write down what they say, and anything you've written down before
            is recognised on every page. Your files stay where they are; Koihongo only reads them.
          </p>
        </>
      )}
      {!current && categories && (
        <CategoryTabs
          categories={categories}
          active={category}
          counts={counts}
          dropClass={dropClass}
          onChoose={onCategory}
          onChanged={(choose) => {
            if (choose !== undefined) onCategory(choose);
            load();
          }}
          onError={(e) => setError(String(e))}
        />
      )}
      {naming?.what !== "rename" && naming_form}
      {message && <p className="reading-message">{message}</p>}
      {error && <p className="error">{error}</p>}
      {books && series && shown.length === 0 && (
        <p className="muted">
          {current
            ? "No chapters yet. Use the + below to add folders or .cbz files, or make a chapter from separate images: they go straight into this series. Or move a book in from its ⓘ panel."
            : tiles.length === 0
              ? "No books yet. Use + Add for a folder of page images (a folder of chapter folders becomes a series), .cbz files, or a chapter made from separate images."
              : "Nothing here yet. Anything you add while this tab is open goes in it, or drag a book or series onto its tab."}
        </p>
      )}
      {!current && tiles.length > 0 && (
        <p className="muted shelf-hint">Drag a book onto a series to put it in, or a book or series onto a tab to move it to that category.</p>
      )}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {dragTitle(drag.item)}
        </div>
      )}
      {current && (
        <ul className={`chapter-list ${drag ? "dragging" : ""}`}>
          {tiles.flatMap((t) => ("book" in t ? [t.book] : [])).map((b) => (
            <li key={b.id}>
              {renamingChapter === b.id ? (
                <ChapterRename
                  title={b.title}
                  onDone={(title) => {
                    setRenamingChapter(undefined);
                    if (title.trim() && title.trim() !== b.title)
                      updateBook(tauriDb, b.id, { title: title.trim() })
                        .then(load)
                        .catch((e) => setError(String(e)));
                  }}
                  onCancel={() => setRenamingChapter(undefined)}
                />
              ) : (
                <>
                  <ChapterBar
                    book={b}
                    seriesTitle={current.title}
                    dragging={!!drag && "book" in drag.item && drag.item.book.id === b.id}
                    onOpen={() => onOpen(b.id)}
                    dragHandlers={dragHandlers({ book: b })}
                    tools={b.kind === "made" ? 2 : 1}
                  />
                  <span className="chapter-tools">
                    <button type="button" className="icon-action" onClick={() => setRenamingChapter(b.id)} title="Rename this chapter" aria-label={`Rename ${b.title}`}>
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    {/* Chapters you made can have their pages edited (your own folders and .cbz files are never changed). */}
                    {b.kind === "made" && (
                      <button
                        type="button"
                        className="icon-action"
                        onClick={() => onMade(b.id)}
                        title="Edit pages: add, reorder, rename or remove"
                        aria-label={`Edit the pages of ${b.title}`}
                      >
                        <Images size={15} strokeWidth={2} />
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
          {books && (
            <li>
              <AddMenu label="Add chapters" items={addItems.slice(0, 3)} />
            </li>
          )}
        </ul>
      )}
      {!current && (
        <ul className={`shelf ${drag ? "dragging" : ""}`}>
          {shown.map((t) =>
            "series" in t ? (
              <li key={`s${t.series.id}`}>
                <button
                  type="button"
                  className={`shelf-book shelf-series ${dropClass(String(t.series.id))} ${drag && "series" in drag.item && drag.item.series.id === t.series.id ? "drag-source" : ""}`}
                  onClick={() => onSeries(t.series.id)}
                  data-drop={t.series.id}
                  {...dragHandlers({ series: t.series })}
                >
                  <SeriesCover series={t.series} first={t.chapters.find((b) => b.pages > 0)} />
                  <span className="shelf-title">
                    <FolderClosed size={15} strokeWidth={2.25} aria-hidden="true" /> {t.series.title}
                  </span>
                  <span className="shelf-meta">
                    {t.series.chapters} {t.series.chapters === 1 ? "chapter" : "chapters"}
                  </span>
                </button>
              </li>
            ) : (
              <li key={t.book.id}>
                <button
                  type="button"
                  className={`shelf-book ${drag && "book" in drag.item && drag.item.book.id === t.book.id ? "drag-source" : ""}`}
                  onClick={() => onOpen(t.book.id)}
                  {...dragHandlers({ book: t.book })}
                >
                  <Cover book={t.book} />
                  <span className="shelf-title">{t.book.title}</span>
                  <span className="shelf-meta">
                    {t.book.pages === 0
                      ? "No pages yet"
                      : t.book.opened_at
                        ? `Page ${t.book.page + 1} of ${t.book.pages}`
                        : `${t.book.pages} ${t.book.pages === 1 ? "page" : "pages"}`}
                    {!!t.book.marks && ` · ${t.book.marks} ${t.book.marks === 1 ? "mark" : "marks"}`}
                  </span>
                  <span className="shelf-progress" aria-hidden="true">
                    <span style={{ width: `${t.book.opened_at && t.book.pages ? ((t.book.page + 1) / t.book.pages) * 100 : 0}%` }} />
                  </span>
                </button>
                {/* Chapters you made can have their pages edited (your own folders and .cbz files are never changed). */}
                {t.book.kind === "made" && (
                  <button
                    type="button"
                    className="icon-action shelf-edit"
                    onClick={() => onMade(t.book.id)}
                    title="Edit pages: add, reorder, rename or remove"
                    aria-label={`Edit the pages of ${t.book.title}`}
                  >
                    <Images size={15} strokeWidth={2} />
                  </button>
                )}
              </li>
            ),
          )}
          {books && (
            <li>
              <AddMenu label="Add" items={addItems} />
            </li>
          )}
        </ul>
      )}
      {current && tiles.length > 0 && <p className="muted shelf-hint shelf-hint-below">Tip: drag a chapter onto “Bookshelf” to take it out of this series.</p>}
    </>
  );
}

/**
 * The bookshelf's category tabs: All, your categories, Uncategorised (when
 * anything is). Each takes drops (a book or series dragged onto it moves
 * there); + makes a category; the open one can be renamed or removed.
 */
function CategoryTabs({
  categories,
  active,
  counts,
  dropClass,
  onChoose,
  onChanged,
  onError,
}: {
  categories: Category[];
  active: CategoryTab;
  counts: Map<CategoryTab, number>;
  dropClass: (target: string) => string;
  onChoose: (tab: CategoryTab) => void;
  /** After a change; `choose`: a tab to show now. */
  onChanged: (choose?: CategoryTab) => void;
  onError: (e: unknown) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeCategory = categories.find((c) => c.id === active);
  const tab = (key: CategoryTab, name: React.ReactNode, drop?: string) => (
    <button
      key={String(key)}
      type="button"
      role="tab"
      aria-selected={active === key}
      className={`category-tab ${active === key ? "on" : ""} ${drop ? dropClass(drop) : ""}`}
      onClick={() => onChoose(key)}
      data-drop={drop}
    >
      {name} <span className="category-count">{counts.get(key) ?? 0}</span>
    </button>
  );
  return (
    <div className="category-bar">
      <nav className="category-tabs" role="tablist" aria-label="Categories">
        {tab("all", "All")}
        {categories.map((c) =>
          renaming && c.id === active ? (
            <TagInput
              key={c.id}
              initial={c.name}
              label="Category name"
              placeholder="Category name"
              onDone={(text) => {
                setRenaming(false);
                if (text.trim() && text.trim() !== c.name) renameCategory(tauriDb, c.id, text).then(() => onChanged(), onError);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            tab(c.id, c.name, `cat:${c.id}`)
          ),
        )}
        {(counts.get("none") ?? 0) > 0 && tab("none", "Uncategorised", "cat:none")}
        {adding ? (
          <TagInput
            initial=""
            label="New category"
            placeholder="e.g. Light novels"
            onDone={(text) => {
              setAdding(false);
              if (text.trim()) createCategory(tauriDb, text).then((id) => onChanged(id), onError);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="category-add" onClick={() => setAdding(true)} title="New category" aria-label="New category">
            <Plus size={15} strokeWidth={2.25} />
          </button>
        )}
      </nav>
      {activeCategory && !renaming && (
        <div className="category-tools">
          <button type="button" className="icon-action" onClick={() => setRenaming(true)} title={`Rename ${activeCategory.name}`} aria-label="Rename this category">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`icon-action ${confirmDelete ? "danger" : ""}`}
            onBlur={() => setConfirmDelete(false)}
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              setConfirmDelete(false);
              deleteCategory(tauriDb, activeCategory.id).then(() => onChanged("all"), onError);
            }}
            title={confirmDelete ? `Click again: remove ${activeCategory.name} (what's in it stays, uncategorised)` : `Remove ${activeCategory.name}`}
            aria-label={confirmDelete ? "Click again to remove this category" : "Remove this category"}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** A chapter in a series, as a compact bar: CH.12, anything more its title says, and how far you've read. */
function ChapterBar({
  book,
  seriesTitle,
  dragging,
  onOpen,
  dragHandlers,
  tools,
}: {
  book: Book;
  seriesTitle: string;
  dragging: boolean;
  onOpen: () => void;
  dragHandlers: React.HTMLAttributes<HTMLButtonElement>;
  /** How many buttons sit over its right end (rename, edit pages), to leave room for. */
  tools: number;
}) {
  const number = chapterNumber(book.title);
  const subtitle = number ? chapterSubtitle(book.title, seriesTitle) : book.title;
  const read = book.opened_at && book.pages ? (book.page + 1) / book.pages : 0;
  const facts = [
    book.pages === 0 ? "No pages yet" : `${book.pages} ${book.pages === 1 ? "page" : "pages"}`,
    book.opened_at && book.pages > 0 && `page ${book.page + 1}`,
    !!book.marks && `${book.marks} ${book.marks === 1 ? "mark" : "marks"}`,
  ].filter(Boolean);
  return (
    <button
      type="button"
      className={`chapter-bar ${dragging ? "drag-source" : ""}`}
      style={{ paddingRight: 16 + tools * 38 }}
      onClick={onOpen}
      title={book.title}
      {...dragHandlers}
    >
      <span className="chapter-head">
        <span className="chapter-num">{number ? `CH.${number}` : subtitle}</span>
        {number && subtitle && <span className="chapter-sub">{subtitle}</span>}
      </span>
      <span className="chapter-meta">
        {facts.map((f, i) => (
          <span key={i}>{f}</span>
        ))}
        {book.opened_at ? <span>read {timeAgo(book.opened_at, Date.now())}</span> : <span className="chapter-new">New</span>}
      </span>
      <span className="chapter-progress" aria-hidden="true">
        <span style={{ width: `${read * 100}%` }} />
      </span>
    </button>
  );
}

/** A chapter's bar while you rename it: Enter or clicking away saves, Esc cancels. */
function ChapterRename({ title, onDone, onCancel }: { title: string; onDone: (title: string) => void; onCancel: () => void }) {
  const cancelled = useRef(false);
  return (
    <input
      className="chapter-rename"
      autoFocus
      defaultValue={title}
      aria-label="Chapter title"
      placeholder="e.g. Chapter 1"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => !cancelled.current && onDone(e.currentTarget.value)}
    />
  );
}

/** The + tile or bar at the end of the shelf or a series' chapters: a menu of ways to add more. */
function AddMenu({ label, items }: { label: string; items: { icon: LucideIcon; text: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="shelf-add" ref={box}>
      <button type="button" className="shelf-add-btn" aria-haspopup="menu" aria-expanded={open} title={label} onClick={() => setOpen(!open)}>
        <Plus size={18} strokeWidth={2} aria-hidden="true" /> {label}
      </button>
      {open && (
        <div className="add-to-deck-menu shelf-add-menu" role="menu">
          {items.map(({ icon: Icon, text, onClick }) => (
            <button key={text} type="button" role="menuitem" onClick={choose(onClick)}>
              <span>
                <Icon size={15} aria-hidden="true" /> {text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** What's being dragged on the shelf. */
type DragItem = { book: Book } | { series: Series };
const dragTitle = (item: DragItem) => ("book" in item ? item.book.title : item.series.title);

/**
 * Dragging a book or series tile and dropping it on something marked
 * `data-drop`: a series tile (its id), the back button ("shelf": out of its
 * series) or a category tab ("cat:3", "cat:none"); `onDrop` gets that mark.
 * Made from pointer events rather than the browser's drag and drop, which
 * Tauri takes over on Windows for dropping files from outside. A press that
 * barely moves is still a click; Esc cancels.
 */
function useShelfDrag(onDrop: (item: DragItem, target: string) => void) {
  const [drag, setDrag] = useState<{ item: DragItem; x: number; y: number; over?: string }>();
  const pressed = useRef<{ item: DragItem; x: number; y: number }>(undefined);
  /** A drag happened: the click that may follow it isn't a click. */
  const dragged = useRef(false);
  const drop = useRef(onDrop);
  drop.current = onDrop;

  useEffect(() => {
    const targetAt = (e: PointerEvent) => (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-drop]");
    function move(e: PointerEvent) {
      const p = pressed.current;
      if (!p || (!dragged.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6)) return;
      dragged.current = true;
      setDrag({ item: p.item, x: e.clientX, y: e.clientY, over: targetAt(e)?.dataset.drop });
    }
    function up(e: PointerEvent) {
      const p = pressed.current;
      pressed.current = undefined;
      if (!p || !dragged.current) return;
      setDrag(undefined);
      const target = targetAt(e)?.dataset.drop;
      if (target) drop.current(p.item, target);
    }
    function cancel(e: KeyboardEvent) {
      if (e.key !== "Escape" || !pressed.current) return;
      pressed.current = undefined;
      setDrag(undefined);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", cancel);
    };
  }, []);

  const dragHandlers = (item: DragItem) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      pressed.current = { item, x: e.clientX, y: e.clientY };
      dragged.current = false;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!dragged.current) return;
      dragged.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });
  return { drag, dragHandlers };
}

/**
 * A series' info: its titles, synopsis and your boxes (Cast, Genre…). This is
 * the context sent with translation requests, so the page shows exactly what
 * the AI helper will see. Saves as you leave each field.
 */
function SeriesInfo({
  series,
  first,
  chapters,
  onCoverChanged,
  onOpen,
}: {
  series: Series;
  first?: Book;
  /** Its chapters in reading order. */
  chapters: Book[];
  onCoverChanged: () => void;
  onOpen: (id: number, page?: string) => void;
}) {
  const [info, setInfo] = useState({ synopsis: series.synopsis, genres: series.genres });
  /** What's saved, so leaving a field unchanged writes nothing. */
  const saved = useRef(info);
  const [extras, setExtras] = useState<SeriesExtras>();
  /** Parts of the info not to send to the AI helper (keys from seriesParts). */
  const [off, setOff] = useState(() => contextOff(series.context_off));
  /** The synopsis reads like a page; its pencil opens it for editing. */
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  /** Esc pressed: leaving the box shouldn't save. */
  const cancelSynopsis = useRef(false);
  /** The box ("b3") just added, to put the cursor in. */
  const [added, setAdded] = useState<string>();
  /** The name (its id, or "new") being typed in "Also known as". */
  const [editingTitle, setEditingTitle] = useState<number | "new">();
  /** Adding one: the Add buttons wait, so a double click can't add two. */
  const [adding, setAdding] = useState(false);
  /** A box with writing in it, waiting for a second click to delete. */
  const [confirmBox, setConfirmBox] = useState<number>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    seriesExtras(tauriDb, series.id)
      .then(setExtras)
      .catch((e) => setError(String(e)));
  }, [series.id]);
  if (!extras) return error ? <p className="error">{error}</p> : null;

  const fail = (e: unknown) => setError(String(e));
  const editSynopsis = () => {
    cancelSynopsis.current = false;
    setEditingSynopsis(true);
  };
  async function addRow(make: () => Promise<number>, show: (id: number) => void) {
    if (adding) return;
    setAdding(true);
    try {
      show(await make());
    } catch (e) {
      fail(e);
    } finally {
      setAdding(false);
    }
  }
  const saveInfo = (field: keyof typeof info) => {
    if (info[field] === saved.current[field]) return;
    saved.current = { ...saved.current, [field]: info[field] };
    updateSeriesInfo(tauriDb, series.id, { [field]: info[field] }).catch(fail);
  };
  /**
   * Saves a name ("new": adds it); an empty one is removed. `next`: a new name
   * ended with Enter, so the box for another opens straight away.
   */
  const saveTitle = async (id: number | "new", text: string, next = false) => {
    const title = text.trim();
    setEditingTitle(id === "new" && title && next ? "new" : undefined);
    try {
      if (id === "new") {
        if (title) setExtras({ ...extras, titles: [...extras.titles, { id: await addSeriesTitle(tauriDb, series.id, title), title }] });
        return;
      }
      await setSeriesTitle(tauriDb, id, title);
      setExtras({ ...extras, titles: title ? extras.titles.map((t) => (t.id === id ? { ...t, title } : t)) : extras.titles.filter((t) => t.id !== id) });
    } catch (e) {
      fail(e);
    }
  };
  const setBox = (id: number, change: Partial<SeriesExtras["boxes"][number]>) =>
    setExtras({ ...extras, boxes: extras.boxes.map((b) => (b.id === id ? { ...b, ...change } : b)) });
  const used = new Set(extras.boxes.map((b) => b.label.trim().toLowerCase()));
  const parts = seriesParts({ title: series.title, ...info, ...extras });
  const context = contextText({ series: { title: series.title, ...info, ...extras, off } });
  const toggle = (key: string) => {
    const next = off.includes(key) ? off.filter((k) => k !== key) : [...off, key];
    setOff(next);
    updateSeriesInfo(tauriDb, series.id, { context_off: JSON.stringify(next) }).catch(fail);
  };

  return (
    <section className="series-info">
      <ContextOptions parts={parts} off={off} preview={context} onToggle={toggle} />
      <div className="series-poster">
        <button
          type="button"
          className="series-cover-button"
          onClick={() =>
            pickSeriesCover(tauriDb, series.id)
              .then((picked) => picked && onCoverChanged())
              .catch(fail)
          }
          title="Change the cover"
        >
          <SeriesCover series={series} first={first} />
          <span className="series-cover-change">
            <ImageUp size={16} aria-hidden="true" /> Change cover
          </span>
        </button>
        <SeriesNav series={series} chapters={chapters} onOpen={onOpen} onCleared={onCoverChanged} />
      </div>
      <div className="series-fields">
        <div className="series-field reveal-tools">
          <span className="series-label">Also known as</span>
          <div className="aka-tags">
            {extras.titles.length === 0 && editingTitle === undefined && <span className="muted series-none">No other names yet.</span>}
            {extras.titles.map((t) =>
              editingTitle === t.id ? (
                <TagInput key={t.id} initial={t.title} label="Also known as" onDone={(text) => saveTitle(t.id, text)} onCancel={() => setEditingTitle(undefined)} />
              ) : (
                <span key={t.id} className="aka-tag">
                  <button type="button" className="aka-text" onClick={() => setEditingTitle(t.id)} title="Click to edit">
                    {t.title}
                  </button>
                  <button type="button" className="aka-remove tool" onClick={() => saveTitle(t.id, "")} title="Remove this name" aria-label={`Remove ${t.title}`}>
                    <X size={11} strokeWidth={3} />
                  </button>
                </span>
              ),
            )}
            {editingTitle === "new" ? (
              <TagInput
                key={`new:${extras.titles.length}`}
                initial=""
                label="New name"
                onDone={(text, next) => saveTitle("new", text, next)}
                onCancel={() => setEditingTitle(undefined)}
              />
            ) : (
              <button
                type="button"
                className="aka-tag aka-add tool"
                onClick={() => setEditingTitle("new")}
                title="Add a name: the Japanese title, an English or fan translation, a short name…"
                aria-label="Add a name"
              >
                <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="series-field reveal-tools">
          <span className="series-label" id={`synopsis-${series.id}`}>
            Synopsis
          </span>
          {editingSynopsis ? (
            <textarea
              className="series-synopsis-edit"
              autoFocus
              aria-labelledby={`synopsis-${series.id}`}
              value={info.synopsis}
              placeholder="What the series is about: the blurb from the back cover or a store page"
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onChange={(e) => setInfo({ ...info, synopsis: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                cancelSynopsis.current = true;
                setInfo({ ...info, synopsis: saved.current.synopsis });
                setEditingSynopsis(false);
              }}
              onBlur={() => {
                if (!cancelSynopsis.current) saveInfo("synopsis");
                cancelSynopsis.current = false;
                setEditingSynopsis(false);
              }}
            />
          ) : info.synopsis.trim() ? (
            <div className="series-synopsis">
              <p>{info.synopsis.trim()}</p>
              <button type="button" className="icon-action tool" onClick={editSynopsis} title="Edit the synopsis" aria-label="Edit the synopsis">
                <Pencil size={15} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button type="button" className="series-add" onClick={editSynopsis}>
              <Plus size={14} aria-hidden="true" /> Add a synopsis
            </button>
          )}
        </div>
        <div className="series-field reveal-tools">
          <span className="series-label">Genre</span>
          <TagList
            tags={splitTags(info.genres)}
            label="Genre"
            startAdding={false}
            onChange={(tags) => {
              const genres = joinTags(tags);
              setInfo({ ...info, genres });
              saved.current = { ...saved.current, genres };
              updateSeriesInfo(tauriDb, series.id, { genres }).catch(fail);
            }}
          />
        </div>
        {extras.boxes.map((b) => (
          <div key={b.id} className="series-box">
            <div className="series-row">
              <input
                className="series-box-label"
                value={b.label}
                autoFocus={added === `b${b.id}` && !b.label}
                aria-label="Box name"
                placeholder="Name this box"
                onChange={(e) => setBox(b.id, { label: e.target.value })}
                onBlur={() => setSeriesBox(tauriDb, b.id, b.label, b.text).catch(fail)}
              />
              <button
                type="button"
                className={`icon-action ${confirmBox === b.id ? "danger" : ""}`}
                title={confirmBox === b.id ? "Click again to delete" : "Delete this box"}
                aria-label={confirmBox === b.id ? "Click again to delete" : "Delete this box"}
                onBlur={() => setConfirmBox(undefined)}
                onClick={() => {
                  if (b.text.trim() && confirmBox !== b.id) return setConfirmBox(b.id);
                  deleteSeriesBox(tauriDb, b.id).catch(fail);
                  setExtras({ ...extras, boxes: extras.boxes.filter((x) => x.id !== b.id) });
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <textarea
              rows={3}
              value={b.text}
              autoFocus={added === `b${b.id}` && !!b.label}
              aria-label={b.label || "Box"}
              placeholder={BOX_IDEAS.find((i) => i.label.toLowerCase() === b.label.trim().toLowerCase())?.hint ?? "Anything that helps make sense of the story"}
              onChange={(e) => setBox(b.id, { text: e.target.value })}
              onBlur={() => setSeriesBox(tauriDb, b.id, b.label, b.text).catch(fail)}
            />
          </div>
        ))}
        <AddMore
          ideas={[...BOX_IDEAS.filter((i) => !used.has(i.label.toLowerCase())), { label: "", hint: "A box you name yourself" }]}
          disabled={adding}
          onPick={(label) =>
            addRow(
              () => addSeriesBox(tauriDb, series.id, label),
              (id) => {
                setExtras({ ...extras, boxes: [...extras.boxes, { id, label, text: "" }] });
                setAdded(`b${id}`);
              },
            )
          }
        />
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}

/** Under a series' cover: back to your bookmark, and the first and latest chapters. */
function SeriesNav({
  series,
  chapters,
  onOpen,
  onCleared,
}: {
  series: Series;
  chapters: Book[];
  onOpen: (id: number, page?: string) => void;
  onCleared: () => void;
}) {
  const marked = chapters.find((c) => c.id === series.bookmark_book);
  const label = (b: Book) => {
    const n = chapterNumber(b.title);
    return n ? `CH.${n}` : b.title;
  };
  const first = chapters[0];
  const latest = chapters[chapters.length - 1];
  if (!first) return null;
  return (
    <div className="series-nav">
      <div className="series-bookmark">
        {marked && series.bookmark_page ? (
          <>
            <button type="button" className="series-bookmark-go" onClick={() => onOpen(marked.id, series.bookmark_page!)} title={`Back to your bookmark: ${marked.title}`}>
              <BookmarkCheck size={15} aria-hidden="true" />
              <span className="series-nav-text">
                <span className="series-nav-kind">Bookmark</span>
                <span className="series-nav-value">
                  {label(marked)}
                  {series.bookmark_page_no ? ` · p.${series.bookmark_page_no}` : ""}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="series-bookmark-clear"
              title="Remove the bookmark"
              aria-label="Remove the bookmark"
              onClick={() => clearBookmark(tauriDb, series.id).then(onCleared)}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <p className="series-bookmark-none" title="Bookmark a page with the bookmark button in the reader's toolbar">
            <BookmarkIcon size={15} aria-hidden="true" /> No bookmark yet
          </p>
        )}
      </div>
      <div className="series-nav-ends">
        <button type="button" onClick={() => onOpen(first.id)} title={`The first chapter: ${first.title}`}>
          <SkipBack size={14} aria-hidden="true" />
          <span className="series-nav-text">
            <span className="series-nav-kind">Start</span>
            <span className="series-nav-value">{label(first)}</span>
          </span>
        </button>
        <button type="button" onClick={() => onOpen(latest.id)} title={`The latest chapter: ${latest.title}`}>
          <SkipForward size={14} aria-hidden="true" />
          <span className="series-nav-text">
            <span className="series-nav-kind">Latest</span>
            <span className="series-nav-value">{label(latest)}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * The options button in the corner of a series' info: which parts of it the
 * AI helper is sent with translation requests, and a preview of exactly that.
 */
function ContextOptions({
  parts,
  off,
  preview,
  onToggle,
}: {
  parts: ContextPart[];
  off: string[];
  preview: string;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="context-options" ref={box}>
      <button
        type="button"
        className={`icon-action ${open ? "on" : ""}`}
        aria-expanded={open}
        title="What the AI helper is sent"
        aria-label="What the AI helper is sent"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="context-panel" role="dialog" aria-label="What the AI helper is sent">
          <h3>What the AI helper is sent</h3>
          <p className="muted about-hint">With translation requests for this series' chapters, followed by the chapter's own notes (ⓘ in the reader).</p>
          <ul className="context-parts">
            {parts.map((p) => (
              <li key={p.key}>
                <label className={p.text ? "" : "muted"}>
                  <input type="checkbox" checked={!!p.text && !off.includes(p.key)} disabled={!p.text} onChange={() => onToggle(p.key)} />
                  {p.name}
                  {!p.text && <span className="context-empty"> (nothing written)</span>}
                </label>
              </li>
            ))}
          </ul>
          <p className="series-label">Preview</p>
          <pre lang="ja">{preview || "Nothing is sent from this series yet."}</pre>
        </div>
      )}
    </div>
  );
}

/** "+ Add more" on a series page: a menu of boxes to add (Cast, Setting…, or one you name). */
function AddMore({ ideas, disabled, onPick }: { ideas: { label: string; hint: string }[]; disabled: boolean; onPick: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="series-more" ref={box}>
      <button type="button" className="series-add" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        <Plus size={14} aria-hidden="true" /> Add more
      </button>
      {open && (
        <div className="add-to-deck-menu series-more-menu" role="menu">
          {ideas.map((idea) => (
            <button
              key={idea.label || "other"}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(idea.label);
              }}
            >
              <span className="series-more-item">
                <strong>{idea.label || "Other…"}</strong>
                <span className="muted">{idea.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A small text box standing in for a tag while you type: Enter or clicking away saves, Esc cancels. */
function TagInput({
  initial,
  label,
  placeholder = "A name",
  onDone,
  onCancel,
}: {
  initial: string;
  label: string;
  placeholder?: string;
  /** `next`: it ended with Enter, so another tag can follow. */
  onDone: (text: string, next: boolean) => void;
  onCancel: () => void;
}) {
  const cancelled = useRef(false);
  const entered = useRef(false);
  return (
    <input
      className="aka-input"
      autoFocus
      defaultValue={initial}
      aria-label={label}
      placeholder={placeholder}
      size={Math.max(initial.length, 12)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          entered.current = true;
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => !cancelled.current && onDone(e.currentTarget.value, entered.current)}
    />
  );
}

/**
 * A row of tags: click one to edit it, × (on hover) removes it, + adds one.
 * Enter after a new tag starts the next; Enter on an empty one, Esc or
 * clicking away stops.
 */
function TagList({ tags, label, startAdding, onChange }: { tags: string[]; label: string; startAdding: boolean; onChange: (tags: string[]) => void }) {
  const [editing, setEditing] = useState<number | "new" | undefined>(startAdding ? "new" : undefined);
  const save = (at: number | "new", text: string, next: boolean) => {
    const tag = text.trim();
    if (at === "new") {
      if (tag && !tags.includes(tag)) onChange([...tags, tag]);
      setEditing(tag && next ? "new" : undefined);
      return;
    }
    setEditing(undefined);
    onChange(tag ? tags.map((t, i) => (i === at ? tag : t)) : tags.filter((_, i) => i !== at));
  };
  return (
    <div className="aka-tags">
      {tags.length === 0 && editing === undefined && <span className="muted series-none">None yet.</span>}
      {tags.map((t, i) =>
        editing === i ? (
          <TagInput key={`${i}:${t}`} initial={t} label={label} onDone={(text) => save(i, text, false)} onCancel={() => setEditing(undefined)} />
        ) : (
          <span key={`${i}:${t}`} className="aka-tag">
            <button type="button" className="aka-text" onClick={() => setEditing(i)} title="Click to edit">
              {t}
            </button>
            <button type="button" className="aka-remove tool" onClick={() => onChange(tags.filter((_, j) => j !== i))} title="Remove" aria-label={`Remove ${t}`}>
              <X size={11} strokeWidth={3} />
            </button>
          </span>
        ),
      )}
      {editing === "new" ? (
        <TagInput key={`new:${tags.length}`} initial="" label={`New ${label.toLowerCase()}`} placeholder={label} onDone={(text, next) => save("new", text, next)} onCancel={() => setEditing(undefined)} />
      ) : (
        <button type="button" className="aka-tag aka-add tool" onClick={() => setEditing("new")} title={`Add a ${label.toLowerCase()}`} aria-label={`Add a ${label.toLowerCase()}`}>
          <Plus size={13} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Dragging items of a list into a new order, with pointer events (like
 * useBookDrag). Items carry data-reorder={index}; the drop goes before or
 * after the item under the pointer, by which half of it the pointer is over.
 * Near the window's top or bottom edge the page scrolls, for long lists. A
 * press that barely moves is still a click; Esc cancels. Presses on buttons
 * and text boxes inside an item are left alone (a button marked
 * data-reorder-grip is the item itself, so it drags). `axis` "y": a list
 * going down, where before/after is the top or bottom half.
 */
function useReorderDrag(onMove: (from: number, to: number) => void, enabled: boolean, axis: "x" | "y" = "x") {
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; over?: number; side?: "before" | "after" }>();
  const pressed = useRef<{ from: number; x: number; y: number }>(undefined);
  const vertical = useRef(axis === "y");
  /** Which half of an item the pointer is over: left/right, or top/bottom in a vertical list. */
  const sideOf = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    const before = vertical.current ? y < r.top + r.height / 2 : x < r.left + r.width / 2;
    return before ? ("before" as const) : ("after" as const);
  };
  const dragged = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
  const move = useRef(onMove);
  move.current = onMove;

  useEffect(() => {
    const targetAt = (x: number, y: number) => {
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-reorder]");
      if (!el) return {};
      return { over: Number(el.dataset.reorder), side: sideOf(el, x, y) };
    };
    function onMove(e: PointerEvent) {
      const p = pressed.current;
      if (!p) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (!dragged.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
      dragged.current = true;
      setDrag({ from: p.from, x: e.clientX, y: e.clientY, ...targetAt(e.clientX, e.clientY) });
    }
    function onUp(e: PointerEvent) {
      const p = pressed.current;
      pressed.current = undefined;
      if (!p || !dragged.current) return;
      setDrag(undefined);
      // The click that may follow this drop is swallowed; one that never comes (dropped elsewhere) mustn't eat the next.
      window.setTimeout(() => (dragged.current = false));
      const { over, side } = targetAt(e.clientX, e.clientY);
      if (over === undefined) return;
      let to = side === "before" ? over : over + 1;
      if (to > p.from) to -= 1; // the item leaves its old place first
      if (to !== p.from) move.current(p.from, to);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || !pressed.current) return;
      pressed.current = undefined;
      setDrag(undefined);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // While dragging, scroll when the pointer rests near the top or bottom edge.
  const dragging = drag !== undefined;
  useEffect(() => {
    if (!dragging) return;
    const timer = window.setInterval(() => {
      const { x, y } = pointer.current;
      const edge = 70;
      const by = y < edge ? -14 : y > window.innerHeight - edge ? 14 : 0;
      if (!by) return;
      window.scrollBy(0, by);
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-reorder]");
      if (!el) return;
      setDrag((d) => d && { ...d, over: Number(el.dataset.reorder), side: sideOf(el, x, y) });
    }, 16);
    return () => window.clearInterval(timer);
  }, [dragging]);

  const handlers = (index: number) => ({
    "data-reorder": index,
    onPointerDown: (e: React.PointerEvent) => {
      dragged.current = false; // a new press: any click after it is a real one
      // Buttons and text boxes inside an item keep their presses, unless the button is the item's grip.
      if (!enabled || e.button !== 0 || (e.target as HTMLElement).closest("button:not([data-reorder-grip]), input, textarea, select")) return;
      pressed.current = { from: index, x: e.clientX, y: e.clientY };
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!dragged.current) return;
      dragged.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });
  return { drag, handlers };
}

function EmptyCover() {
  return (
    <span className="shelf-cover">
      <FolderClosed size={32} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

/** A book's first page, small. */
function Cover({ book }: { book: Book }) {
  return <PageThumb path={book.path} />;
}

/** A page, small (`name` left out: the first page). */
function PageThumb({ path, name }: { path: string; name?: string }) {
  return (
    <Thumb
      key={`${path}\n${name ?? ""}`}
      load={() => (name ? Promise.resolve([name]) : bookPages(path)).then((pages) => (pages.length ? pageUrl(path, pages[0]) : undefined))}
    />
  );
}

/** A series' cover: the one you picked, or else its first chapter's first page. */
function SeriesCover({ series, first }: { series: Series; first?: Book }) {
  if (series.cover) return <Thumb key={series.cover} load={() => coverUrl(series.cover!)} />;
  return first ? <Cover book={first} /> : <EmptyCover />;
}

/** An image loaded once by `load` (give it a `key` to load another); a book icon until then, or if it fails. */
function Thumb({ load }: { load: () => Promise<string | undefined> }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    load()
      .then((u) => {
        made = u;
        if (live) setUrl(u);
        else if (u) URL.revokeObjectURL(u);
      })
      .catch(() => {}); // moved or unreadable: the placeholder stays
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, []); // loads once: the caller gives a new key for another image
  return (
    <span className="shelf-cover">
      {url ? <img src={url} alt="" draggable={false} /> : <BookOpen size={32} strokeWidth={1.5} aria-hidden="true" />}
    </span>
  );
}

// --- The reader ---

/** The current page as an image URL, with the pages either side loaded ahead. */
function usePageImage(path: string | undefined, pages: string[] | undefined, index: number) {
  const cache = useRef(new Map<string, Promise<string>>());
  const [image, setImage] = useState<{ name: string; url: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!path || !pages?.length) return;
    const near = [index, index + 1, index - 1].filter((i) => i >= 0 && i < pages.length).map((i) => pages[i]);
    for (const name of near) if (!cache.current.has(name)) cache.current.set(name, pageUrl(path, name));
    // Let go of pages further away.
    for (const [name, url] of cache.current) {
      if (!near.includes(name)) {
        cache.current.delete(name);
        url.then(URL.revokeObjectURL, () => {});
      }
    }
    let live = true;
    const name = pages[index];
    setError(undefined);
    cache.current.get(name)!.then(
      (url) => live && setImage({ name, url }),
      (e) => live && setError(String(e)),
    );
    return () => {
      live = false;
    };
  }, [path, pages, index]);
  useEffect(() => {
    const all = cache.current;
    return () => {
      for (const url of all.values()) url.then(URL.revokeObjectURL, () => {});
      all.clear();
    };
  }, []);
  return { url: image && pages && image.name === pages[index] ? image.url : undefined, error };
}

/** `onEditPages` opens the page editor (shown for chapters you made). */
function Reader({ id, startPage, onBack, onEditPages }: { id: number; startPage?: string; onBack: () => void; onEditPages?: () => void }) {
  const [book, setBook] = useState<Book>();
  const [pages, setPages] = useState<string[]>();
  const [missing, setMissing] = useState<string>();
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selected, setSelected] = useState<number>();
  const [fresh, setFresh] = useState<number>();
  const [kind, setKind] = useState<MarkKind>("speech");
  /** The open mark is getting another box: the next one drawn joins it. */
  const [extending, setExtending] = useState(false);
  useEffect(() => setExtending(false), [selected]);
  /** The side list's marks, section after section: what a drag's indexes count. */
  const ordered = markSections(marks).flatMap((s) => s.marks);
  // Dragged within its own section (a drop in another section moves it to that end of its own).
  const markDrag = useReorderDrag(
    (from, to) => {
      if (ordered[to].kind !== ordered[from].kind) return;
      const next = [...ordered];
      next.splice(to, 0, ...next.splice(from, 1));
      setMarks(next.map((m, i) => ({ ...m, position: i + 1 })));
      reorderMarks(
        tauriDb,
        next.map((m) => m.id),
      ).catch((e) => setError(String(e)));
    },
    true,
    "y",
  );
  /** The page's zoom (react-zoom-pan-pinch), for the toolbar's buttons. */
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const [scale, setScale] = useState(1);
  /** Space held: dragging pans the page instead of drawing a box. */
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [error, setError] = useState<string>();
  const page = pages?.[index];
  const { url, error: pageError } = usePageImage(book?.path, pages, index);

  const open = useCallback(async () => {
    const b = await getBook(tauriDb, id);
    if (!b) return onBack();
    setBook(b);
    try {
      const p = await bookPages(b.path);
      setMissing(undefined);
      setPages(p);
      const start = startPage ? p.indexOf(startPage) : -1;
      setIndex(start >= 0 ? start : Math.min(b.page, Math.max(p.length - 1, 0)));
    } catch (e) {
      setMissing(String(e));
    }
  }, [id, startPage, onBack]);
  useEffect(() => {
    open().catch((e) => setError(String(e)));
  }, [open]);

  // Remember where you are, and load this page's marks.
  const bookId = book?.id;
  useEffect(() => {
    if (!bookId || !pages || !page) return;
    savePlace(tauriDb, bookId, index, pages.length, Date.now()).catch((e) => setError(String(e)));
    setSelected(undefined);
    pageMarks(tauriDb, bookId, page)
      .then(setMarks)
      .catch((e) => setError(String(e)));
  }, [bookId, pages, page, index]);

  const rtl = book?.right_to_left !== 0;
  const count = pages?.length ?? 0;
  const go = useCallback((delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(count - 1, 0))), [count]);

  useEffect(() => {
    function space(e: KeyboardEvent) {
      if (e.key !== " " || typing(e)) return;
      e.preventDefault(); // not a click on whatever button has focus, nor a scroll
      setSpaceHeld(e.type === "keydown");
    }
    const release = () => setSpaceHeld(false);
    window.addEventListener("keydown", space);
    window.addEventListener("keyup", space);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", space);
      window.removeEventListener("keyup", space);
      window.removeEventListener("blur", release);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Esc closes a mark's editor even mid-typing (leaving the field saves it).
      if (e.key === "Escape" && typing(e) && (e.target as HTMLElement).closest(".mark-editor")) {
        (e.target as HTMLElement).blur();
        setSelected(undefined);
        return;
      }
      if (typing(e)) return;
      if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
      else if (e.key === "ArrowRight") go(rtl ? -1 : 1);
      else if (e.key === "Escape") {
        // Esc first stops adding a box, then closes the mark.
        if (extending) setExtending(false);
        else setSelected(undefined);
      } else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, rtl, extending]);

  async function relink() {
    if (!book) return;
    try {
      const found = await pickBooks(book.kind === "cbz" ? "files" : "folder");
      if (!found) return;
      if (found.length !== 1) {
        setMissing(`Pick the book's own ${book.kind === "cbz" ? ".cbz file" : "folder (the one with the pages in it)"}.`);
        return;
      }
      await relinkBook(tauriDb, book.id, found[0].path);
      await open();
    } catch (e) {
      setMissing(String(e));
    }
  }

  async function draw(box: Box) {
    if (!book || !page) return;
    const open = extending ? marks.find((m) => m.id === selected) : undefined;
    if (open) {
      setExtending(false);
      return saveMoreBoxes(open, [...markBoxes(open).slice(1), box]);
    }
    const markId = await addMark(tauriDb, book.id, page, kind, box, Date.now());
    setMarks(await pageMarks(tauriDb, book.id, page));
    setSelected(markId);
    setFresh(markId);
  }

  async function saveMoreBoxes(mark: Mark, boxes: Box[]) {
    await setMoreBoxes(tauriDb, mark.id, boxes);
    const more_boxes = JSON.stringify(boxes);
    setMarks((all) => all.map((m) => (m.id === mark.id ? { ...m, more_boxes } : m)));
  }

  /** This page is the series' bookmark. */
  const bookmarked = !!book && !!page && book.bookmark_book === book.id && book.bookmark_page === page;
  async function toggleBookmark() {
    if (!book || book.series_id === null || !page) return;
    if (bookmarked) {
      await clearBookmark(tauriDb, book.series_id);
      setBook({ ...book, bookmark_book: null, bookmark_page: null });
    } else {
      await setBookmark(tauriDb, book.series_id, book.id, page, index + 1);
      setBook({ ...book, bookmark_book: book.id, bookmark_page: page });
    }
  }

  async function saveBook(fields: Parameters<typeof updateBook>[2]) {
    if (!book) return;
    await updateBook(tauriDb, book.id, fields);
    setBook({ ...book, ...fields });
  }

  if (error) return <p className="error">{error}</p>;
  if (!book) return <p className="muted">Loading…</p>;

  const fullTitle = book.series_title ? `${book.series_title} · ${book.title}` : book.title;
  // In a series the back button already names it: the title is just the chapter (CH.12).
  const number = book.series_title ? chapterNumber(book.title) : null;
  const shortTitle = book.series_title ? (number ? `CH.${number}` : chapterSubtitle(book.title, book.series_title) || book.title) : book.title;
  const back = (
    <button type="button" className="deck-back" onClick={onBack} title={book.series_title ?? "Bookshelf"}>
      <ArrowLeft size={16} aria-hidden="true" /> <span className="back-label">{book.series_title ?? "Bookshelf"}</span>
    </button>
  );
  if (missing) {
    return (
      <>
        {back}
        <h1>{book.title}</h1>
        <section className="reading-missing">
          <p>{missing}</p>
          <p className="muted">
            It was at <code>{book.path}</code>. If you moved or renamed it, show Koihongo where it is now: your marks stay.
          </p>
          <button type="button" className="primary" onClick={relink}>
            <FolderOpen size={16} aria-hidden="true" /> Find it
          </button>
        </section>
      </>
    );
  }

  if (pages && pages.length === 0) {
    return (
      <>
        {back}
        <h1>{book.title}</h1>
        <section className="reading-missing">
          <p>This chapter has no pages yet.</p>
          {book.kind === "made" && onEditPages && (
            <button type="button" className="primary" onClick={onEditPages}>
              <ImagePlus size={16} aria-hidden="true" /> Add images
            </button>
          )}
        </section>
      </>
    );
  }

  const prev = (
    <button type="button" className="icon-action" onClick={() => go(-1)} disabled={index === 0} title="Previous page" aria-label="Previous page">
      {rtl ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
    </button>
  );
  const next = (
    <button type="button" className="icon-action" onClick={() => go(1)} disabled={index >= count - 1} title="Next page" aria-label="Next page">
      {rtl ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );

  return (
    <div className="reader">
      <div className="reader-main">
        <div className="reader-toolbar">
          {back}
          <h1 className="reader-title" title={fullTitle}>
            {shortTitle}
          </h1>
          <div className="reader-pager">
            {rtl ? next : prev}
            <span className="reader-count">
              <span className="num">{index + 1}</span> / <span className="num">{count}</span>
            </span>
            {rtl ? prev : next}
          </div>
          <div className="reader-zoom-tools" role="group" aria-label="Zoom">
            <button type="button" className="icon-action" onClick={() => zoomBy(zoom.current, 1 / ZOOM_STEP)} disabled={scale <= 1.001} title="Zoom out (scroll down)" aria-label="Zoom out">
              <ZoomOut size={18} />
            </button>
            <button type="button" className="reader-zoom-level" onClick={() => zoom.current?.setTransform(0, 0, 1, 0)} title="Back to the whole page" aria-label="Back to the whole page">
              <span className="num">{Math.round(scale * 100)}</span>%
            </button>
            <button type="button" className="icon-action" onClick={() => zoomBy(zoom.current, ZOOM_STEP)} disabled={scale >= MAX_ZOOM - 0.001} title="Zoom in (scroll up)" aria-label="Zoom in">
              <ZoomIn size={18} />
            </button>
            <button type="button" className="icon-action" onClick={() => fitWidth(zoom.current)} title="Fit the width" aria-label="Fit the width">
              <UnfoldHorizontal size={18} />
            </button>
          </div>
          <button
            type="button"
            className={`icon-action ${showMarks ? "" : "on"}`}
            onClick={() => setShowMarks(!showMarks)}
            title={showMarks ? "Hide the boxes, to read the page clean" : "Show the boxes"}
            aria-pressed={!showMarks}
            aria-label="Hide marks"
          >
            {showMarks ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          {book.series_id !== null && page && (
            <button
              type="button"
              className={`icon-action ${bookmarked ? "on" : ""}`}
              onClick={() => toggleBookmark().catch((e) => setError(String(e)))}
              title={bookmarked ? "Remove the bookmark" : "Bookmark this page (the series page takes you back to it)"}
              aria-pressed={bookmarked}
              aria-label="Bookmark this page"
            >
              {bookmarked ? <BookmarkCheck size={18} /> : <BookmarkIcon size={18} />}
            </button>
          )}
          {book.kind === "made" && onEditPages && (
            <button type="button" className="icon-action" onClick={onEditPages} title="Edit pages: add, reorder or remove" aria-label="Edit pages">
              <Images size={18} />
            </button>
          )}
          <button
            type="button"
            className={`icon-action ${aboutOpen ? "on" : ""}`}
            onClick={() => setAboutOpen(!aboutOpen)}
            title="About this book"
            aria-pressed={aboutOpen}
            aria-label="About this book"
          >
            <Info size={18} />
          </button>
        </div>
        <div className={`reader-stage ${spaceHeld ? "panning" : ""}`}>
          {pageError ? (
            <p className="error">{pageError}</p>
          ) : url && page ? (
            <PageView
              key={url}
              zoom={zoom}
              scale={scale}
              onScale={setScale}
              url={url}
              alt={`Page ${index + 1}`}
              marks={showMarks ? marks : []}
              selected={selected}
              kind={(extending && marks.find((m) => m.id === selected)?.kind) || kind}
              onDraw={(box) => draw(box).catch((e) => setError(String(e)))}
              onSelect={setSelected}
              onMoveBox={(mark, part, box) =>
                setMarkBox(tauriDb, mark, part, box)
                  .then((saved) => setMarks((all) => all.map((m) => (m.id === saved.id ? saved : m))))
                  .catch((e) => setError(String(e)))
              }
              onRemoveBox={(mark, part) =>
                saveMoreBoxes(
                  mark,
                  markBoxes(mark)
                    .slice(1)
                    .filter((_, i) => i !== part - 1),
                ).catch((e) => setError(String(e)))
              }
              spaceHeld={spaceHeld}
            />
          ) : (
            <p className="muted">Loading page…</p>
          )}
        </div>
      </div>

      <aside className="reader-side">
        {aboutOpen && (
          <AboutBook
            book={book}
            onSave={(f) => saveBook(f).catch((e) => setError(String(e)))}
            onSeries={(seriesId, title) =>
              setBookSeries(tauriDb, book.id, seriesId)
                .then(() => setBook({ ...book, series_id: seriesId, series_title: title }))
                .catch((e) => setError(String(e)))
            }
            onRemove={async () => {
              await removeBook(tauriDb, book.id);
              onBack();
            }}
          />
        )}
        <div className="mark-tools" role="radiogroup" aria-label="Kind of mark to draw">
          {MARK_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              className={`mark-kind kind-${k.kind} ${kind === k.kind ? "on" : ""}`}
              title={k.hint}
              onClick={() => setKind(k.kind)}
            >
              {k.name}
            </button>
          ))}
        </div>
        <p className="mark-help muted">
          {showMarks ? "Drag a box on the page to mark it. Click a box to open it. Scroll to zoom; drag with the scroll wheel held (or hold Space and drag) to move around." : "Boxes are hidden. Show them to mark the page."}
        </p>
        {marks.length === 0 ? (
          <p className="muted mark-empty">Nothing marked on this page yet.</p>
        ) : (
          <div className={`mark-sections ${markDrag.drag ? "dragging" : ""}`}>
            {markDrag.drag && (
              <div className="drag-ghost" style={{ left: markDrag.drag.x, top: markDrag.drag.y }} aria-hidden="true">
                {ordered[markDrag.drag.from]?.text || "Mark"}
              </div>
            )}
            {markSections(marks).map((section) => (
              <section key={section.kind} className="mark-section">
                <h3 className={`mark-section-title kind-${section.kind}`}>
                  {section.name} <span className="mark-section-count">{section.marks.length}</span>
                </h3>
          <ol className="mark-list">
            {section.marks.map((m, i) => {
              const at = ordered.indexOf(m);
              const drop = markDrag.drag && markDrag.drag.over === at && markDrag.drag.from !== at ? `drop-${markDrag.drag.side}` : "";
              const handlers = markDrag.handlers(at);
              return (
              <li
                key={m.id}
                className={`${markDrag.drag?.from === at ? "drag-source" : ""} ${drop}`}
                {...(selected === m.id ? { "data-reorder": at } : handlers)}
              >
                {selected === m.id ? (
                  <MarkEditor
                    mark={m}
                    number={i + 1}
                    autoFocus={fresh === m.id}
                    extending={extending}
                    onExtend={() => setExtending(!extending)}
                    onSaved={(saved) => setMarks((all) => all.map((x) => (x.id === saved.id ? saved : x)))}
                    onDelete={async () => {
                      await deleteMark(tauriDb, m.id);
                      setMarks((all) => all.filter((x) => x.id !== m.id));
                      setSelected(undefined);
                    }}
                    onClose={() => setSelected(undefined)}
                  />
                ) : (
                  <button
                    type="button"
                    className={`mark-row kind-${m.kind}`}
                    onClick={() => setSelected(m.id)}
                    data-reorder-grip
                    title="Click to open; drag to reorder"
                  >
                    <span className="mark-num">{i + 1}</span>
                    <span className="mark-row-text" lang="ja">
                      {m.text || <span className="muted">(not written yet)</span>}
                    </span>
                    {m.meaning && <span className="mark-row-meaning">{m.meaning}</span>}
                  </button>
                )}
              </li>
              );
            })}
          </ol>
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

/** A page with its boxes: drag to draw a new box, click a box to select it. */
const MAX_ZOOM = 8;
/** Each press of the + or − button. */
const ZOOM_STEP = 1.5;

/** Zooms by `factor`, keeping what's in the middle of the stage in the middle. */
function zoomBy(zoom: ReactZoomPanPinchRef | null, factor: number) {
  const stage = zoom?.instance.wrapperComponent;
  if (!zoom || !stage) return;
  const { scale, positionX, positionY } = zoom.instance.state;
  const next = Math.min(Math.max(scale * factor, 1), MAX_ZOOM);
  if (next === 1) return zoom.setTransform(0, 0, 1, 0);
  const cx = (stage.clientWidth / 2 - positionX) / scale;
  const cy = (stage.clientHeight / 2 - positionY) / scale;
  zoom.setTransform(stage.clientWidth / 2 - cx * next, stage.clientHeight / 2 - cy * next, next, 0);
}

/** Zooms so the page fills the stage's width, from its top. */
function fitWidth(zoom: ReactZoomPanPinchRef | null) {
  const page = zoom?.instance.contentComponent?.querySelector<HTMLElement>(".reader-page");
  const stage = zoom?.instance.wrapperComponent;
  if (!zoom || !page || !stage) return;
  const s = Math.min(stage.clientWidth / page.offsetWidth, MAX_ZOOM);
  zoom.setTransform(-page.offsetLeft * s, -page.offsetTop * s, s, 0);
}

/**
 * A page with its boxes: drag to draw a new box, click a box to select it.
 * Zoom with the scroll wheel or a pinch; pan by dragging with the wheel
 * held down, or with Space held (or swipe sideways on a trackpad).
 * The boxes sit inside the zoomed page, so they zoom along with it.
 */
function PageView({
  zoom,
  scale,
  onScale,
  url,
  alt,
  marks,
  selected,
  kind,
  onDraw,
  onSelect,
  onMoveBox,
  onRemoveBox,
  spaceHeld,
}: {
  zoom: React.Ref<ReactZoomPanPinchRef>;
  scale: number;
  onScale: (scale: number) => void;
  url: string;
  alt: string;
  marks: Mark[];
  selected?: number;
  kind: MarkKind;
  onDraw: (box: Box) => void;
  onSelect: (id: number | undefined) => void;
  /** An open mark's box was moved or resized (`part`: its place in markBoxes). */
  onMoveBox: (mark: Mark, part: number, box: Box) => void;
  /** Removes an open mark's extra part (`part` ≥ 1: its place in markBoxes). */
  onRemoveBox: (mark: Mark, part: number) => void;
  /** Space is held: a left-button drag pans (the wheel button always does). */
  spaceHeld: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const start = useRef<{ x: number; y: number }>(undefined);
  const [draft, setDraft] = useState<Box>();
  /** An open mark's box being moved or resized, and where it is now. */
  const [adjusting, setAdjusting] = useState<{ mark: Mark; part: number; grip: BoxGrip; from: { x: number; y: number }; box: Box; now: Box }>();

  function point(e: React.PointerEvent) {
    const r = layer.current!.getBoundingClientRect();
    return { x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) };
  }
  const boxFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  useEffect(() => () => onScale(1), [onScale]); // a new page starts unzoomed
  const numbers = markNumbers(marks);

  /** Pointer handlers for moving (the box) or resizing (a grip) an open mark's box. */
  const adjust = (mark: Mark, part: number, box: Box, grip: BoxGrip) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation(); // not a new box
      e.currentTarget.setPointerCapture(e.pointerId);
      setAdjusting({ mark, part, grip, from: point(e), box, now: box });
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!adjusting) return;
      const p = point(e);
      setAdjusting({ ...adjusting, now: adjustBox(adjusting.box, adjusting.grip, p.x - adjusting.from.x, p.y - adjusting.from.y) });
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!adjusting) return;
      e.stopPropagation();
      const { now } = adjusting;
      setAdjusting(undefined);
      const moved = (["x", "y", "w", "h"] as const).some((k) => now[k] !== adjusting.box[k]);
      if (moved && now.w > 0.005 && now.h > 0.005) onMoveBox(adjusting.mark, adjusting.part, now);
    },
    onPointerCancel: () => setAdjusting(undefined),
  });

  return (
    <TransformWrapper
      ref={zoom}
      minScale={1}
      maxScale={MAX_ZOOM}
      limitToBounds
      wheel={{ step: 0.002 }}
      // A left-button drag draws a box, so only Space makes it pan.
      panning={{ allowLeftClickPan: spaceHeld, allowMiddleClickPan: true, velocityDisabled: true }}
      onPanningStart={() => setPanning(true)}
      onPanningStop={() => setPanning(false)}
      trackPadPanning={{ disabled: false, velocityDisabled: true }}
      doubleClick={{ disabled: true }}
      onTransform={(_, state) => onScale(state.scale)}
    >
      <TransformComponent wrapperClass={`reader-zoom ${panning ? "is-panning" : ""}`} contentClass="reader-zoom-content">
        <div className="reader-page" style={{ "--zoom": scale } as React.CSSProperties}>
          <img src={url} alt={alt} draggable={false} />
          <div
            ref={layer}
            className="mark-layer"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              start.current = point(e);
            }}
            onPointerMove={(e) => {
              if (start.current) setDraft(boxFrom(start.current, point(e)));
            }}
            onPointerUp={(e) => {
              if (!start.current) return;
              const box = boxFrom(start.current, point(e));
              start.current = undefined;
              setDraft(undefined);
              if (box.w > 0.01 && box.h > 0.01) return onDraw(box);
              // A click, not a drag: select the box under it (the newest, if they overlap).
              const p = point(e);
              const hit = [...marks].reverse().find((m) => markBoxes(m).some((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h));
              onSelect(hit?.id);
            }}
            onPointerCancel={() => {
              start.current = undefined;
              setDraft(undefined);
            }}
          >
            {marks.flatMap((m) =>
              markBoxes(m).map((saved, part) => {
                const open = selected === m.id;
                const b = adjusting?.mark.id === m.id && adjusting.part === part ? adjusting.now : saved;
                return (
                <div
                  key={`${m.id}:${part}`}
                  className={`mark-box kind-${m.kind} ${open ? "selected" : ""}`}
                  style={boxStyle(b)}
                  {...(open ? adjust(m, part, saved, "move") : {})}
                >
                  <span className="mark-num">{numbers.get(m.id)}</span>
                  {/* An open mark's boxes move (drag inside) and resize (drag a grip). */}
                  {open &&
                    GRIPS.map((grip) => <span key={grip} className={`mark-grip grip-${grip}`} {...adjust(m, part, saved, grip)} />)}
                  {part > 0 && selected === m.id && (
                    <button
                      type="button"
                      className="mark-box-remove"
                      title="Remove this part of the mark"
                      aria-label="Remove this part of the mark"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onRemoveBox(m, part)}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  )}
                </div>
                );
              }),
            )}
            {draft && <div className={`mark-box draft kind-${kind}`} style={boxStyle(draft)} />}
          </div>
        </div>
      </TransformComponent>
    </TransformWrapper>
  );
}

// No top-left grip: the mark's number sits on that corner.
const GRIPS: BoxGrip[] = ["n", "ne", "e", "se", "s", "sw", "w"];

function boxStyle(b: Box): React.CSSProperties {
  return { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` };
}

/** One mark, open for writing. Saves as you leave each field. */
function MarkEditor({
  mark,
  number,
  autoFocus,
  extending,
  onExtend,
  onSaved,
  onDelete,
  onClose,
}: {
  mark: Mark;
  number: number;
  autoFocus: boolean;
  /** The next box drawn joins this mark. */
  extending: boolean;
  onExtend: () => void;
  onSaved: (m: Mark) => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<MarkText>({ text: mark.text, reading: mark.reading, meaning: mark.meaning, notes: mark.notes });
  const [kind, setKind] = useState<MarkKind>(mark.kind);
  const [seen, setSeen] = useState<SeenBefore[]>([]);
  const [dictionary, setDictionary] = useState<SfxMeaning[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    seenBefore(tauriDb, textKey(fields.text, kind), mark.id)
      .then((s) => live && setSeen(s))
      .catch(() => {});
    if (kind === "sfx")
      sfxDictionary(tauriDb, textKey(fields.text, "sfx"))
        .then((d) => live && setDictionary(d))
        .catch(() => {});
    else setDictionary([]);
    return () => {
      live = false;
    };
  }, [fields.text, kind, mark.id]);

  async function save(next: MarkText, nextKind: MarkKind) {
    const unchanged = nextKind === mark.kind && (Object.keys(next) as (keyof MarkText)[]).every((k) => next[k] === mark[k]);
    if (unchanged) return;
    try {
      const now = Date.now();
      await updateMark(tauriDb, mark.id, nextKind, next, now);
      onSaved({ ...mark, ...next, kind: nextKind, updated_at: now });
    } catch (e) {
      setError(String(e));
    }
  }
  const field = (name: keyof MarkText) => ({
    value: fields[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields({ ...fields, [name]: e.target.value }),
    onBlur: () => save(fields, kind),
  });
  const written = Object.values(fields).some((v) => v.trim());

  return (
    <div className={`mark-editor kind-${kind}`}>
      <div className="mark-editor-head">
        <span className="mark-num">{number}</span>
        <select
          value={kind}
          aria-label="Kind"
          onChange={(e) => {
            const k = e.target.value as MarkKind;
            setKind(k);
            save(fields, k);
          }}
        >
          {MARK_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.name}
            </option>
          ))}
        </select>
        <span className="mark-editor-space" />
        <button
          type="button"
          className={`icon-action ${extending ? "on" : ""}`}
          onClick={onExtend}
          aria-pressed={extending}
          title="Add a box: mark another part of the same bubble"
          aria-label="Add a box to this mark"
        >
          <SquarePlus size={16} />
        </button>
        <button
          type="button"
          className={`icon-action ${confirmDelete ? "danger" : ""}`}
          title={confirmDelete ? "Click again to delete" : "Delete this mark"}
          aria-label={confirmDelete ? "Click again to delete" : "Delete this mark"}
          onClick={() => (written && !confirmDelete ? setConfirmDelete(true) : onDelete().catch((e) => setError(String(e))))}
          onBlur={() => setConfirmDelete(false)}
        >
          <Trash2 size={16} />
        </button>
        <button type="button" className="icon-action" onClick={onClose} title="Close (Esc)" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      {extending && <p className="mark-extend-hint">Draw a box around the other part on the page. Esc cancels.</p>}
      {!extending && markBoxes(mark).length > 1 && (
        <p className="muted mark-parts">
          {markBoxes(mark).length} boxes on the page; click × on a part to remove it.
        </p>
      )}
      <label>
        Japanese
        <input lang="ja" className="mark-text" placeholder="What it says" autoFocus={autoFocus} {...field("text")} />
      </label>
      {seen.length > 0 && (
        <div className="seen-before">
          <p className="seen-before-title">Seen before</p>
          {seen.slice(0, 3).map((s) => (
            <div key={`${s.reading}\n${s.meaning}`} className="seen-before-row">
              <span>
                {s.reading && (
                  <span lang="ja" className="seen-reading">
                    {s.reading}{" "}
                  </span>
                )}
                <strong>{s.meaning}</strong>
                <span className="muted seen-where">
                  {" "}
                  · {s.times > 1 ? `${s.times}× · last in ` : ""}
                  {s.last.title}, {pageLabel(s.last.page)}
                </span>
              </span>
              <button
                type="button"
                className="seen-use"
                onClick={() => {
                  const next = { ...fields, reading: s.reading, meaning: s.meaning, notes: fields.notes || s.notes };
                  setFields(next);
                  save(next, kind);
                }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}
      {dictionary.length > 0 && (
        <div className="seen-before sfx-dictionary">
          <p className="seen-before-title">SFX dictionary</p>
          {dictionary.slice(0, 4).map((d) => (
            <div key={d.forms.join()} className="seen-before-row">
              <span>
                <span lang="ja" className="seen-reading">
                  {d.forms.slice(0, 2).join("・")}{" "}
                </span>
                {d.loose && <span className="sfx-related">related </span>}
                <strong>{d.meanings.slice(0, 2).join(" / ")}</strong>
              </span>
              <button
                type="button"
                className="seen-use"
                title="Use this meaning"
                onClick={() => {
                  const next = { ...fields, meaning: d.meanings[0] };
                  setFields(next);
                  save(next, kind);
                }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}
      <label>
        Reading
        <input lang="ja" placeholder="In kana, if it has kanji" {...field("reading")} />
      </label>
      <label>
        Meaning
        <input placeholder="What it means, or a translation" {...field("meaning")} />
      </label>
      <label>
        Notes
        <textarea rows={2} placeholder="Grammar, who's speaking, anything" {...field("notes")} />
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** A book's title, reading direction and your notes about it. */
function AboutBook({
  book,
  onSave,
  onSeries,
  onRemove,
}: {
  book: Book;
  onSave: (fields: Parameters<typeof updateBook>[2]) => void;
  onSeries: (seriesId: number | null, title: string | null) => void;
  onRemove: () => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [about, setAbout] = useState(book.about);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  useEffect(() => {
    listSeries(tauriDb)
      .then(setSeries)
      .catch(() => {});
  }, []);
  return (
    <section className="about-book">
      <h2>About this book</h2>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== book.title && onSave({ title: title.trim() })} />
      </label>
      <label>
        Series
        <select
          value={book.series_id ?? ""}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            onSeries(id, series.find((s) => s.id === id)?.title ?? null);
          }}
        >
          <option value="">None (on the shelf by itself)</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reading direction
        <select value={book.right_to_left} onChange={(e) => onSave({ right_to_left: Number(e.target.value) })}>
          <option value={1}>Right to left (manga)</option>
          <option value={0}>Left to right</option>
        </select>
      </label>
      <label>
        {book.series_id ? "Notes on this chapter" : "Setting and characters"}
        <textarea
          rows={4}
          value={about}
          placeholder="e.g. Otome isekai: a noble-girl villainess in a fantasy kingdom. The prince speaks formally; her maid is cheeky."
          onChange={(e) => setAbout(e.target.value)}
          onBlur={() => about !== book.about && onSave({ about })}
        />
      </label>
      <p className="muted about-hint">
        {book.series_id
          ? "Notes on just this chapter. The AI helper reads them after the series' info (the series page), so its translations fit the story."
          : "Your own notes. The AI helper reads them too, so its translations fit the story. (In a series, the series page holds what's true for every chapter.)"}
      </p>
      <p className="muted about-hint">
        Files: <code>{book.path}</code>
      </p>
      <button
        type="button"
        className={confirmRemove ? "danger" : ""}
        onClick={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
        onBlur={() => setConfirmRemove(false)}
      >
        <Trash2 size={15} aria-hidden="true" /> {confirmRemove ? "Click again: remove it and its marks" : "Remove from bookshelf"}
      </button>
    </section>
  );
}

// --- Making a chapter from separate images ---

/** A chapter you made: add images, put them in reading order, remove ones you don't want. */
function PageEditor({ id, onBack, onRead }: { id: number; onBack: () => void; onRead: () => void }) {
  const [book, setBook] = useState<Book>();
  const [pages, setPages] = useState<string[]>();
  const [marks, setMarks] = useState<Record<string, number>>({});
  /** A page with marks waiting for a second click to remove it. */
  const [confirm, setConfirm] = useState<string>();
  /** The page whose name is being edited. */
  const [renaming, setRenaming] = useState<string>();
  /** Esc pressed: leaving the name box shouldn't save. */
  const cancelRename = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  /** Moves a page from one place to another (set below, once the pages are loaded). */
  const moveTo = useRef<(from: number, to: number) => void>(() => {});
  const { drag, handlers: reorder } = useReorderDrag((from, to) => moveTo.current(from, to), !busy && renaming === undefined);

  const load = useCallback(async () => {
    const b = await getBook(tauriDb, id);
    if (!b) return onBack();
    setBook(b);
    setPages(await bookPages(b.path));
    setMarks(await marksPerPage(tauriDb, id));
  }, [id, onBack]);
  useEffect(() => {
    load().catch((e) => setError(String(e)));
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!book || !pages) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const add = () =>
    run(async () => {
      if (!(await addImages(book.path))) return; // cancelled
      const all = await bookPages(book.path);
      await arrangeChapter(tauriDb, book, all, all); // records the new page count
      setPages(all);
    });
  const arrange = (next: string[]) =>
    run(async () => {
      await arrangeChapter(tauriDb, book, pages, next);
      setPages(next);
      setMarks(await marksPerPage(tauriDb, id));
      setConfirm(undefined);
    });
  const move = (i: number, by: number) => {
    const next = [...pages];
    next.splice(i + by, 0, ...next.splice(i, 1));
    arrange(next);
  };
  moveTo.current = (from, to) => move(from, to - from);
  const remove = (name: string) => (marks[name] && confirm !== name ? setConfirm(name) : arrange(pages.filter((p) => p !== name)));
  const rename = (page: string, text: string) => {
    setRenaming(undefined);
    const cancelled = cancelRename.current;
    cancelRename.current = false;
    if (cancelled || !text.trim() || text.trim() === pageStem(page)) return;
    run(async () => {
      const renamed = await renamePage(tauriDb, book, page, text);
      setPages(pages.map((p) => (p === page ? renamed : p)));
      setMarks(await marksPerPage(tauriDb, id));
    });
  };

  return (
    <>
      <button type="button" className="deck-back" onClick={onBack} title={book.series_title ?? "Bookshelf"}>
        <ArrowLeft size={16} aria-hidden="true" /> <span className="back-label">{book.series_title ?? "Bookshelf"}</span>
      </button>
      <h1>{book.title}</h1>
      <p className="muted reading-intro">
        Add page images, one or a few at a time, and drag them into reading order. Removing a page deletes Koihongo's copy, never your original.
      </p>
      <div className="reading-actions">
        <button type="button" className="primary" onClick={add} disabled={busy}>
          <ImagePlus size={16} strokeWidth={2.25} aria-hidden="true" /> Add images
        </button>
        <button type="button" onClick={onRead} disabled={busy || pages.length === 0}>
          <BookOpen size={16} strokeWidth={2.25} aria-hidden="true" /> Read
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {pages.length === 0 && <p className="muted">No pages yet.</p>}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          Page {drag.from + 1}
        </div>
      )}
      <ol className={`page-grid ${drag ? "dragging" : ""}`}>
        {pages.map((name, i) => (
          <li
            key={name}
            className={`page-tile ${drag?.from === i ? "drag-source" : ""} ${drag && drag.over === i && drag.from !== i ? `drop-${drag.side}` : ""}`}
            {...reorder(i)}
          >
            <PageThumb path={book.path} name={name} />
            <span className="page-tile-label">
              <span className="mark-num">{i + 1}</span>
              {renaming === name ? (
                <input
                  className="page-tile-rename"
                  autoFocus
                  defaultValue={pageStem(name)}
                  aria-label="Page name"
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      cancelRename.current = true;
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={(e) => rename(name, e.currentTarget.value)}
                />
              ) : (
                <button
                  type="button"
                  className="page-tile-name"
                  onClick={() => setRenaming(name)}
                  disabled={busy}
                  title={`${name}: click to rename`}
                  aria-label={`Rename ${pageStem(name)}`}
                >
                  <span>{pageStem(name)}</span>
                  <Pencil size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </span>
            {!!marks[name] && (
              <span className="muted page-tile-marks">
                {marks[name]} {marks[name] === 1 ? "mark" : "marks"}
              </span>
            )}
            <span className="page-tile-tools">
              <button type="button" className="icon-action" onClick={() => move(i, -1)} disabled={busy || i === 0} title="Move earlier" aria-label="Move earlier">
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="icon-action"
                onClick={() => move(i, 1)}
                disabled={busy || i === pages.length - 1}
                title="Move later"
                aria-label="Move later"
              >
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className={`icon-action ${confirm === name ? "danger" : ""}`}
                onClick={() => remove(name)}
                onBlur={() => setConfirm(undefined)}
                disabled={busy}
                title={confirm === name ? "Click again: remove it and its marks" : "Remove this page"}
                aria-label={confirm === name ? "Click again: remove it and its marks" : "Remove this page"}
              >
                <Trash2 size={16} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

// --- The glossary ---

function Glossary({ onBack, onOpen }: { onBack: () => void; onOpen: (bookId: number, page: string) => void }) {
  const [entries, setEntries] = useState<GlossaryEntry[]>();
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<MarkKind>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    glossary(tauriDb)
      .then(setEntries)
      .catch((e) => setError(String(e)));
  }, []);

  const q = search.trim().toLowerCase();
  const qKey = textKey(search, "sfx");
  const shown = entries?.filter(
    (e) =>
      (!only || e.kinds.includes(only)) &&
      (!q || e.text.toLowerCase().includes(q) || (qKey && e.key.includes(qKey)) || e.meanings.some((m) => m.meaning.toLowerCase().includes(q) || m.reading.includes(q))),
  );

  return (
    <>
      <button type="button" className="deck-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Bookshelf
      </button>
      <h1>
        <span lang="ja">用語集</span> Glossary
      </h1>
      <p className="muted reading-intro">Everything you've written down while reading, across all your books.</p>
      {error && <p className="error">{error}</p>}
      <div className="glossary-filters">
        <label className="glossary-search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Japanese or meaning" aria-label="Search" />
        </label>
        <div className="mark-tools">
          <button type="button" className={`mark-kind ${only ? "" : "on"}`} onClick={() => setOnly(undefined)}>
            All
          </button>
          {MARK_KINDS.map((k) => (
            <button key={k.kind} type="button" className={`mark-kind kind-${k.kind} ${only === k.kind ? "on" : ""}`} onClick={() => setOnly(k.kind)}>
              {k.name}
            </button>
          ))}
        </div>
      </div>
      {entries && entries.length === 0 && <p className="muted">Nothing yet. Open a book, mark something on a page and write down what it says.</p>}
      {entries && entries.length > 0 && shown?.length === 0 && <p className="muted">Nothing matches.</p>}
      <ul className="glossary">
        {shown?.map((e) => (
          <li key={e.key} className="glossary-entry">
            <div className="glossary-head">
              <span lang="ja" className="glossary-text">
                {e.text}
              </span>
              {e.kinds.map((k) => (
                <span key={k} className={`mark-chip kind-${k}`}>
                  {MARK_KINDS.find((x) => x.kind === k)?.name}
                </span>
              ))}
            </div>
            {e.meanings.length > 0 ? (
              <ul className="glossary-meanings">
                {e.meanings.map((m) => (
                  <li key={`${m.reading}\n${m.meaning}`}>
                    {m.reading && (
                      <span lang="ja" className="seen-reading">
                        {m.reading}{" "}
                      </span>
                    )}
                    {m.meaning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted glossary-meanings">No meaning written yet.</p>
            )}
            <div className="glossary-places">
              <span className="muted">Seen {e.places.length === 1 ? "once" : `${e.places.length}×`}:</span>
              {e.places.slice(0, 6).map((p) => (
                <button key={p.markId} type="button" className="glossary-place" onClick={() => onOpen(p.bookId, p.page)}>
                  {p.title}, {pageLabel(p.page)}
                </button>
              ))}
              {e.places.length > 6 && <span className="muted">and {e.places.length - 6} more</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
