// Reading (src/reading.ts, src/screens/Reading.tsx): your own manga, read
// straight from where it is on your PC. A book is a folder of page images, or
// a .cbz (a zip of page images). Nothing is copied or changed.
//
// The UI only ever gets image files that belong to a book: pages are listed
// here, and a page is fetched by its name from that list (so a name like
// "../secret.png" can't reach anything else).
//
// The one exception to "nothing is changed": chapters you make yourself from
// separate images. Those images are copied into Documents\Koihongo\Books\<name>,
// and only folders in there can be added to, reordered or have pages removed.

use serde::Serialize;
use std::cmp::Ordering;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::ipc::Response;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const IMAGE_EXTS: [&str; 7] = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp"];
const ARCHIVE_EXTS: [&str; 2] = ["cbz", "zip"];
/// No real page is this big; stops a broken or hostile .cbz from filling memory.
const MAX_PAGE_BYTES: u64 = 64 * 1024 * 1024;
/// In a chapter you made: its page names in your reading order, one per line.
const ORDER_FILE: &str = ".koihongo-order.txt";

/// A book found by book_pick, for the UI to put on the shelf.
#[derive(Serialize, Debug)]
pub struct FoundBook {
    path: String,
    title: String,
    kind: &'static str,
    pages: usize,
    /// The series folder it was found in, if you picked a folder of chapters.
    series: Option<String>,
}

fn has_ext(name: &str, exts: &[&str]) -> bool {
    Path::new(name).extension().and_then(|e| e.to_str()).is_some_and(|e| exts.iter().any(|x| e.eq_ignore_ascii_case(x)))
}

/// A page image, not a hidden file (like macOS's "._001.jpg" copies).
fn is_page(name: &str) -> bool {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    !base.starts_with('.') && !name.starts_with("__MACOSX") && has_ext(name, &IMAGE_EXTS)
}

fn is_archive(path: &Path) -> bool {
    path.is_file() && has_ext(&path.to_string_lossy(), &ARCHIVE_EXTS)
}

fn open_zip(path: &Path) -> Result<zip::ZipArchive<File>, String> {
    let file = File::open(path).map_err(|e| format!("Couldn't open {}: {e}", path.display()))?;
    zip::ZipArchive::new(file).map_err(|e| format!("{} isn't a readable .cbz file ({e})", path.display()))
}

/// Compares names the way people count: "2.jpg" before "10.jpg", ignoring case.
pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return a.cmp(b), // equal apart from case or leading zeros
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(c), Some(d)) if c.is_ascii_digit() && d.is_ascii_digit() => {
                let take = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut n = String::new();
                    while let Some(c) = it.next_if(char::is_ascii_digit) {
                        n.push(c);
                    }
                    n
                };
                let (m, n) = (take(&mut x), take(&mut y));
                let (m, n) = (m.trim_start_matches('0'), n.trim_start_matches('0'));
                let order = m.len().cmp(&n.len()).then_with(|| m.cmp(n));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (Some(c), Some(d)) => {
                let order = c.to_lowercase().cmp(d.to_lowercase());
                if order != Ordering::Equal {
                    return order;
                }
                x.next();
                y.next();
            }
        }
    }
}

/// A book's page names, in reading order.
pub fn pages(book: &Path) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = if book.is_dir() {
        std::fs::read_dir(book)
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| is_page(n))
            .collect()
    } else if is_archive(book) {
        open_zip(book)?.file_names().filter_map(Result::ok).filter(|n| is_page(n)).map(|n| n.into_owned()).collect()
    } else {
        return Err("Koihongo can't find this book's pages any more.".into());
    };
    names.sort_by(|a, b| natural_cmp(a, b));
    // A chapter you made in Koihongo keeps your page order in a file beside the pages.
    if let Ok(order) = std::fs::read_to_string(book.join(ORDER_FILE)) {
        let mut ordered: Vec<String> = Vec::with_capacity(names.len());
        for line in order.lines() {
            if names.iter().any(|n| n == line) && !ordered.iter().any(|o| o == line) {
                ordered.push(line.to_owned());
            }
        }
        let rest: Vec<String> = names.into_iter().filter(|n| !ordered.contains(n)).collect();
        ordered.extend(rest);
        names = ordered;
    }
    Ok(names)
}

