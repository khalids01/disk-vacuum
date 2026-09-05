mod app_state;
mod features;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            features::scan::service::cancel_scan,
            features::scan::service::get_current_scan,
            features::scan::service::get_scan_directory,
            features::scan::service::get_scan_node_details,
            features::scan::service::get_scan_treemap,
            features::scan::service::scan_directory_path,
            features::scan::service::scan_home_directory,
            features::scan::service::scan_system_storage,
            features::system::get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running DiskVacuum");
}
