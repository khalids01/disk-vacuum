use std::{
    cmp::Reverse,
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use rayon::{iter::ParallelBridge, prelude::ParallelIterator, ThreadPoolBuilder};
use tauri::{AppHandle, Emitter, State};

use crate::{
    app_state::{ActiveScan, AppState},
    features::scan::{
        filesystem_identity::{filesystem_id, hard_link_identity, FileIdentity},
        model::{ScanCommandError, ScanNodeKind, ScanNodeSummary, ScanProgress, ScanSummary},
    },
};

const MAX_TOP_LEVEL_ITEMS: usize = 24;
const MAX_SCAN_WORKERS: usize = 16;
const PROGRESS_BATCH_SIZE: u64 = 1_024;
const PROGRESS_EVENT_NAME: &str = "scan-progress";
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

type ScanResult<T> = Result<T, ScanFailure>;

#[derive(Debug)]
enum ScanFailure {
    Cancelled,
    Message(&'static str),
}

impl From<ScanFailure> for ScanCommandError {
    fn from(error: ScanFailure) -> Self {
        match error {
            ScanFailure::Cancelled => Self::new("scan_cancelled", "The scan was cancelled."),
            ScanFailure::Message(message) => Self::new("scan_failed", message),
        }
    }
}

struct ScanAccumulator {
    app_handle: Option<AppHandle>,
    cancellation: Arc<AtomicBool>,
    target_label: String,
    root_filesystem_id: Option<u64>,
    seen_hard_links: Mutex<HashSet<FileIdentity>>,
    started_at: Instant,
    last_progress_emit: Mutex<Instant>,
    entries_visited: AtomicU64,
    total_size_bytes: AtomicU64,
    file_count: AtomicU64,
    directory_count: AtomicU64,
    permission_denied_count: AtomicU64,
    unreadable_entry_count: AtomicU64,
    skipped_symlink_count: AtomicU64,
    skipped_hard_link_count: AtomicU64,
    skipped_mounted_filesystem_count: AtomicU64,
    skipped_special_file_count: AtomicU64,
    top_level_items: Mutex<Vec<ScanNodeSummary>>,
}

impl ScanAccumulator {
    fn new(
        app_handle: Option<AppHandle>,
        cancellation: Arc<AtomicBool>,
        target_label: &str,
        root_filesystem_id: Option<u64>,
    ) -> Self {
        let started_at = Instant::now();

        Self {
            app_handle,
            cancellation,
            target_label: target_label.to_owned(),
            root_filesystem_id,
            seen_hard_links: Mutex::new(HashSet::new()),
            started_at,
            last_progress_emit: Mutex::new(started_at),
            entries_visited: AtomicU64::new(0),
            total_size_bytes: AtomicU64::new(0),
            file_count: AtomicU64::new(0),
            directory_count: AtomicU64::new(1),
            permission_denied_count: AtomicU64::new(0),
            unreadable_entry_count: AtomicU64::new(0),
            skipped_symlink_count: AtomicU64::new(0),
            skipped_hard_link_count: AtomicU64::new(0),
            skipped_mounted_filesystem_count: AtomicU64::new(0),
            skipped_special_file_count: AtomicU64::new(0),
            top_level_items: Mutex::new(Vec::with_capacity(MAX_TOP_LEVEL_ITEMS)),
        }
    }

    fn check_cancelled(&self) -> ScanResult<()> {
        if self.cancellation.load(Ordering::Relaxed) {
            return Err(ScanFailure::Cancelled);
        }

        Ok(())
    }

    fn record_entry_visit(&self) -> ScanResult<()> {
        self.check_cancelled()?;
        let entries_visited = self.entries_visited.fetch_add(1, Ordering::Relaxed) + 1;
        if entries_visited.is_multiple_of(PROGRESS_BATCH_SIZE) {
            self.emit_progress(false);
        }
        Ok(())
    }

    fn emit_progress(&self, force: bool) {
        let mut last_progress_emit = self
            .last_progress_emit
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !force && last_progress_emit.elapsed() < PROGRESS_INTERVAL {
            return;
        }

        *last_progress_emit = Instant::now();
        drop(last_progress_emit);

        if let Some(app_handle) = &self.app_handle {
            let _ = app_handle.emit(
                PROGRESS_EVENT_NAME,
                ScanProgress {
                    target_label: self.target_label.clone(),
                    entries_visited: self.entries_visited.load(Ordering::Relaxed),
                    bytes_observed: self.total_size_bytes.load(Ordering::Relaxed),
                    elapsed_milliseconds: self.started_at.elapsed().as_millis() as u64,
                },
            );
        }
    }

    fn record_read_error(&self, error: &std::io::Error) {
        let counter = if error.kind() == std::io::ErrorKind::PermissionDenied {
            &self.permission_denied_count
        } else {
            &self.unreadable_entry_count
        };
        counter.fetch_add(1, Ordering::Relaxed);
    }

    fn record_top_level_item(&self, item: ScanNodeSummary) {
        let mut top_level_items = self
            .top_level_items
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if top_level_items.len() < MAX_TOP_LEVEL_ITEMS {
            top_level_items.push(item);
            return;
        }

        let Some((smallest_index, smallest_item)) = top_level_items
            .iter()
            .enumerate()
            .min_by_key(|(_, item)| item.size_bytes)
        else {
            return;
        };

        if item.size_bytes > smallest_item.size_bytes {
            top_level_items[smallest_index] = item;
        }
    }

    fn take_top_level_items(&self) -> Vec<ScanNodeSummary> {
        let mut top_level_items = self
            .top_level_items
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        top_level_items.sort_by_key(|item| Reverse(item.size_bytes));
        for (index, item) in top_level_items.iter_mut().enumerate() {
            item.id = format!("top-{index}");
        }
        std::mem::take(&mut *top_level_items)
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
) -> Result<ScanSummary, ScanCommandError> {
    let active_scan = begin_scan(&state)?;
    let cancellation = active_scan.cancellation.clone();
    let task_result = tauri::async_runtime::spawn_blocking(move || {
        scan_home_directory_blocking(app_handle, cancellation)
    })
    .await;

    finish_active_scan(&state, active_scan.id)?;
    let summary = task_result
        .map_err(|_| ScanCommandError::new("scan_failed", "The home scan could not finish."))?
        .map_err(ScanCommandError::from)?;
    store_completed_scan(&state, summary)
}

#[tauri::command]
pub async fn scan_directory_path(
    path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ScanSummary, ScanCommandError> {
    let active_scan = begin_scan(&state)?;
    let cancellation = active_scan.cancellation.clone();
    let task_result = tauri::async_runtime::spawn_blocking(move || {
        scan_selected_directory_blocking(path, app_handle, cancellation)
    })
    .await;

    finish_active_scan(&state, active_scan.id)?;
    let summary = task_result
        .map_err(|_| ScanCommandError::new("scan_failed", "The folder scan could not finish."))?
        .map_err(ScanCommandError::from)?;
    store_completed_scan(&state, summary)
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> Result<bool, ScanCommandError> {
    let active_scan = state.active_scan.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not read its scan state.",
        )
    })?;

    let Some(active_scan) = active_scan.as_ref() else {
        return Ok(false);
    };

    active_scan.cancellation.store(true, Ordering::Relaxed);
    Ok(true)
}

#[tauri::command]
pub fn get_current_scan(state: State<'_, AppState>) -> Result<Option<ScanSummary>, String> {
    state
        .completed_scan
        .lock()
        .map(|completed_scan| completed_scan.clone())
        .map_err(|_| "DiskVacuum could not read its scan state.".to_owned())
}

fn begin_scan(state: &AppState) -> Result<ActiveScan, ScanCommandError> {
    let mut active_scan = state.active_scan.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not update its scan state.",
        )
    })?;

    if active_scan.is_some() {
        return Err(ScanCommandError::new(
            "scan_already_running",
            "Another scan is already running.",
        ));
    }

    let scan = ActiveScan {
        id: state.next_scan_id.fetch_add(1, Ordering::Relaxed),
        cancellation: Arc::new(AtomicBool::new(false)),
    };
    *active_scan = Some(scan.clone());
    Ok(scan)
}

