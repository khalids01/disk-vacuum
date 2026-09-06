mod app_state;
mod features;
mod scan_repository;

use std::sync::Arc;

use app_state::AppState;
use scan_repository::ScanRepository;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let repository =
                ScanRepository::open(&app.path().app_data_dir().map_err(|error| {
                    format!("Could not resolve the app data directory: {error}")
                })?)?;
            let state = AppState::new(repository.clone(), None);
            let completed_scan = Arc::clone(&state.completed_scan);
            app.manage(state);

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let Ok(restored_scan) = repository.load_completed_scan() else {
                    return;
                };
                let Some(restored_scan) = restored_scan else {
                    return;
                };
                let summary = restored_scan.summary.clone();
                let Ok(mut current_scan) = completed_scan.lock() else {
                    return;
                };
                *current_scan = Some(restored_scan);
                drop(current_scan);
                let _ = app_handle.emit("scan-restored", summary);
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            features::scan::service::cancel_scan,
            features::scan::service::get_current_scan,
            features::scan::service::get_scan_directory,
            features::scan::service::get_scan_node_details,
            features::scan::service::get_scan_treemap,
            features::scan::service::scan_directory_path,
            features::scan::service::search_scan,
            features::scan::service::scan_home_directory,
            features::scan::service::scan_system_storage,
            features::system::get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running DiskVacuum");
}
