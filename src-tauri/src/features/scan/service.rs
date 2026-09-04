use std::{
    cmp::Reverse,
    env, fs,
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter, State};

use crate::{
    app_state::AppState,
    features::scan::model::{ScanNodeKind, ScanNodeSummary, ScanProgress, ScanSummary},
};

const MAX_TOP_LEVEL_ITEMS: usize = 24;
const PROGRESS_EVENT_NAME: &str = "scan-progress";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

struct ScanAccumulator {
    app_handle: Option<AppHandle>,
    target_label: String,
    started_at: Instant,
    last_progress_emit: Instant,
    entries_visited: u64,
    total_size_bytes: u64,
    file_count: u64,
    directory_count: u64,
    permission_denied_count: u64,
    unreadable_entry_count: u64,
    skipped_symlink_count: u64,
    skipped_special_file_count: u64,
    top_level_items: Vec<ScanNodeSummary>,
}

impl ScanAccumulator {
    fn new(app_handle: Option<AppHandle>, target_label: &str) -> Self {
        let started_at = Instant::now();

        Self {
            app_handle,
            target_label: target_label.to_owned(),
            started_at,
            last_progress_emit: started_at,
            entries_visited: 0,
            total_size_bytes: 0,
            file_count: 0,
            directory_count: 1,
            permission_denied_count: 0,
            unreadable_entry_count: 0,
            skipped_symlink_count: 0,
            skipped_special_file_count: 0,
            top_level_items: Vec::with_capacity(MAX_TOP_LEVEL_ITEMS),
        }
    }

    fn record_entry_visit(&mut self) {
        self.entries_visited += 1;
        self.emit_progress(false);
    }

    fn emit_progress(&mut self, force: bool) {
        if !force && self.last_progress_emit.elapsed() < PROGRESS_INTERVAL {
            return;
        }

        self.last_progress_emit = Instant::now();
        if let Some(app_handle) = &self.app_handle {
            let _ = app_handle.emit(
                PROGRESS_EVENT_NAME,
                ScanProgress {
                    target_label: self.target_label.clone(),
                    entries_visited: self.entries_visited,
                    bytes_observed: self.total_size_bytes,
                    elapsed_milliseconds: self.started_at.elapsed().as_millis() as u64,
                },
            );
        }
    }

    fn record_read_error(&mut self, error: &std::io::Error) {
        if error.kind() == std::io::ErrorKind::PermissionDenied {
            self.permission_denied_count += 1;
        } else {
            self.unreadable_entry_count += 1;
        }
    }

    fn record_top_level_item(&mut self, item: ScanNodeSummary) {
        if self.top_level_items.len() < MAX_TOP_LEVEL_ITEMS {
            self.top_level_items.push(item);
            return;
        }

        let Some((smallest_index, smallest_item)) = self
            .top_level_items
            .iter()
            .enumerate()
            .min_by_key(|(_, item)| item.size_bytes)
        else {
            return;
        };

        if item.size_bytes > smallest_item.size_bytes {
            self.top_level_items[smallest_index] = item;
        }
    }
}

struct MeasuredEntry {
    kind: ScanNodeKind,
    size_bytes: u64,
}

