// Backups of user.db (your progress) in Documents\Koihongo\Backups, where
// they're easy to find and copy. File names come from the UI (src/backup.ts):
// "<kind>-<date>_<time>.db", kind = auto | manual | before-restore.

use rusqlite::{Connection, OpenFlags, MAIN_DB};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::db::Db;

const KINDS: [&str; 3] = ["auto", "manual", "before-restore"];

#[derive(Serialize)]
pub struct BackupInfo {
    name: String,
    size: u64,
    /// Unix milliseconds.
    modified: u64,
}

/// A plain file name for a backup of a known kind: no folders, nothing to escape.
fn check_name(name: &str) -> Result<(), String> {
    let ok = name.ends_with(".db")
        && KINDS.iter().any(|k| name.starts_with(&format!("{k}-")))
        && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.')
        && !name.contains("..");
    if ok { Ok(()) } else { Err(format!("not a backup file name: {name}")) }
}

/// Copies the live database (consistent even mid-use) to `dir/name`.
pub fn create(conn: &Connection, dir: &Path, name: &str) -> Result<BackupInfo, String> {
    check_name(name)?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(name);
    if path.exists() {
        return Err(format!("{name} already exists"));
    }
    conn.backup(MAIN_DB, &path, None).map_err(|e| e.to_string())?;
    info(&path)
}

/// Backups in `dir`, newest first.
pub fn list(dir: &Path) -> Result<Vec<BackupInfo>, String> {
    let Ok(entries) = std::fs::read_dir(dir) else { return Ok(vec![]) };
    let mut out = vec![];
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if check_name(&name).is_ok() {
            out.push(info(&entry.path())?);
        }
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified).then(b.name.cmp(&a.name)));
    Ok(out)
}

/// Deletes all but the newest `keep` backups of one kind.
pub fn prune(dir: &Path, kind: &str, keep: usize) -> Result<(), String> {
    if !KINDS.contains(&kind) {
        return Err(format!("unknown backup kind: {kind}"));
    }
    let prefix = format!("{kind}-");
    for old in list(dir)?.into_iter().filter(|b| b.name.starts_with(&prefix)).skip(keep) {
        std::fs::remove_file(dir.join(&old.name)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Replaces the live database's contents with a backup, after checking it is one.
/// Replaces the open database with backup `name`. Refuses files that aren't
/// Koihongo backups, and backups from a newer app (data version above
/// `max_schema`), which this version couldn't open afterwards.
pub fn restore(conn: &mut Connection, dir: &Path, name: &str, max_schema: u32) -> Result<(), String> {
    check_name(name)?;
    let path = dir.join(name);
    let src = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    let has_progress: bool = src
        .query_row("SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'srs_cards')", [], |r| r.get(0))
        .map_err(|e| format!("{name} isn't a Koihongo backup ({e})"))?;
    if !has_progress {
        return Err(format!("{name} isn't a Koihongo backup"));
    }
    let version: u32 = src.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version > max_schema {
        return Err(format!(
            "{name} was made by a newer version of Koihongo (data version {version}, this app knows {max_schema}). Update the app to restore it."
        ));
    }
    drop(src);
    conn.restore(MAIN_DB, &path, None::<fn(rusqlite::backup::Progress)>).map_err(|e| e.to_string())
}

fn info(path: &Path) -> Result<BackupInfo, String> {
    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map_or(0, |d| d.as_millis() as u64);
    Ok(BackupInfo { name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), size: meta.len(), modified })
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().document_dir().map_err(|e| e.to_string())?.join("Koihongo").join("Backups"))
}

#[tauri::command]
pub fn backup_create(app: tauri::AppHandle, db: tauri::State<Db>, name: String) -> Result<BackupInfo, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    create(&conn, &backup_dir(&app)?, &name)
}

#[tauri::command]
pub fn backup_list(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    list(&backup_dir(&app)?)
}

#[tauri::command]
pub fn backup_prune(app: tauri::AppHandle, kind: String, keep: usize) -> Result<(), String> {
    prune(&backup_dir(&app)?, &kind, keep)
}

#[tauri::command]
pub fn backup_restore(app: tauri::AppHandle, db: tauri::State<Db>, name: String, max_schema: u32) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    restore(&mut conn, &backup_dir(&app)?, &name, max_schema)
}

#[tauri::command]
pub fn backup_open_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = backup_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nihongo-backup-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn user_db(dir: &Path, value: &str) -> Connection {
        let conn = Connection::open(dir.join("user.db")).unwrap();
        conn.execute_batch(&format!(
            "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS srs_cards (item_key TEXT); DELETE FROM srs_cards; INSERT INTO srs_cards VALUES ('{value}');"
        ))
        .unwrap();
        conn
    }

    fn card(conn: &Connection) -> String {
        conn.query_row("SELECT item_key FROM srs_cards", [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn backs_up_and_restores() {
        let dir = temp_dir("roundtrip");
        let backups = dir.join("Backups");
        let mut conn = user_db(&dir, "kanji:木");
        let made = create(&conn, &backups, "manual-2026-10-20_120000.db").unwrap();
        assert!(made.size > 0);
        assert!(create(&conn, &backups, "manual-2026-10-20_120000.db").is_err(), "never overwrites");

        conn.execute("UPDATE srs_cards SET item_key = 'kanji:森'", []).unwrap();
        restore(&mut conn, &backups, "manual-2026-10-20_120000.db", 99).unwrap();
        assert_eq!(card(&conn), "kanji:木");
    }

    #[test]
    fn refuses_odd_names_and_non_backups() {
        let dir = temp_dir("names");
        let mut conn = user_db(&dir, "x");
        for bad in ["../user.db", "manual-..\\x.db", "notes.db", "manual-x.txt", "C:\\manual-x.db"] {
            assert!(create(&conn, &dir, bad).is_err(), "{bad}");
        }
        Connection::open(dir.join("auto-other.db")).unwrap().execute_batch("CREATE TABLE t (x);").unwrap();
        assert!(restore(&mut conn, &dir, "auto-other.db", 99).unwrap_err().contains("isn't a Koihongo backup"));
        assert_eq!(card(&conn), "x");
    }

    #[test]
    fn prunes_old_backups_of_one_kind_only() {
        let dir = temp_dir("prune");
        let conn = user_db(&dir, "x");
        for name in ["auto-1.db", "auto-2.db", "auto-3.db", "manual-1.db"] {
            create(&conn, &dir, name).unwrap();
        }
        prune(&dir, "auto", 2).unwrap();
        let mut left: Vec<String> = list(&dir).unwrap().into_iter().map(|b| b.name).collect();
        left.sort();
        assert_eq!(left, ["auto-2.db", "auto-3.db", "manual-1.db"]);
    }

    #[test]
    fn refuses_backups_from_a_newer_app() {
        let dir = temp_dir("newer");
        let newer = Connection::open(dir.join("manual-newer.db")).unwrap();
        newer.execute_batch("CREATE TABLE srs_cards (x); PRAGMA user_version = 9;").unwrap();
        drop(newer);
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE srs_cards (x); INSERT INTO srs_cards VALUES (1);").unwrap();
        let err = restore(&mut conn, &dir, "manual-newer.db", 5).unwrap_err();
        assert!(err.contains("newer version"), "{err}");
        let kept: i64 = conn.query_row("SELECT count(*) FROM srs_cards", [], |r| r.get(0)).unwrap();
        assert_eq!(kept, 1, "nothing was replaced");
    }
}
