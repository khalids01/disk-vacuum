mod app_state;
mod features;
mod scan_repository;

use app_state::AppState;
use scan_repository::ScanRepository;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let repository =
                ScanRepository::open(&app.path().app_data_dir().map_err(|error| {
                    format!("Could not resolve the app data directory: {error}")
                })?)?;
            let current_scan = repository.load_scan_summary()?;
            app.manage(AppState::new(repository, current_scan));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            features::scan::service::cancel_scan,
            features::scan::service::get_current_scan,
            features::scan::service::get_ai_storage,
            features::scan::service::get_developer_cleanup,
            features::scan::service::get_large_files,
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
