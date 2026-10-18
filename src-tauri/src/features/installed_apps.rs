//! Platform-specific inventory and narrowly scoped app actions.
use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    key: String,
    name: String,
    source: String,
    installed_bytes: Option<u64>,
    installation_path: Option<String>,
    cache_bytes: Option<u64>,
    cache_path: Option<String>,
    uninstall_available: bool,
}

fn redirected_metadata(metadata: &fs::Metadata) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0 // FILE_ATTRIBUTE_REPARSE_POINT includes junctions.
    }
    #[cfg(not(target_os = "windows"))]
    {
        metadata.file_type().is_symlink()
    }
}

fn directory_size(root: &Path) -> Option<u64> {
    if redirected_metadata(&fs::symlink_metadata(root).ok()?) {
        return None;
    }
    let mut size = 0u64;
    let mut visited = 0usize;
    let mut pending = vec![root.to_path_buf()];
    while let Some(path) = pending.pop() {
        for entry in fs::read_dir(path).ok()? {
            let entry = entry.ok()?;
            visited += 1;
            if visited > 200_000 {
                return None;
            }
            let metadata = fs::symlink_metadata(entry.path()).ok()?;
            if redirected_metadata(&metadata) {
                continue;
            }
            if metadata.is_dir() {
                pending.push(entry.path());
            } else if metadata.is_file() {
                size = size.saturating_add(metadata.len());
            }
        }
    }
    Some(size)
}

#[cfg(any(target_os = "macos", target_os = "windows", test))]
mod desktop;
#[cfg(target_os = "linux")]
mod linux;

fn inventory() -> Result<Vec<InstalledApp>, String> {
    #[cfg(target_os = "linux")]
    {
        linux::inventory()
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        desktop::inventory()
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("Installed app management is available on desktop platforms only.".into())
    }
}

#[tauri::command]
pub async fn get_installed_apps() -> Result<Vec<InstalledApp>, String> {
    tauri::async_runtime::spawn_blocking(inventory)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn clear_app_cache(key: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::clear_cache(key).await
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        tauri::async_runtime::spawn_blocking(move || desktop::clear_cache(&key))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        let _ = key;
        Err("App cache cleanup is available on desktop platforms only.".into())
    }
}

#[tauri::command]
pub async fn uninstall_app(key: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        linux::uninstall(key).await
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        tauri::async_runtime::spawn_blocking(move || desktop::uninstall(&key))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        let _ = key;
        Err("App uninstall is available on desktop platforms only.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_size_counts_files_without_following_redirected_directories() {
        let root = env::temp_dir().join(format!("diskvacuum-app-size-test-{}", std::process::id()));
        let outside = env::temp_dir().join(format!(
            "diskvacuum-app-size-outside-{}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("nested")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(root.join("nested/file"), b"app bytes").unwrap();
        fs::write(outside.join("private"), b"must not be traversed").unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&outside, root.join("redirect")).unwrap();
            assert_eq!(directory_size(&root.join("redirect")), None);
            std::os::unix::fs::symlink(&root, root.join("cycle")).unwrap();
        }
        assert_eq!(directory_size(&root), Some(9));
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}
