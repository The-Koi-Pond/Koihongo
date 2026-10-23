mod ai;
mod ai_api;
mod backup;
mod baberu;
mod books;
mod db;
mod downloads;
mod local_ai;
mod ocr;
mod words;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Restores the window's size, position and maximised state on start (saved as you go, below).
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let content = app.path().resolve("resources/content.db", BaseDirectory::Resource)?;
            let conn = db::open(&data_dir.join("user.db"), &content)?;
            app.manage(db::Db(Mutex::new(conn)));
            app.manage(ocr::Ocr::default());
            app.manage(local_ai::LocalAi::default());
            local_ai::stop_when_idle(app.handle().clone());
            save_window_state_as_you_go(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_query,
            db::db_batch,
            ai::ai_complete,
            ai::ai_claude_code_found,
            ai_api::ai_key_status,
            ai_api::ai_key_set,
            ai_api::ai_key_delete,
            backup::backup_create,
            backup::backup_list,
            backup::backup_prune,
            backup::backup_restore,
            backup::backup_open_folder,
            books::book_pick,
            books::book_scan,
            books::book_drop_images,
            books::book_pages,
            books::book_page,
            books::book_new,
            books::book_add_images,
            books::book_arrange,
            books::book_rename_page,
            books::series_cover_pick,
            books::series_cover,
            books::series_cover_remove,
            ocr::ocr_status,
            ocr::ocr_download,
            ocr::ocr_remove,
            ocr::ocr_read,
            ocr::ocr_find,
            words::words_split,
            local_ai::local_ai_status,
            local_ai::local_ai_download,
            local_ai::local_ai_remove
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Closing Koihongo stops the built-in AI (the job object would too, if it crashed).
            if let tauri::RunEvent::Exit = event {
                app.state::<local_ai::LocalAi>().stop();
            }
        });
}

/// The window-state plugin only writes to disk when the app exits cleanly, so
/// a crash, a force-close or a dev restart forgets where you put the window.
/// This also saves it (at most once a second) after you move or resize it.
///
/// The save itself runs on the main thread. Saving from the timer thread
/// froze the app mid-resize: the plugin holds its lock while asking the main
/// thread for the window's size, and the main thread, busy resizing, was
/// waiting for that same lock.
fn save_window_state_as_you_go(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else { return };
    let moved = Arc::new(AtomicBool::new(false));
    let flag = moved.clone();
    window.on_window_event(move |e| {
        if matches!(e, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
            flag.store(true, Ordering::Relaxed);
        }
    });
    let app = app.handle().clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));
        if moved.swap(false, Ordering::Relaxed) {
            let main = app.clone();
            let _ = app.run_on_main_thread(move || {
                let _ = main.save_window_state(StateFlags::all());
            });
        }
    });
}
