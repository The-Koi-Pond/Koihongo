// SQLite access for the UI. One connection: user.db (your progress, writable)
// with content.db attached read-only as `content`, so queries can join both.
// App logic lives in TypeScript (src/db, src/srs); this only runs SQL.

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use rusqlite::{Connection, params_from_iter};
use serde::Deserialize;
use serde_json::{Map, Number, Value};
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

pub fn open(user_db: &Path, content_db: &Path) -> Result<Connection, String> {
    if !content_db.exists() {
        return Err(format!(
            "content database not found at {} (run `pnpm content:build`)",
            content_db.display()
        ));
    }
    let conn = Connection::open(user_db).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    conn.execute("ATTACH DATABASE ?1 AS content", [read_only_uri(content_db)])
        .map_err(|e| e.to_string())?;
    conn.authorizer(Some(authorize)).map_err(|e| e.to_string())?;
    Ok(conn)
}

/// The UI sends its own SQL, so from here on SQLite refuses what the app never
/// needs and what could reach outside the two databases: attaching or
/// detaching files (ATTACH can create a file anywhere on disk) and every
/// PRAGMA except user_version (used by migrations).
fn authorize(ctx: AuthContext<'_>) -> Authorization {
    match ctx.action {
        AuthAction::Attach { .. } | AuthAction::Detach { .. } => Authorization::Deny,
        AuthAction::Pragma { pragma_name, .. } if !pragma_name.eq_ignore_ascii_case("user_version") => Authorization::Deny,
        _ => Authorization::Allow,
    }
}

/// `C:\a b\c.db` → `file:///C:/a%20b/c.db?mode=ro`
fn read_only_uri(path: &Path) -> String {
    let path = path.to_string_lossy().replace('\\', "/");
    let mut out = String::from(if path.starts_with('/') { "file://" } else { "file:///" });
    for b in path.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' | b':' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out.push_str("?mode=ro");
    out
}

fn to_sql(value: &Value) -> Result<SqlValue, String> {
    Ok(match value {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(*b as i64),
        Value::Number(n) => match n.as_i64() {
            Some(i) => SqlValue::Integer(i),
            None => SqlValue::Real(n.as_f64().ok_or("number out of range")?),
        },
        Value::String(s) => SqlValue::Text(s.clone()),
        Value::Array(_) | Value::Object(_) => {
            return Err("SQL parameters must be null, boolean, number or string".into());
        }
    })
}

fn to_json(value: ValueRef) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => Number::from_f64(f).map_or(Value::Null, Value::Number),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => Value::from(b.to_vec()),
    }
}

fn params(values: &[Value]) -> Result<Vec<SqlValue>, String> {
    values.iter().map(to_sql).collect()
}

pub fn query(conn: &Connection, sql: &str, values: &[Value]) -> Result<Vec<Map<String, Value>>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    let rows = stmt
        .query_map(params_from_iter(params(values)?), |row| {
            let mut obj = Map::new();
            for (i, name) in names.iter().enumerate() {
                obj.insert(name.clone(), to_json(row.get_ref(i)?));
            }
            Ok(obj)
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

/// Runs all statements in one transaction: all succeed or none do.
pub fn batch(conn: &mut Connection, statements: &[Statement]) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for s in statements {
        tx.execute(&s.sql, params_from_iter(params(&s.params)?))
            .map_err(|e| format!("{e} (in: {})", s.sql))?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_query(db: tauri::State<Db>, sql: String, params: Vec<Value>) -> Result<Vec<Map<String, Value>>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    query(&conn, &sql, &params)
}

#[tauri::command]
pub fn db_batch(db: tauri::State<Db>, statements: Vec<Statement>) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    batch(&mut conn, &statements)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("nihongo-db-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn joins_user_and_content_and_keeps_content_read_only() {
        let dir = temp_dir("attach with space");
        let content = dir.join("content.db");
        Connection::open(&content)
            .unwrap()
            .execute_batch("CREATE TABLE kanji (character TEXT); INSERT INTO kanji VALUES ('森');")
            .unwrap();

        let mut conn = open(&dir.join("user.db"), &content).unwrap();
        batch(
            &mut conn,
            &[
                Statement { sql: "CREATE TABLE notes (kanji TEXT, text TEXT)".into(), params: vec![] },
                Statement { sql: "INSERT INTO notes VALUES (?, ?)".into(), params: vec![json!("森"), json!("three trees")] },
            ],
        )
        .unwrap();

        let rows = query(&conn, "SELECT k.character, n.text FROM content.kanji k JOIN notes n ON n.kanji = k.character", &[]).unwrap();
        assert_eq!(Value::Array(rows.into_iter().map(Value::Object).collect()), json!([{"character": "森", "text": "three trees"}]));

        let write = batch(&mut conn, &[Statement { sql: "INSERT INTO content.kanji VALUES ('木')".into(), params: vec![] }]);
        assert!(write.unwrap_err().contains("readonly"));
    }

    #[test]
    fn failed_batch_changes_nothing() {
        let dir = temp_dir("rollback");
        let content = dir.join("content.db");
        Connection::open(&content).unwrap();
        let mut conn = open(&dir.join("user.db"), &content).unwrap();
        conn.execute_batch("CREATE TABLE t (x INTEGER NOT NULL)").unwrap();

        let result = batch(
            &mut conn,
            &[
                Statement { sql: "INSERT INTO t VALUES (1)".into(), params: vec![] },
                Statement { sql: "INSERT INTO t VALUES (NULL)".into(), params: vec![] },
            ],
        );
        assert!(result.is_err());
        assert_eq!(query(&conn, "SELECT count(*) AS n FROM t", &[]).unwrap()[0]["n"], json!(0));
    }

    #[test]
    fn missing_content_db_is_a_clear_error() {
        let dir = temp_dir("missing");
        let err = open(&dir.join("user.db"), &dir.join("nope.db")).unwrap_err();
        assert!(err.contains("pnpm content:build"));
    }

    #[test]
    fn ui_sql_cannot_reach_other_files() {
        let dir = temp_dir("lockdown");
        let content = dir.join("content.db");
        Connection::open(&content).unwrap().execute_batch("CREATE TABLE kanji (character TEXT)").unwrap();
        let mut conn = open(&dir.join("user.db"), &content).unwrap();
        let outside = dir.join("planted.bat");
        let out = outside.to_string_lossy().replace('\\', "/");

        let attach = batch(&mut conn, &[Statement { sql: format!("ATTACH DATABASE '{out}' AS x"), params: vec![] }]);
        assert!(attach.is_err(), "ATTACH must be refused");
        let vacuum = batch(&mut conn, &[Statement { sql: format!("VACUUM INTO '{out}'"), params: vec![] }]);
        assert!(vacuum.is_err(), "VACUUM INTO must be refused");
        assert!(!outside.exists(), "no file was written");
        assert!(query(&conn, "PRAGMA writable_schema = ON", &[]).is_err(), "other pragmas are refused");

        // What the app does still works.
        batch(&mut conn, &[Statement { sql: "PRAGMA user_version = 3".into(), params: vec![] }]).unwrap();
        let rows = query(&conn, "PRAGMA user_version", &[]).unwrap();
        assert_eq!(rows[0]["user_version"], json!(3));
        assert!(query(&conn, "SELECT count(*) AS n FROM content.kanji", &[]).is_ok());
    }
}
