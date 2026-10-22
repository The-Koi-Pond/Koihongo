mod ai;
mod backup;
mod db;

use std::sync::Mutex;
use tauri::Manager;
use tauri::path::BaseDirectory;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Saves the window's size, position and maximised state on close, and restores them on start.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let content = app.path().resolve("resources/content.db", BaseDirectory::Resource)?;
            let conn = db::open(&data_dir.join("user.db"), &content)?;
            app.manage(db::Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_query,
            db::db_batch,
            ai::ai_complete,
            backup::backup_create,
            backup::backup_list,
            backup::backup_prune,
            backup::backup_restore,
            backup::backup_open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