fn finish_active_scan(state: &AppState, scan_id: u64) -> Result<(), ScanCommandError> {
    let mut active_scan = state.active_scan.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not update its scan state.",
        )
    })?;

    if active_scan.as_ref().is_some_and(|scan| scan.id == scan_id) {
        *active_scan = None;
    }

    Ok(())
}

fn store_completed_scan(
    state: &AppState,
    summary: ScanSummary,
) -> Result<ScanSummary, ScanCommandError> {
    let mut completed_scan = state.completed_scan.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not update its scan state.",
        )
    })?;
    *completed_scan = Some(summary.clone());
    Ok(summary)
}

fn scan_home_directory_blocking(
    app_handle: AppHandle,
    cancellation: Arc<AtomicBool>,
) -> ScanResult<ScanSummary> {
    let home_directory = resolve_home_directory()?;
    scan_directory(
        &home_directory,
        "Home directory",
        Some(app_handle),
        cancellation,
    )
}

fn scan_selected_directory_blocking(
    path: String,
    app_handle: AppHandle,
    cancellation: Arc<AtomicBool>,
) -> ScanResult<ScanSummary> {
    let selected_directory = validate_scan_root(Path::new(&path))?;
    let folder_name = selected_directory
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Selected folder");
    let target_label = format!("Selected folder: {folder_name}");

    scan_directory(
        &selected_directory,
        &target_label,
        Some(app_handle),
        cancellation,
    )
}