/// One page's image file, by its name from pages().
pub fn page(book: &Path, name: &str) -> Result<Vec<u8>, String> {
    if !pages(book)?.iter().any(|p| p == name) {
        return Err(format!("{name} isn't a page of this book"));
    }
    let too_big = || format!("{name} is too big to be a page");
    if book.is_dir() {
        let path = book.join(name);
        if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > MAX_PAGE_BYTES {
            return Err(too_big());
        }
        return std::fs::read(path).map_err(|e| e.to_string());
    }
    let mut zip = open_zip(book)?;
    let file = zip.by_name(name).map_err(|e| e.to_string())?;
    if file.size() > MAX_PAGE_BYTES {
        return Err(too_big());
    }
    let mut bytes = Vec::with_capacity(file.size() as usize);
    // The size in a zip is only a claim: never read past the limit either way.
    file.take(MAX_PAGE_BYTES + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_PAGE_BYTES {
        return Err(too_big());
    }
    Ok(bytes)
}

fn name_of(path: &Path) -> String {
    let name = if path.is_dir() { path.file_name() } else { path.file_stem() };
    name.map_or_else(|| path.to_string_lossy().into_owned(), |n| n.to_string_lossy().into_owned())
}

fn found(path: &Path, series: Option<&str>) -> Option<FoundBook> {
    let count = pages(path).ok()?.len();
    (count > 0).then(|| FoundBook {
        path: path.to_string_lossy().into_owned(),
        title: name_of(path),
        kind: if path.is_dir() { "folder" } else { "cbz" },
        pages: count,
        series: series.map(str::to_owned),
    })
}

/// The books at `path`: the folder or .cbz itself, or, for a folder with no
/// pages of its own (a series), each chapter folder or .cbz inside it, with
/// the folder's name as their series.
pub fn scan(path: &Path) -> Vec<FoundBook> {
    if let Some(book) = found(path, None) {
        return vec![book];
    }
    let Ok(entries) = std::fs::read_dir(path) else { return vec![] };
    let mut inside: Vec<PathBuf> = entries.filter_map(Result::ok).map(|e| e.path()).collect();
    inside.sort_by(|a, b| natural_cmp(&a.to_string_lossy(), &b.to_string_lossy()));
    let series = name_of(path);
    inside.iter().filter_map(|p| found(p, Some(&series))).collect()
}

/// Asks you for a manga folder ("folder") or .cbz files ("files") and returns
/// the books found there (maybe none); None if you cancel.
#[tauri::command]
pub async fn book_pick(window: tauri::Window, kind: String) -> Result<Option<Vec<FoundBook>>, String> {
    let dialog = window.dialog().file().set_parent(&window);
    let picked: Vec<PathBuf> = tauri::async_runtime::spawn_blocking(move || match kind.as_str() {
        "folder" => Ok(dialog.set_title("Choose a manga folder").blocking_pick_folder().into_iter().collect::<Vec<_>>()),
        "files" => Ok(dialog
            .set_title("Choose .cbz files")
            .add_filter("Comic book archives", &ARCHIVE_EXTS)
            .blocking_pick_files()
            .unwrap_or_default()),
        _ => Err(format!("unknown kind: {kind}")),
    })
    .await
    .map_err(|e| e.to_string())??
    .into_iter()
    .filter_map(|p| p.into_path().ok())
    .collect();
    if picked.is_empty() {
        return Ok(None);
    }
    Ok(Some(picked.iter().flat_map(|p| scan(p)).collect()))
}

/// The books in files and folders dragged in from Explorer: the same as picking them
/// (a folder of images is a book, a folder of chapter folders a series, .cbz files books).
#[tauri::command]
pub async fn book_scan(paths: Vec<String>) -> Result<Vec<FoundBook>, String> {
    tauri::async_runtime::spawn_blocking(move || paths.iter().flat_map(|p| scan(Path::new(p))).collect()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn book_pages(path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || pages(Path::new(&path))).await.map_err(|e| e.to_string())?
}

/// The page's image bytes, sent as-is (not as JSON).
#[tauri::command]
pub async fn book_page(path: String, name: String) -> Result<Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || page(Path::new(&path), &name)).await.map_err(|e| e.to_string())??;
    Ok(Response::new(bytes))
}

