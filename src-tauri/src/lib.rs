mod ai;
mod db;

use std::sync::Mutex;
use tauri::Manager;
use tauri::path::BaseDirectory;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let content = app.path().resolve("resources/content.db", BaseDirectory::Resource)?;
            let conn = db::open(&data_dir.join("user.db"), &content)?;
            app.manage(db::Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![db::db_query, db::db_batch, ai::ai_complete])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