#[tauri::command]
pub async fn scan_home_directory(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ScanSummary, String> {
    let summary =
        tauri::async_runtime::spawn_blocking(move || scan_home_directory_blocking(app_handle))
            .await
            .map_err(|_| "The home scan could not finish.".to_owned())??;

    let mut completed_scan = state
        .completed_scan
        .lock()
        .map_err(|_| "DiskVacuum could not update its scan state.".to_owned())?;
    *completed_scan = Some(summary.clone());

    Ok(summary)
}

#[tauri::command]
pub async fn scan_directory_path(
    path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ScanSummary, String> {
    let summary = tauri::async_runtime::spawn_blocking(move || {
        scan_selected_directory_blocking(path, app_handle)
    })
    .await
    .map_err(|_| "The folder scan could not finish.".to_owned())??;

    let mut completed_scan = state
        .completed_scan
        .lock()
        .map_err(|_| "DiskVacuum could not update its scan state.".to_owned())?;
    *completed_scan = Some(summary.clone());

    Ok(summary)
}

#[tauri::command]
pub fn get_current_scan(state: State<'_, AppState>) -> Result<Option<ScanSummary>, String> {
    state
        .completed_scan
        .lock()
        .map(|completed_scan| completed_scan.clone())
        .map_err(|_| "DiskVacuum could not read its scan state.".to_owned())
}

fn scan_home_directory_blocking(app_handle: AppHandle) -> Result<ScanSummary, String> {
    let home_directory = resolve_home_directory()?;
    scan_directory(&home_directory, "Home directory", Some(app_handle))
}

fn scan_selected_directory_blocking(
    path: String,
    app_handle: AppHandle,
) -> Result<ScanSummary, String> {
    let selected_directory = validate_scan_root(Path::new(&path))?;
    let folder_name = selected_directory
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Selected folder");
    let target_label = format!("Selected folder: {folder_name}");

    scan_directory(&selected_directory, &target_label, Some(app_handle))
}

fn resolve_home_directory() -> Result<PathBuf, String> {
    let home_directory = if cfg!(windows) {
        env::var_os("USERPROFILE").map(PathBuf::from).or_else(|| {
            let drive = env::var_os("HOMEDRIVE")?;
            let path = env::var_os("HOMEPATH")?;
            Some(PathBuf::from(drive).join(path))
        })
    } else {
        env::var_os("HOME").map(PathBuf::from)
    };

    let home_directory =
        home_directory.ok_or_else(|| "Your home directory could not be located.".to_owned())?;
    validate_scan_root(&home_directory)
}

fn validate_scan_root(path: &Path) -> Result<PathBuf, String> {
    let canonical_path = path
        .canonicalize()
        .map_err(|_| "The selected scan location is unavailable.".to_owned())?;
    let metadata = fs::metadata(&canonical_path)
        .map_err(|_| "The selected scan location is unavailable.".to_owned())?;

    if !metadata.is_dir() {
        return Err("The selected scan location must be a directory.".to_owned());
    }

    fs::read_dir(&canonical_path).map_err(|error| match error.kind() {
        std::io::ErrorKind::PermissionDenied => {
            "DiskVacuum does not have permission to inspect that location.".to_owned()
        }
        _ => "The selected scan location could not be read.".to_owned(),
    })?;

    Ok(canonical_path)
}

fn scan_directory(
    root: &Path,
    target_label: &str,
    app_handle: Option<AppHandle>,
) -> Result<ScanSummary, String> {
    let mut accumulator = ScanAccumulator::new(app_handle, target_label);
    accumulator.emit_progress(true);

    let root_entries = fs::read_dir(root)
        .map_err(|_| "The selected scan location could not be read.".to_owned())?;

    for entry in root_entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                accumulator.record_read_error(&error);
                continue;
            }
        };

        let path = entry.path();
        let Some(measured_entry) = scan_entry(&path, &mut accumulator) else {
            continue;
        };

        accumulator.record_top_level_item(ScanNodeSummary {
            id: format!("top-{}", accumulator.top_level_items.len()),
            name: entry.file_name().to_string_lossy().into_owned(),
            kind: measured_entry.kind,
            size_bytes: measured_entry.size_bytes,
        });
    }

    accumulator.emit_progress(true);
    accumulator
        .top_level_items
        .sort_by_key(|item| Reverse(item.size_bytes));
    for (index, item) in accumulator.top_level_items.iter_mut().enumerate() {
        item.id = format!("top-{index}");
    }

    Ok(ScanSummary {
        target_label: target_label.to_owned(),
        completed_at_unix_seconds: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
        total_size_bytes: accumulator.total_size_bytes,
        file_count: accumulator.file_count,
        directory_count: accumulator.directory_count,
        permission_denied_count: accumulator.permission_denied_count,
        unreadable_entry_count: accumulator.unreadable_entry_count,
        skipped_symlink_count: accumulator.skipped_symlink_count,
        skipped_special_file_count: accumulator.skipped_special_file_count,
        top_level_items: accumulator.top_level_items,
    })
}

fn scan_entry(path: &Path, accumulator: &mut ScanAccumulator) -> Option<MeasuredEntry> {
    accumulator.record_entry_visit();

    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => {
            accumulator.record_read_error(&error);
            return None;
        }
    };

    if metadata.file_type().is_symlink() {
        accumulator.skipped_symlink_count += 1;
        return None;
    }

    if metadata.is_file() {
        let size_bytes = metadata.len();
        accumulator.file_count += 1;
        accumulator.total_size_bytes = accumulator.total_size_bytes.saturating_add(size_bytes);
        return Some(MeasuredEntry {
            kind: ScanNodeKind::File,
            size_bytes,
        });
    }

    if metadata.is_dir() {
        accumulator.directory_count += 1;
        let size_bytes = scan_directory_contents(path, accumulator);
        return Some(MeasuredEntry {
            kind: ScanNodeKind::Directory,
            size_bytes,
        });
    }

    accumulator.skipped_special_file_count += 1;
    None
}

fn scan_directory_contents(path: &Path, accumulator: &mut ScanAccumulator) -> u64 {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) => {
            accumulator.record_read_error(&error);
            return 0;
        }
    };

    let mut directory_size = 0_u64;
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                accumulator.record_read_error(&error);
                continue;
            }
        };

        if let Some(measured_entry) = scan_entry(&entry.path(), accumulator) {
            directory_size = directory_size.saturating_add(measured_entry.size_bytes);
        }
    }

    directory_size
}

#[cfg(test)]
mod tests {
    use std::{fs, time::SystemTime};

    use super::scan_directory;

    #[test]
    fn summarizes_files_without_exposing_a_recursive_tree() {
        let fixture = std::env::temp_dir().join(format!(
            "disk-vacuum-scan-test-{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ));
        fs::create_dir_all(fixture.join("nested")).expect("fixture directory should be created");
        fs::write(fixture.join("small.txt"), b"abc").expect("fixture file should be written");
        fs::write(fixture.join("nested").join("large.txt"), b"abcdefgh")
            .expect("fixture file should be written");

        let summary =
            scan_directory(&fixture, "Fixture", None).expect("fixture scan should succeed");

        assert_eq!(summary.total_size_bytes, 11);
        assert_eq!(summary.file_count, 2);
        assert_eq!(summary.directory_count, 2);
        assert!(summary.top_level_items.len() <= 24);
        assert!(summary
            .top_level_items
            .iter()
            .all(|item| item.name != "large.txt"));

        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
    }
}