fn resolve_home_directory() -> ScanResult<PathBuf> {
    let home_directory = if cfg!(windows) {
        env::var_os("USERPROFILE").map(PathBuf::from).or_else(|| {
            let drive = env::var_os("HOMEDRIVE")?;
            let path = env::var_os("HOMEPATH")?;
            Some(PathBuf::from(drive).join(path))
        })
    } else {
        env::var_os("HOME").map(PathBuf::from)
    };

    let home_directory = home_directory.ok_or(ScanFailure::Message(
        "Your home directory could not be located.",
    ))?;
    validate_scan_root(&home_directory)
}

fn validate_scan_root(path: &Path) -> ScanResult<PathBuf> {
    let canonical_path = path
        .canonicalize()
        .map_err(|_| ScanFailure::Message("The selected scan location is unavailable."))?;
    let metadata = fs::metadata(&canonical_path)
        .map_err(|_| ScanFailure::Message("The selected scan location is unavailable."))?;

    if !metadata.is_dir() {
        return Err(ScanFailure::Message(
            "The selected scan location must be a directory.",
        ));
    }

    fs::read_dir(&canonical_path).map_err(|error| match error.kind() {
        std::io::ErrorKind::PermissionDenied => {
            ScanFailure::Message("DiskVacuum does not have permission to inspect that location.")
        }
        _ => ScanFailure::Message("The selected scan location could not be read."),
    })?;

    Ok(canonical_path)
}

fn scan_directory(
    root: &Path,
    target_label: &str,
    app_handle: Option<AppHandle>,
    cancellation: Arc<AtomicBool>,
) -> ScanResult<ScanSummary> {
    let root_metadata = fs::metadata(root)
        .map_err(|_| ScanFailure::Message("The selected scan location is unavailable."))?;
    let root_filesystem_id = filesystem_id(&root_metadata);
    let accumulator = Arc::new(ScanAccumulator::new(
        app_handle,
        cancellation,
        target_label,
        root_filesystem_id,
    ));
    accumulator.check_cancelled()?;
    accumulator.emit_progress(true);

    let root_entries = fs::read_dir(root)
        .map_err(|_| ScanFailure::Message("The selected scan location could not be read."))?;
    let worker_pool = ThreadPoolBuilder::new()
        .num_threads(scan_worker_count())
        .thread_name(|index| format!("disk-vacuum-scan-{index}"))
        .build()
        .map_err(|_| ScanFailure::Message("The scan worker pool could not be created."))?;

    worker_pool.install(|| {
        root_entries.par_bridge().for_each(|entry| {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    accumulator.record_read_error(&error);
                    return;
                }
            };

            let Ok(Some(measured_entry)) = scan_entry(&entry.path(), &accumulator) else {
                return;
            };

            accumulator.record_top_level_item(ScanNodeSummary {
                id: String::new(),
                name: entry.file_name().to_string_lossy().into_owned(),
                kind: measured_entry.kind,
                size_bytes: measured_entry.size_bytes,
            });
        });
    });

    accumulator.check_cancelled()?;
    accumulator.emit_progress(true);

    Ok(ScanSummary {
        target_label: target_label.to_owned(),
        completed_at_unix_seconds: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
        total_size_bytes: accumulator.total_size_bytes.load(Ordering::Relaxed),
        file_count: accumulator.file_count.load(Ordering::Relaxed),
        directory_count: accumulator.directory_count.load(Ordering::Relaxed),
        permission_denied_count: accumulator.permission_denied_count.load(Ordering::Relaxed),
        unreadable_entry_count: accumulator.unreadable_entry_count.load(Ordering::Relaxed),
        skipped_symlink_count: accumulator.skipped_symlink_count.load(Ordering::Relaxed),
        skipped_hard_link_count: accumulator.skipped_hard_link_count.load(Ordering::Relaxed),
        skipped_mounted_filesystem_count: accumulator
            .skipped_mounted_filesystem_count
            .load(Ordering::Relaxed),
        skipped_special_file_count: accumulator
            .skipped_special_file_count
            .load(Ordering::Relaxed),
        top_level_items: accumulator.take_top_level_items(),
    })
}

fn scan_worker_count() -> usize {
    std::thread::available_parallelism()
        .map(|parallelism| usize::from(parallelism).saturating_mul(2))
        .unwrap_or(2)
        .clamp(1, MAX_SCAN_WORKERS)
}

