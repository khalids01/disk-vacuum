mod app_state;
mod features;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            features::scan::service::get_current_scan,
            features::scan::service::scan_home_directory,
            features::system::get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running DiskVacuum");
}
