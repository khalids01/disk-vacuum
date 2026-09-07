use crate::app_state::AppState;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::State;

const SETTINGS_VERSION: u32 = 1;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub version: u32,
    pub default_scan_target: ScanTargetPreference,
    pub large_file_threshold_mb: u64,
    pub exclusions: Vec<String>,
    pub onboarding_complete: bool,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScanTargetPreference {
    #[default]
    System,
    Home,
    Folder,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            default_scan_target: ScanTargetPreference::System,
            large_file_threshold_mb: 100,
            exclusions: Vec::new(),
            onboarding_complete: false,
        }
    }
}

#[derive(Clone)]
pub struct SettingsStore {
    path: PathBuf,
    current: Arc<Mutex<AppSettings>>,
}
impl SettingsStore {
    pub fn open(app_data_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(app_data_dir).map_err(ioe)?;
        let path = app_data_dir.join("settings-v1.json");
        let current = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => AppSettings::default(),
            Err(error) => return Err(ioe(error)),
        };
        Ok(Self {
            path,
            current: Arc::new(Mutex::new(current)),
        })
    }
    pub fn get(&self) -> Result<AppSettings, String> {
        self.current
            .lock()
            .map(|value| value.clone())
            .map_err(|_| "Settings are unavailable.".into())
    }
    pub fn save(&self, mut value: AppSettings) -> Result<AppSettings, String> {
        value.version = SETTINGS_VERSION;
        value.large_file_threshold_mb = value.large_file_threshold_mb.clamp(1, 1_048_576);
        value.exclusions = normalize_exclusions(value.exclusions)?;
        let temp = self.path.with_extension("json.tmp");
        let bytes = serde_json::to_vec_pretty(&value).map_err(|error| error.to_string())?;
        fs::write(&temp, bytes).map_err(ioe)?;
        fs::rename(&temp, &self.path).map_err(ioe)?;
        *self
            .current
            .lock()
            .map_err(|_| "Settings are unavailable.".to_owned())? = value.clone();
        Ok(value)
    }
    pub fn exclusion_paths(&self) -> Result<Vec<PathBuf>, String> {
        Ok(self
            .get()?
            .exclusions
            .into_iter()
            .map(PathBuf::from)
            .collect())
    }
    pub fn is_excluded(&self, path: &Path) -> Result<bool, String> {
        Ok(self
            .exclusion_paths()?
            .iter()
            .any(|excluded| path.starts_with(excluded)))
    }
}

fn normalize_exclusions(values: Vec<String>) -> Result<Vec<String>, String> {
    let mut output = Vec::new();
    for value in values {
        let canonical = fs::canonicalize(value.trim())
            .map_err(|_| "An excluded path is unavailable.".to_owned())?;
        let metadata = fs::metadata(&canonical).map_err(ioe)?;
        if !metadata.is_dir() {
            return Err("Only folders can be excluded from scans.".into());
        }
        let value = canonical.to_string_lossy().into_owned();
        if !output.contains(&value) {
            output.push(value);
        }
    }
    output.sort();
    Ok(output)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.settings.get()
}
#[tauri::command]
pub fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    state.settings.save(settings)
}

fn ioe(error: std::io::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_are_safe_and_bounded() {
        let value = AppSettings::default();
        assert_eq!(value.large_file_threshold_mb, 100);
        assert!(value.exclusions.is_empty());
    }

    #[test]
    fn settings_persist_and_exclusions_are_enforced() {
        let root =
            std::env::temp_dir().join(format!("disk-vacuum-settings-{}", std::process::id()));
        let excluded = root.join("excluded");
        fs::create_dir_all(&excluded).expect("fixture should be created");
        let store = SettingsStore::open(&root).expect("settings should open");
        let mut value = store.get().expect("settings should load");
        value.large_file_threshold_mb = 256;
        value.exclusions = vec![excluded.to_string_lossy().into_owned()];
        store.save(value).expect("settings should save");
        let reopened = SettingsStore::open(&root).expect("settings should reopen");
        assert_eq!(reopened.get().unwrap().large_file_threshold_mb, 256);
        assert!(reopened.is_excluded(&excluded.join("child")).unwrap());
        fs::remove_dir_all(root).expect("fixture should be removed");
    }
}