// --- Chapters you make from separate images ---

/// A folder name from a title: no characters Windows forbids, not too long.
fn folder_name(title: &str) -> String {
    let clean = clean_name(title);
    if clean.is_empty() { "Chapter".into() } else { clean }
}

/// A name Windows will take for a file or folder: no forbidden characters, not
/// too long, no trailing dots or spaces. May be empty.
fn clean_name(name: &str) -> String {
    let clean: String = name.chars().map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { ' ' } else { c }).collect();
    let clean = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    let clean: String = clean.chars().take(80).collect();
    clean.trim_matches(['.', ' ']).to_owned()
}

/// `dir/name`, or `dir/stem (2).ext` and so on if that's taken.
fn free_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, format!(".{e}")),
        _ => (name, String::new()),
    };
    (2..).map(|n| dir.join(format!("{stem} ({n}){ext}"))).find(|p| !p.exists()).expect("some name is free")
}

/// Makes an empty chapter folder under `root` and returns its path.
pub fn new_chapter(root: &Path, title: &str) -> Result<PathBuf, String> {
    std::fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let dir = free_path(root, &folder_name(title));
    std::fs::create_dir(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// `path`, if it's a chapter folder inside `root` (one Koihongo made).
fn made_chapter(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let refuse = || "Only chapters you made in Koihongo can be changed.".to_owned();
    let root = root.canonicalize().map_err(|_| refuse())?;
    let dir = path.canonicalize().map_err(|_| "Koihongo can't find this book's pages any more.".to_owned())?;
    if dir.parent() == Some(root.as_path()) && dir.is_dir() { Ok(dir) } else { Err(refuse()) }
}

fn write_order(dir: &Path, names: &[String]) -> Result<(), String> {
    std::fs::write(dir.join(ORDER_FILE), names.join("\n")).map_err(|e| e.to_string())
}

/// Copies images into a chapter, after its last page (several at once go in
/// name order: 2 before 10). Returns the new pages' names.
pub fn add_images(dir: &Path, sources: &[PathBuf]) -> Result<Vec<String>, String> {
    let mut order = pages(dir)?;
    let mut sources: Vec<&PathBuf> = sources.iter().collect();
    sources.sort_by(|a, b| natural_cmp(&a.to_string_lossy(), &b.to_string_lossy()));
    let mut added = Vec::new();
    for source in sources {
        let name = source.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if !is_page(&name) {
            return Err(format!("{name} isn't an image Koihongo can show (jpg, png, webp, gif, avif or bmp)."));
        }
        if std::fs::metadata(source).map_err(|e| e.to_string())?.len() > MAX_PAGE_BYTES {
            return Err(format!("{name} is too big to be a page"));
        }
        let dest = free_path(dir, &name);
        std::fs::copy(source, &dest).map_err(|e| format!("Couldn't copy {name}: {e}"))?;
        added.push(dest.file_name().unwrap().to_string_lossy().into_owned());
    }
    order.extend(added.iter().cloned());
    write_order(dir, &order)?;
    Ok(added)
}

/// Sets a chapter's pages to `names`, in that order; its pages not in the
/// list are deleted (they're Koihongo's own copies).
pub fn arrange(dir: &Path, names: &[String]) -> Result<(), String> {
    let current = pages(dir)?;
    for (i, name) in names.iter().enumerate() {
        if !current.contains(name) || names[..i].contains(name) {
            return Err(format!("{name} isn't a page of this chapter"));
        }
    }
    for gone in current.iter().filter(|p| !names.contains(p)) {
        std::fs::remove_file(dir.join(gone)).map_err(|e| e.to_string())?;
    }
    write_order(dir, names)
}

/// Renames a page of a chapter you made to `name` (its file type stays) and
/// returns the new file name. Its place in your order stays.
pub fn rename_page(dir: &Path, from: &str, name: &str) -> Result<String, String> {
    let mut order = pages(dir)?;
    let Some(i) = order.iter().position(|p| p == from) else { return Err(format!("{from} isn't a page of this chapter")) };
    let stem = clean_name(name.strip_suffix(&format!(".{}", ext_of(from))).unwrap_or(name));
    if stem.is_empty() {
        return Err("Give the page a name.".into());
    }
    let to = format!("{stem}.{}", ext_of(from));
    if to == from {
        return Ok(to);
    }
    // Windows names ignore case: "Cover.png" may be this very file.
    if !to.eq_ignore_ascii_case(from) && dir.join(&to).exists() {
        return Err(format!("There's already a page called {stem}."));
    }
    std::fs::rename(dir.join(from), dir.join(&to)).map_err(|e| e.to_string())?;
    order[i] = to.clone();
    write_order(dir, &order)?;
    Ok(to)
}

fn ext_of(name: &str) -> &str {
    name.rsplit_once('.').map_or("", |(_, e)| e)
}

fn books_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().document_dir().map_err(|e| e.to_string())?.join("Koihongo").join("Books"))
}