fn scan_entry(
    path: &Path,
    accumulator: &Arc<ScanAccumulator>,
) -> ScanResult<Option<MeasuredEntry>> {
    accumulator.record_entry_visit()?;

    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => {
            accumulator.record_read_error(&error);
            return Ok(None);
        }
    };

    if metadata.file_type().is_symlink() {
        accumulator
            .skipped_symlink_count
            .fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    if accumulator.root_filesystem_id.is_some()
        && filesystem_id(&metadata) != accumulator.root_filesystem_id
    {
        accumulator
            .skipped_mounted_filesystem_count
            .fetch_add(1, Ordering::Relaxed);
        return Ok(None);
    }

    if metadata.is_file() {
        accumulator.file_count.fetch_add(1, Ordering::Relaxed);
        if hard_link_identity(&metadata).is_some_and(|identity| {
            !accumulator
                .seen_hard_links
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .insert(identity)
        }) {
            accumulator
                .skipped_hard_link_count
                .fetch_add(1, Ordering::Relaxed);
            return Ok(Some(MeasuredEntry {
                kind: ScanNodeKind::File,
                size_bytes: 0,
            }));
        }

        let size_bytes = metadata.len();
        accumulator
            .total_size_bytes
            .fetch_add(size_bytes, Ordering::Relaxed);
        return Ok(Some(MeasuredEntry {
            kind: ScanNodeKind::File,
            size_bytes,
        }));
    }

    if metadata.is_dir() {
        accumulator.directory_count.fetch_add(1, Ordering::Relaxed);
        let size_bytes = scan_directory_contents(path, accumulator)?;
        return Ok(Some(MeasuredEntry {
            kind: ScanNodeKind::Directory,
            size_bytes,
        }));
    }

    accumulator
        .skipped_special_file_count
        .fetch_add(1, Ordering::Relaxed);
    Ok(None)
}

fn scan_directory_contents(path: &Path, accumulator: &Arc<ScanAccumulator>) -> ScanResult<u64> {
    accumulator.check_cancelled()?;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) => {
            accumulator.record_read_error(&error);
            return Ok(0);
        }
    };

    let directory_size = entries
        .par_bridge()
        .map(|entry| {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    accumulator.record_read_error(&error);
                    return 0;
                }
            };

            scan_entry(&entry.path(), accumulator)
                .ok()
                .flatten()
                .map_or(0, |measured_entry| measured_entry.size_bytes)
        })
        .sum();

    Ok(directory_size)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::SystemTime,
    };

    use super::{scan_directory, ScanFailure};

    fn unique_fixture_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "disk-vacuum-{name}-{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .expect("system clock should be after epoch")
                .as_nanos()
        ))
    }

    #[test]
    fn summarizes_files_without_exposing_a_recursive_tree() {
        let fixture = unique_fixture_path("scan-test");
        fs::create_dir_all(fixture.join("nested")).expect("fixture directory should be created");
        fs::write(fixture.join("small.txt"), b"abc").expect("fixture file should be written");
        fs::write(fixture.join("nested").join("large.txt"), b"abcdefgh")
            .expect("fixture file should be written");

        let summary = scan_directory(&fixture, "Fixture", None, Arc::new(AtomicBool::new(false)))
            .expect("fixture scan should succeed");

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

    #[cfg(unix)]
    #[test]
    fn counts_hard_link_bytes_once() {
        let fixture = unique_fixture_path("hard-link-test");
        fs::create_dir_all(&fixture).expect("fixture directory should be created");
        let original = fixture.join("original.bin");
        fs::write(&original, b"abcdefgh").expect("fixture file should be written");
        fs::hard_link(&original, fixture.join("linked.bin"))
            .expect("fixture hard link should be created");

        let summary = scan_directory(&fixture, "Fixture", None, Arc::new(AtomicBool::new(false)))
            .expect("fixture scan should succeed");

        assert_eq!(summary.file_count, 2);
        assert_eq!(summary.total_size_bytes, 8);
        assert_eq!(summary.skipped_hard_link_count, 1);
        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
    }

    #[test]
    fn stops_before_traversal_when_cancellation_is_requested() {
        let fixture = unique_fixture_path("cancel-test");
        fs::create_dir_all(&fixture).expect("fixture directory should be created");
        let cancellation = Arc::new(AtomicBool::new(false));
        cancellation.store(true, Ordering::Relaxed);

        let result = scan_directory(&fixture, "Fixture", None, cancellation);

        assert!(matches!(result, Err(ScanFailure::Cancelled)));
        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
    }
}
