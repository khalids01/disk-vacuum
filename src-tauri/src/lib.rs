mod app_state;
mod features;
mod scan_repository;

use app_state::AppState;
use features::settings::SettingsStore;
use scan_repository::ScanRepository;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    let _ = rustls::crypto::ring::default_provider().install_default();

    let builder = tauri::Builder::default();

    #[cfg(not(target_os = "android"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;
            let repository = ScanRepository::open(&app_data_dir)?;
            let settings = SettingsStore::open(&app_data_dir)?;
            let current_scan = repository.load_scan_summary()?;
            app.manage(AppState::new(repository, current_scan, settings));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            features::duplicates::analyze_duplicates,
            features::duplicates::cancel_duplicate_analysis,
            features::duplicates::get_duplicate_report,
            features::cleanup::preview_duplicate_cleanup,
            features::cleanup::preview_cleanup_targets,
            features::cleanup::trash_duplicate_files,
            features::cleanup::trash_cleanup_targets,
            features::cleanup::permanently_delete_cleanup_files,
            features::scan::service::cancel_scan,
            features::scan::service::get_current_scan,
            features::scan::service::get_ai_storage,
            features::scan::service::get_app_leftovers,
            features::scan::service::get_developer_cleanup,
            features::scan::service::get_large_files,
            features::scan::service::get_scan_breadcrumbs,
            features::scan::service::get_scan_directory,
            features::scan::service::get_scan_node_details,
            features::scan::service::get_scan_treemap,
            features::scan::service::scan_directory_path,
            features::scan::service::search_scan,
            features::scan::service::scan_home_directory,
            features::scan::service::scan_system_storage,
            features::system::get_system_info,
            features::system::get_storage_diagnostics,
            features::settings::get_settings,
            features::settings::save_settings,
            features::installed_apps::get_installed_apps,
            features::installed_apps::clear_app_cache,
            features::installed_apps::uninstall_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running DiskVacuum");
}