/// Makes a new, empty chapter for you to add images to.
#[tauri::command]
pub fn book_new(app: tauri::AppHandle, title: String) -> Result<FoundBook, String> {
    let dir = new_chapter(&books_root(&app)?, &title)?;
    Ok(FoundBook { path: dir.to_string_lossy().into_owned(), title: title.trim().to_owned(), kind: "made", pages: 0, series: None })
}

/// Asks you for images and copies them into a chapter you made. The new
/// pages' names, or None if you cancel.
#[tauri::command]
pub async fn book_add_images(window: tauri::Window, path: String) -> Result<Option<Vec<String>>, String> {
    let dir = made_chapter(&books_root(window.app_handle())?, Path::new(&path))?;
    let dialog = window.dialog().file().set_parent(&window);
    tauri::async_runtime::spawn_blocking(move || {
        let picked: Vec<PathBuf> = dialog
            .set_title("Choose page images")
            .add_filter("Images", &IMAGE_EXTS)
            .blocking_pick_files()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|p| p.into_path().ok())
            .collect();
        if picked.is_empty() { Ok(None) } else { add_images(&dir, &picked).map(Some) }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Copies images dragged in from Explorer into a chapter you made, after its last page
/// (other files are skipped): the new pages' names.
#[tauri::command]
pub async fn book_drop_images(app: tauri::AppHandle, path: String, files: Vec<String>) -> Result<Vec<String>, String> {
    let dir = made_chapter(&books_root(&app)?, Path::new(&path))?;
    let images: Vec<PathBuf> = files.into_iter().map(PathBuf::from).filter(|p| p.is_file() && is_page(&p.to_string_lossy())).collect();
    tauri::async_runtime::spawn_blocking(move || add_images(&dir, &images)).await.map_err(|e| e.to_string())?
}

/// Reorders a chapter you made, and deletes the pages you removed.
#[tauri::command]
pub async fn book_arrange(app: tauri::AppHandle, path: String, pages: Vec<String>) -> Result<(), String> {
    let dir = made_chapter(&books_root(&app)?, Path::new(&path))?;
    tauri::async_runtime::spawn_blocking(move || arrange(&dir, &pages)).await.map_err(|e| e.to_string())?
}

// --- Series covers you picked ---
// Copied into Documents\Koihongo\Covers as "series-<id>-<time>.<ext>" (a new
// name each time, so an old copy can't linger in the page), and only files
// named like that are ever read or removed there.

fn covers_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().document_dir().map_err(|e| e.to_string())?.join("Koihongo").join("Covers"))
}

fn cover_prefix(series_id: i64) -> String {
    format!("series-{series_id}-")
}

/// A name save_cover could have made: no folders, no tricks.
fn is_cover_name(name: &str) -> bool {
    name.starts_with("series-") && is_page(name) && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.') && !name.contains("..")
}

/// Removes a series' cover copies; returns how many.
pub fn remove_covers(root: &Path, series_id: i64) -> usize {
    let prefix = cover_prefix(series_id);
    let Ok(entries) = std::fs::read_dir(root) else { return 0 };
    entries
        .filter_map(Result::ok)
        .filter(|e| e.file_name().to_str().is_some_and(|n| n.starts_with(&prefix) && is_cover_name(n)))
        .filter(|e| std::fs::remove_file(e.path()).is_ok())
        .count()
}

/// Copies `source` in as a series' cover (replacing its old one) and returns the copy's name.
pub fn save_cover(root: &Path, series_id: i64, source: &Path, now_ms: u128) -> Result<String, String> {
    let name = source.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    if !is_page(&name) {
        return Err(format!("{name} isn't an image Koihongo can show (jpg, png, webp, gif, avif or bmp)."));
    }
    if std::fs::metadata(source).map_err(|e| e.to_string())?.len() > MAX_PAGE_BYTES {
        return Err(format!("{name} is too big for a cover"));
    }
    std::fs::create_dir_all(root).map_err(|e| e.to_string())?;
    remove_covers(root, series_id);
    let copy = format!("{}{now_ms}.{}", cover_prefix(series_id), ext_of(&name).to_ascii_lowercase());
    std::fs::copy(source, root.join(&copy)).map_err(|e| format!("Couldn't copy {name}: {e}"))?;
    Ok(copy)
}

pub fn read_cover(root: &Path, name: &str) -> Result<Vec<u8>, String> {
    if !is_cover_name(name) {
        return Err(format!("{name} isn't a cover"));
    }
    std::fs::read(root.join(name)).map_err(|_| "The cover image is missing.".to_owned())
}

/// Asks you for an image and makes it a series' cover: the copy's name, or None if you cancel.
#[tauri::command]
pub async fn series_cover_pick(window: tauri::Window, series_id: i64) -> Result<Option<String>, String> {
    let root = covers_root(window.app_handle())?;
    let dialog = window.dialog().file().set_parent(&window);
    tauri::async_runtime::spawn_blocking(move || {
        let Some(picked) = dialog.set_title("Choose a cover image").add_filter("Images", &IMAGE_EXTS).blocking_pick_file() else {
            return Ok(None);
        };
        let path = picked.into_path().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis());
        save_cover(&root, series_id, &path, now).map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A cover image's bytes, sent as-is (not as JSON).
#[tauri::command]
pub async fn series_cover(app: tauri::AppHandle, name: String) -> Result<Response, String> {
    let root = covers_root(&app)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_cover(&root, &name)).await.map_err(|e| e.to_string())??;
    Ok(Response::new(bytes))
}

/// Removes a series' cover copies (back to its first page, or the series is gone).
#[tauri::command]
pub fn series_cover_remove(app: tauri::AppHandle, series_id: i64) -> Result<(), String> {
    remove_covers(&covers_root(&app)?, series_id);
    Ok(())
}

/// Renames a page of a chapter you made; returns its new file name.
#[tauri::command]
pub async fn book_rename_page(app: tauri::AppHandle, path: String, page: String, name: String) -> Result<String, String> {
    let dir = made_chapter(&books_root(&app)?, Path::new(&path))?;
    tauri::async_runtime::spawn_blocking(move || rename_page(&dir, &page, &name)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("koihongo-books-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_cbz(path: &Path, files: &[(&str, &[u8])]) {
        let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
        for (name, bytes) in files {
            zip.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
    }

    #[test]
    fn counts_like_people_do() {
        let mut names = vec!["p10.jpg", "p2.jpg", "P1.jpg", "p02b.jpg", "cover.png"];
        names.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(names, ["cover.png", "P1.jpg", "p2.jpg", "p02b.jpg", "p10.jpg"]);
    }

    #[test]
    fn folder_pages_skip_everything_else() {
        let dir = temp_dir("folder");
        for name in ["10.jpg", "2.PNG", "notes.txt", "._2.PNG", "1.webp"] {
            std::fs::write(dir.join(name), name).unwrap();
        }
        std::fs::create_dir(dir.join("extras.jpg")).unwrap(); // a folder, even with an image-like name
        assert_eq!(pages(&dir).unwrap(), ["1.webp", "2.PNG", "10.jpg"]);
        assert_eq!(page(&dir, "2.PNG").unwrap(), b"2.PNG");
        assert!(page(&dir, "notes.txt").is_err());
        assert!(page(&dir, "../outside.png").is_err());
    }

    #[test]
    fn cbz_pages() {
        let dir = temp_dir("cbz");
        let cbz = dir.join("Vol 1.cbz");
        write_cbz(&cbz, &[("ch1/p2.jpg", b"two"), ("ch1/p1.jpg", b"one"), ("__MACOSX/ch1/._p1.jpg", b"x"), ("info.xml", b"<x/>")]);
        assert_eq!(pages(&cbz).unwrap(), ["ch1/p1.jpg", "ch1/p2.jpg"]);
        assert_eq!(page(&cbz, "ch1/p2.jpg").unwrap(), b"two");
        assert!(page(&cbz, "info.xml").is_err());
    }

    #[test]
    fn a_series_folder_becomes_one_book_per_chapter() {
        let dir = temp_dir("series").join("Koi Story");
        std::fs::create_dir_all(dir.join("Chapter 10")).unwrap();
        std::fs::create_dir_all(dir.join("Chapter 2")).unwrap();
        std::fs::create_dir_all(dir.join("Empty")).unwrap();
        std::fs::write(dir.join("Chapter 10/1.jpg"), "x").unwrap();
        std::fs::write(dir.join("Chapter 2/1.jpg"), "x").unwrap();
        write_cbz(&dir.join("Chapter 11.cbz"), &[("1.jpg", b"x"), ("2.jpg", b"x")]);
        let books = scan(&dir);
        let titles: Vec<_> = books.iter().map(|b| (b.title.as_str(), b.kind, b.pages, b.series.as_deref())).collect();
        assert_eq!(
            titles,
            [
                ("Chapter 2", "folder", 1, Some("Koi Story")),
                ("Chapter 10", "folder", 1, Some("Koi Story")),
                ("Chapter 11", "cbz", 2, Some("Koi Story"))
            ]
        );
        // A chapter folder on its own is one book, in no series.
        let one = &scan(&dir.join("Chapter 2"))[0];
        assert_eq!((one.title.as_str(), one.series.as_deref()), ("Chapter 2", None));
    }

    #[test]
    fn a_moved_book_says_so() {
        let err = pages(Path::new("C:/nowhere/koihongo-missing-book")).unwrap_err();
        assert!(err.contains("can't find"), "{err}");
    }

    #[test]
    fn making_a_chapter_from_separate_images() {
        let root = temp_dir("made").join("Books");
        let src = temp_dir("made-src");
        for name in ["scan 10.png", "scan 2.png", "cover.jpg", "notes.txt"] {
            std::fs::write(src.join(name), name).unwrap();
        }
        // Names Windows won't take are cleaned; a taken name gets " (2)".
        let dir = new_chapter(&root, "Koi: Ch 1?").unwrap();
        assert_eq!(dir.file_name().unwrap(), "Koi Ch 1");
        assert_eq!(new_chapter(&root, "Koi: Ch 1?").unwrap().file_name().unwrap(), "Koi Ch 1 (2)");
        assert_eq!(folder_name(" ... "), "Chapter");

        // Several at once go in name order, after what's there; a repeated name is kept apart.
        assert_eq!(add_images(&dir, &[src.join("cover.jpg")]).unwrap(), ["cover.jpg"]);
        assert_eq!(add_images(&dir, &[src.join("scan 10.png"), src.join("scan 2.png")]).unwrap(), ["scan 2.png", "scan 10.png"]);
        assert_eq!(add_images(&dir, &[src.join("cover.jpg")]).unwrap(), ["cover (2).jpg"]);
        assert_eq!(pages(&dir).unwrap(), ["cover.jpg", "scan 2.png", "scan 10.png", "cover (2).jpg"]);
        assert!(add_images(&dir, &[src.join("notes.txt")]).is_err(), "only images");

        // Your order wins over name order; pages left out are deleted.
        let order: Vec<String> = ["scan 10.png", "cover.jpg", "scan 2.png"].map(String::from).to_vec();
        arrange(&dir, &order).unwrap();
        assert_eq!(pages(&dir).unwrap(), order);
        assert!(!dir.join("cover (2).jpg").exists());
        assert!(src.join("cover.jpg").exists(), "the originals stay");
        assert!(arrange(&dir, &["nope.png".to_owned()]).is_err());
        assert!(arrange(&dir, &["cover.jpg".to_owned(), "cover.jpg".to_owned()]).is_err());
    }

    #[test]
    fn only_chapters_koihongo_made_can_change() {
        let root = temp_dir("guard").join("Books");
        let dir = new_chapter(&root, "Mine").unwrap();
        assert!(made_chapter(&root, &dir).is_ok());
        let elsewhere = temp_dir("guard-elsewhere");
        assert!(made_chapter(&root, &elsewhere).is_err(), "your own folders are never written to");
        assert!(made_chapter(&root, &root).is_err());
        assert!(made_chapter(&root, &dir.join("..").join("..")).is_err());
    }

    #[test]
    fn renaming_a_page_you_added() {
        let root = temp_dir("rename").join("Books");
        let dir = new_chapter(&root, "Ch").unwrap();
        let src = temp_dir("rename-src");
        for name in ["scan 1.png", "scan 2.png", "scan 3.png"] {
            std::fs::write(src.join(name), name).unwrap();
        }
        add_images(&dir, &[src.join("scan 1.png"), src.join("scan 2.png"), src.join("scan 3.png")]).unwrap();

        // The file type stays, whether you type it or not; the page keeps its place.
        assert_eq!(rename_page(&dir, "scan 3.png", "Cover: front?").unwrap(), "Cover front.png");
        assert_eq!(rename_page(&dir, "scan 1.png", "intro.png").unwrap(), "intro.png");
        assert_eq!(pages(&dir).unwrap(), ["intro.png", "scan 2.png", "Cover front.png"]);
        assert_eq!(std::fs::read(dir.join("Cover front.png")).unwrap(), b"scan 3.png");
        // Only a change of case: allowed, even though Windows calls it the same name.
        assert_eq!(rename_page(&dir, "intro.png", "Intro").unwrap(), "Intro.png");
        assert_eq!(pages(&dir).unwrap()[0], "Intro.png");

        assert!(rename_page(&dir, "scan 2.png", "intro").unwrap_err().contains("already"));
        assert!(rename_page(&dir, "scan 2.png", " ?? ").unwrap_err().contains("name"));
        assert!(rename_page(&dir, "nope.png", "x").is_err());
    }

    #[test]
    fn series_covers() {
        let root = temp_dir("covers").join("Covers");
        let src = temp_dir("covers-src");
        std::fs::write(src.join("Poster.PNG"), "one").unwrap();
        std::fs::write(src.join("second.jpg"), "two").unwrap();
        std::fs::write(src.join("notes.txt"), "no").unwrap();

        let first = save_cover(&root, 7, &src.join("Poster.PNG"), 1000).unwrap();
        assert_eq!(first, "series-7-1000.png");
        assert_eq!(read_cover(&root, &first).unwrap(), b"one");
        // A new cover replaces the old copy; other series' covers stay.
        let other = save_cover(&root, 70, &src.join("second.jpg"), 1500).unwrap();
        let second = save_cover(&root, 7, &src.join("second.jpg"), 2000).unwrap();
        assert!(!root.join(&first).exists());
        assert_eq!(read_cover(&root, &second).unwrap(), b"two");
        assert!(root.join(&other).exists(), "series-70 isn't series-7");
        assert!(src.join("Poster.PNG").exists(), "the original stays");

        assert!(save_cover(&root, 7, &src.join("notes.txt"), 3000).is_err());
        for bad in ["../secret.png", "series-7-..png", "other.png", "series-7-1.txt", "series-7/1.png"] {
            assert!(read_cover(&root, bad).is_err(), "{bad}");
        }
        assert_eq!(remove_covers(&root, 7), 1);
        assert!(root.join(&other).exists());
    }
}
