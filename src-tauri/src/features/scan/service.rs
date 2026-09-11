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
use sysinfo::Disks;
use tauri::{AppHandle, Emitter, State};

use crate::{
    app_state::{ActiveScan, AppState},
    features::scan::{
        capacity::scan_capacity,
        classification::{classify_path, CATEGORY_COUNT},
        filesystem_identity::{allocated_size, filesystem_id, hard_link_identity, FileIdentity},
        model::{
            AiStorageReport, AppLeftoversReport, CompletedScan, DeveloperCleanupReport,
            LargeFilesPage, LargeFilesQuery, ScanBreadcrumbItem, ScanCapacity, ScanCategory,
            ScanCategorySummary, ScanCommandError, ScanDirectoryPage, ScanDirectoryRecord,
            ScanNodeDetails, ScanNodeKind, ScanNodeSummary, ScanProgress, ScanProgressStage,
            ScanSearchResponse, ScanSummary, ScanTreemapSummary,
        },
    },
    scan_repository::{ScanRepository, ScanWriteSession},
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
    Persistence(String),
}

impl From<ScanFailure> for ScanCommandError {
    fn from(error: ScanFailure) -> Self {
        match error {
            ScanFailure::Cancelled => Self::new("scan_cancelled", "The scan was cancelled."),
            ScanFailure::Message(message) => Self::new("scan_failed", message),
            ScanFailure::Persistence(message) => Self::new("scan_persistence_failed", &message),
        }
    }
}

struct ScanAccumulator {
    app_handle: Option<AppHandle>,
    cancellation: Arc<AtomicBool>,
    target_label: String,
    root_filesystem_id: Option<u64>,
    exclusions: Vec<PathBuf>,
    capacity: Option<ScanCapacity>,
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
    category_size_bytes: [AtomicU64; CATEGORY_COUNT],
    category_file_counts: [AtomicU64; CATEGORY_COUNT],
    top_level_items: Mutex<Vec<ScanNodeSummary>>,
    next_node_id: AtomicU64,
    index_writer: ScanWriteSession,
}

impl ScanAccumulator {
    fn new(
        app_handle: Option<AppHandle>,
        cancellation: Arc<AtomicBool>,
        target_label: &str,
        root_filesystem_id: Option<u64>,
        exclusions: Vec<PathBuf>,
        capacity: Option<ScanCapacity>,
        index_writer: ScanWriteSession,
    ) -> Self {
        let started_at = Instant::now();

        Self {
            app_handle,
            cancellation,
            target_label: target_label.to_owned(),
            root_filesystem_id,
            exclusions,
            capacity,
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
            category_size_bytes: std::array::from_fn(|_| AtomicU64::new(0)),
            category_file_counts: std::array::from_fn(|_| AtomicU64::new(0)),
            top_level_items: Mutex::new(Vec::with_capacity(MAX_TOP_LEVEL_ITEMS)),
            next_node_id: AtomicU64::new(1),
            index_writer,
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
                    stage: super::model::ScanProgressStage::Scanning,
                    target_label: self.target_label.clone(),
                    entries_visited: self.entries_visited.load(Ordering::Relaxed),
                    bytes_observed: self.total_size_bytes.load(Ordering::Relaxed),
                    elapsed_milliseconds: self.started_at.elapsed().as_millis() as u64,
                    capacity: self.capacity.clone(),
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

    fn record_file_category(&self, category: ScanCategory, size_bytes: u64) {
        self.category_size_bytes[category.index()].fetch_add(size_bytes, Ordering::Relaxed);
        self.category_file_counts[category.index()].fetch_add(1, Ordering::Relaxed);
    }

    fn category_summaries(&self) -> Vec<ScanCategorySummary> {
        let mut categories = ScanCategory::ALL
            .into_iter()
            .map(|category| ScanCategorySummary {
                category,
                size_bytes: self.category_size_bytes[category.index()].load(Ordering::Relaxed),
                file_count: self.category_file_counts[category.index()].load(Ordering::Relaxed),
            })
            .filter(|summary| summary.file_count > 0)
            .collect::<Vec<_>>();
        categories.sort_by_key(|summary| Reverse(summary.size_bytes));
        categories
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
        std::mem::take(&mut *top_level_items)
    }

    fn next_node_id(&self) -> u64 {
        self.next_node_id.fetch_add(1, Ordering::Relaxed)
    }

    fn record_directory(&self, directory: ScanDirectoryRecord) -> ScanResult<()> {
        self.index_writer
            .write_directory(directory)
            .map_err(|error| {
                self.cancellation.store(true, Ordering::Relaxed);
                ScanFailure::Persistence(error)
            })
    }
}

struct MeasuredEntry {
    id: u64,
    kind: ScanNodeKind,
    size_bytes: u64,
    category: ScanCategory,
    modified_at_unix_seconds: Option<u64>,
}

#[tauri::command]
pub async fn scan_home_directory(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ScanSummary, ScanCommandError> {
    let active_scan = begin_scan(&state)?;
    let cancellation = active_scan.cancellation.clone();
    let repository = state.scan_repository.clone();
    let exclusions = state.settings.exclusion_paths().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not read scan exclusions.",
        )
    })?;
    let task_result = tauri::async_runtime::spawn_blocking(move || {
        scan_home_directory_blocking(app_handle, cancellation, repository, exclusions)
    })
    .await;

    finish_active_scan(&state, active_scan.id)?;
    let summary = task_result
        .map_err(|_| ScanCommandError::new("scan_failed", "The home scan could not finish."))?
        .map_err(ScanCommandError::from)?;
    store_completed_scan(&state, summary)
}

#[tauri::command]
pub async fn scan_system_storage(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ScanSummary, ScanCommandError> {
    let active_scan = begin_scan(&state)?;
    let cancellation = active_scan.cancellation.clone();
    let repository = state.scan_repository.clone();
    let exclusions = state.settings.exclusion_paths().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not read scan exclusions.",
        )
    })?;
    let task_result = tauri::async_runtime::spawn_blocking(move || {
        scan_system_storage_blocking(app_handle, cancellation, repository, exclusions)
    })
    .await;

    finish_active_scan(&state, active_scan.id)?;
    let summary = task_result
        .map_err(|_| ScanCommandError::new("scan_failed", "The system scan could not finish."))?
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
    let repository = state.scan_repository.clone();
    let exclusions = state.settings.exclusion_paths().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not read scan exclusions.",
        )
    })?;
    let task_result = tauri::async_runtime::spawn_blocking(move || {
        scan_selected_directory_blocking(path, app_handle, cancellation, repository, exclusions)
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
    let mut summary = state.current_scan.lock()
        .map(|scan| scan.clone())
        .map_err(|_| "DiskVacuum could not read its scan state.".to_owned())?;
    if let Some(scan) = summary.as_mut() {
        if let Ok(root) = state.scan_repository.scan_root_path() {
            let disks = Disks::new_with_refreshed_list();
            if let Some(disk) = disks.list().iter()
                .filter(|disk| root.starts_with(disk.mount_point()))
                .max_by_key(|disk| disk.mount_point().components().count())
            {
                scan.capacity = scan_capacity(disk.mount_point(), disk.total_space(), disk.available_space()).ok();
            }
        }
    }
    Ok(summary)
}

#[tauri::command]
pub async fn get_scan_breadcrumbs(
    directory_id: u64,
    state: State<'_, AppState>,
) -> Result<Vec<ScanBreadcrumbItem>, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.breadcrumbs(directory_id))
        .await
        .map_err(|_| "DiskVacuum could not build the scanned path.".to_owned())?
}

#[tauri::command]
pub async fn get_scan_directory(
    directory_id: u64,
    offset: usize,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<ScanDirectoryPage, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.directory(directory_id, offset, limit))
        .await
        .map_err(|_| "DiskVacuum could not query the scanned directory.".to_owned())?
}

#[tauri::command]
pub async fn get_scan_treemap(
    directory_id: u64,
    max_nodes: usize,
    state: State<'_, AppState>,
) -> Result<ScanTreemapSummary, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.treemap(directory_id, max_nodes))
        .await
        .map_err(|_| "DiskVacuum could not query the space map.".to_owned())?
}

#[tauri::command]
pub async fn get_ai_storage(state: State<'_, AppState>) -> Result<AiStorageReport, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.ai_storage())
        .await
        .map_err(|_| "DiskVacuum could not analyze AI storage.".to_owned())?
}

#[tauri::command]
pub async fn get_app_leftovers(state: State<'_, AppState>) -> Result<AppLeftoversReport, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.app_leftovers())
        .await
        .map_err(|_| "DiskVacuum could not analyze application leftovers.".to_owned())?
}

#[tauri::command]
pub async fn get_developer_cleanup(
    state: State<'_, AppState>,
) -> Result<DeveloperCleanupReport, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.developer_cleanup())
        .await
        .map_err(|_| "DiskVacuum could not analyze developer storage.".to_owned())?
}

#[tauri::command]
pub async fn get_large_files(
    request: LargeFilesQuery,
    state: State<'_, AppState>,
) -> Result<LargeFilesPage, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.large_files(&request))
        .await
        .map_err(|_| "DiskVacuum could not query large files.".to_owned())?
}

#[tauri::command]
pub async fn search_scan(
    query: String,
    limit: usize,
    state: State<'_, AppState>,
) -> Result<ScanSearchResponse, String> {
    let search_id = state.latest_search_id.fetch_add(1, Ordering::Relaxed) + 1;
    let repository = state.scan_repository.clone();
    let latest_search_id = Arc::clone(&state.latest_search_id);
    tauri::async_runtime::spawn_blocking(move || {
        let response = repository.search(&query, limit)?;
        if latest_search_id.load(Ordering::Relaxed) != search_id {
            return Ok(ScanSearchResponse {
                superseded: true,
                results: Vec::new(),
                ..response
            });
        }
        Ok(response)
    })
    .await
    .map_err(|_| "DiskVacuum could not search the scan database.".to_owned())?
}

#[tauri::command]
pub async fn get_scan_node_details(
    directory_id: u64,
    node_id: u64,
    state: State<'_, AppState>,
) -> Result<ScanNodeDetails, String> {
    let repository = state.scan_repository.clone();
    tauri::async_runtime::spawn_blocking(move || repository.node_details(directory_id, node_id))
        .await
        .map_err(|_| "DiskVacuum could not query item details.".to_owned())?
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

fn emit_scan_saving(app_handle: &AppHandle, summary: &ScanSummary) {
    let _ = app_handle.emit(
        PROGRESS_EVENT_NAME,
        ScanProgress {
            stage: ScanProgressStage::Saving,
            target_label: summary.target_label.clone(),
            entries_visited: summary.file_count + summary.directory_count,
            bytes_observed: summary.total_size_bytes,
            elapsed_milliseconds: 0,
            capacity: summary.capacity.clone(),
        },
    );
}

fn store_completed_scan(
    state: &AppState,
    completed: CompletedScan,
) -> Result<ScanSummary, ScanCommandError> {
    let summary = completed.summary;
    let mut current_scan = state.current_scan.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not update its scan state.",
        )
    })?;
    *current_scan = Some(summary.clone());
    *state.duplicate_report.lock().map_err(|_| {
        ScanCommandError::new(
            "state_unavailable",
            "DiskVacuum could not clear stale duplicate results.",
        )
    })? = None;
    Ok(summary)
}

fn scan_system_storage_blocking(
    app_handle: AppHandle,
    cancellation: Arc<AtomicBool>,
    repository: ScanRepository,
    exclusions: Vec<PathBuf>,
) -> ScanResult<CompletedScan> {
    let (system_root, capacity) = resolve_system_storage()?;
    scan_directory(
        &system_root,
        "System storage",
        Some(app_handle),
        Some(capacity),
        exclusions,
        cancellation,
        repository,
    )
}

fn scan_home_directory_blocking(
    app_handle: AppHandle,
    cancellation: Arc<AtomicBool>,
    repository: ScanRepository,
    exclusions: Vec<PathBuf>,
) -> ScanResult<CompletedScan> {
    let home_directory = resolve_home_directory()?;
    scan_directory(
        &home_directory,
        "Home directory",
        Some(app_handle),
        None,
        exclusions,
        cancellation,
        repository,
    )
}

fn scan_selected_directory_blocking(
    path: String,
    app_handle: AppHandle,
    cancellation: Arc<AtomicBool>,
    repository: ScanRepository,
    exclusions: Vec<PathBuf>,
) -> ScanResult<CompletedScan> {
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
        None,
        exclusions,
        cancellation,
        repository,
    )
}

#[cfg(unix)]
fn resolve_system_storage() -> ScanResult<(PathBuf, ScanCapacity)> {
    let disks = Disks::new_with_refreshed_list();
    let preferred_mount = if cfg!(target_os = "macos") {
        Path::new("/System/Volumes/Data")
    } else {
        Path::new("/")
    };
    let fallback_mount = Path::new("/");
    let disk = disks
        .list()
        .iter()
        .find(|disk| disk.mount_point() == preferred_mount)
        .or_else(|| {
            disks
                .list()
                .iter()
                .find(|disk| disk.mount_point() == fallback_mount)
        })
        .ok_or(ScanFailure::Message(
            "The primary system storage volume could not be located.",
        ))?;

    let root = validate_scan_root(disk.mount_point())?;
    let capacity = scan_capacity(
        disk.mount_point(),
        disk.total_space(),
        disk.available_space(),
    )
    .map_err(ScanFailure::Message)?;
    Ok((root, capacity))
}

#[cfg(not(unix))]
fn resolve_system_storage() -> ScanResult<(PathBuf, ScanCapacity)> {
    Err(ScanFailure::Message(
        "Whole-system scanning is currently available on macOS and Linux.",
    ))
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
    capacity: Option<ScanCapacity>,
    exclusions: Vec<PathBuf>,
    cancellation: Arc<AtomicBool>,
    repository: ScanRepository,
) -> ScanResult<CompletedScan> {
    const ROOT_DIRECTORY_ID: u64 = 0;

    let root_metadata = fs::metadata(root)
        .map_err(|_| ScanFailure::Message("The selected scan location is unavailable."))?;
    let root_filesystem_id = filesystem_id(&root_metadata);
    let index_writer = repository
        .begin_scan_write()
        .map_err(ScanFailure::Persistence)?;
    let accumulator = Arc::new(ScanAccumulator::new(
        app_handle,
        cancellation,
        target_label,
        root_filesystem_id,
        exclusions,
        capacity,
        index_writer,
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

    let root_items = worker_pool.install(|| {
        root_entries
            .par_bridge()
            .filter_map(|entry| {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(error) => {
                        accumulator.record_read_error(&error);
                        return None;
                    }
                };

                scan_entry(&entry.path(), ROOT_DIRECTORY_ID, &accumulator)
                    .ok()
                    .flatten()
                    .map(|measured_entry| ScanNodeSummary {
                        id: measured_entry.id,
                        name: entry.file_name().to_string_lossy().into_owned(),
                        kind: measured_entry.kind,
                        size_bytes: measured_entry.size_bytes,
                        category: measured_entry.category,
                        modified_at_unix_seconds: measured_entry.modified_at_unix_seconds,
                    })
            })
            .collect::<Vec<_>>()
    });

    accumulator.check_cancelled()?;
    for item in &root_items {
        accumulator.record_top_level_item(item.clone());
    }
    accumulator.record_directory(ScanDirectoryRecord {
        id: ROOT_DIRECTORY_ID,
        parent_id: None,
        name: target_label.to_owned(),
        path: root.to_path_buf(),
        children: root_items,
    })?;
    accumulator.emit_progress(true);

    let summary = ScanSummary {
        target_label: target_label.to_owned(),
        completed_at_unix_seconds: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or_default(),
        total_size_bytes: accumulator.total_size_bytes.load(Ordering::Relaxed),
        capacity: accumulator.capacity.clone(),
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
        root_directory_id: ROOT_DIRECTORY_ID,
        top_level_items: accumulator.take_top_level_items(),
        categories: accumulator.category_summaries(),
    };

    let root_path = root.to_path_buf();
    let app_handle = accumulator.app_handle.clone();
    let writer = Arc::into_inner(accumulator)
        .ok_or_else(|| ScanFailure::Persistence("Scan workers did not shut down cleanly.".into()))?
        .index_writer;
    if let Some(app_handle) = app_handle {
        emit_scan_saving(&app_handle, &summary);
    }
    writer
        .finish(root_path.clone(), summary.clone())
        .map_err(ScanFailure::Persistence)?;
    Ok(CompletedScan {
        root_path,
        summary,
        directories: Default::default(),
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
    parent_id: u64,
    accumulator: &Arc<ScanAccumulator>,
) -> ScanResult<Option<MeasuredEntry>> {
    if accumulator
        .exclusions
        .iter()
        .any(|excluded| path.starts_with(excluded))
    {
        return Ok(None);
    }
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

    let modified_at_unix_seconds = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs());

    if metadata.is_file() {
        let node_id = accumulator.next_node_id();
        accumulator.file_count.fetch_add(1, Ordering::Relaxed);
        let category = classify_path(path, false);
        if hard_link_identity(&metadata).is_some_and(|identity| {
            !accumulator
                .seen_hard_links
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .insert(identity)
        }) {
            accumulator.record_file_category(category, 0);
            accumulator
                .skipped_hard_link_count
                .fetch_add(1, Ordering::Relaxed);
            return Ok(Some(MeasuredEntry {
                id: node_id,
                kind: ScanNodeKind::File,
                size_bytes: 0,
                category,
                modified_at_unix_seconds,
            }));
        }

        let size_bytes = allocated_size(&metadata);
        accumulator.record_file_category(category, size_bytes);
        accumulator
            .total_size_bytes
            .fetch_add(size_bytes, Ordering::Relaxed);
        return Ok(Some(MeasuredEntry {
            id: node_id,
            kind: ScanNodeKind::File,
            size_bytes,
            category,
            modified_at_unix_seconds,
        }));
    }

    if metadata.is_dir() {
        let node_id = accumulator.next_node_id();
        accumulator.directory_count.fetch_add(1, Ordering::Relaxed);
        let (size_bytes, children, child_category) =
            scan_directory_contents(path, node_id, accumulator)?;
        let path_category = classify_path(path, true);
        let category = if path_category == ScanCategory::Other {
            child_category
        } else {
            path_category
        };
        accumulator.record_directory(ScanDirectoryRecord {
            id: node_id,
            parent_id: Some(parent_id),
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.to_string_lossy().into_owned()),
            path: path.to_path_buf(),
            children,
        })?;
        return Ok(Some(MeasuredEntry {
            id: node_id,
            kind: ScanNodeKind::Directory,
            size_bytes,
            category,
            modified_at_unix_seconds,
        }));
    }

    accumulator
        .skipped_special_file_count
        .fetch_add(1, Ordering::Relaxed);
    Ok(None)
}

fn scan_directory_contents(
    path: &Path,
    directory_id: u64,
    accumulator: &Arc<ScanAccumulator>,
) -> ScanResult<(u64, Vec<ScanNodeSummary>, ScanCategory)> {
    accumulator.check_cancelled()?;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(error) => {
            accumulator.record_read_error(&error);
            return Ok((0, Vec::new(), ScanCategory::Other));
        }
    };

    let children = entries
        .par_bridge()
        .filter_map(|entry| {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    accumulator.record_read_error(&error);
                    return None;
                }
            };

            scan_entry(&entry.path(), directory_id, accumulator)
                .ok()
                .flatten()
                .map(|measured_entry| ScanNodeSummary {
                    id: measured_entry.id,
                    name: entry.file_name().to_string_lossy().into_owned(),
                    kind: measured_entry.kind,
                    size_bytes: measured_entry.size_bytes,
                    category: measured_entry.category,
                    modified_at_unix_seconds: measured_entry.modified_at_unix_seconds,
                })
        })
        .collect::<Vec<_>>();
    let size_bytes = children
        .iter()
        .fold(0_u64, |total, child| total.saturating_add(child.size_bytes));
    let mut category_bytes = [0_u64; CATEGORY_COUNT];
    for child in &children {
        category_bytes[child.category.index()] =
            category_bytes[child.category.index()].saturating_add(child.size_bytes);
    }
    let category = ScanCategory::ALL
        .into_iter()
        .max_by_key(|category| category_bytes[category.index()])
        .filter(|category| category_bytes[category.index()] > 0)
        .unwrap_or(ScanCategory::Other);

    Ok((size_bytes, children, category))
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

    use super::{allocated_size, scan_directory, ScanCapacity, ScanFailure, ScanRepository};

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
        let repository_path = unique_fixture_path("scan-repository");
        let repository = ScanRepository::open(&repository_path).expect("repository should open");

        let completed = scan_directory(
            &fixture,
            "Fixture",
            None,
            Some(ScanCapacity {
                total_space_bytes: 100,
                used_space_bytes: 75,
                free_space_bytes: 25,
                available_space_bytes: 20,
                reserved_space_bytes: 5,
            }),
            Vec::new(),
            Arc::new(AtomicBool::new(false)),
            repository.clone(),
        )
        .expect("fixture scan should succeed");
        let summary = &completed.summary;

        let expected_size = allocated_size(
            &fs::metadata(fixture.join("small.txt")).expect("small file metadata should exist"),
        ) + allocated_size(
            &fs::metadata(fixture.join("nested").join("large.txt"))
                .expect("large file metadata should exist"),
        );
        assert_eq!(summary.total_size_bytes, expected_size);
        let capacity = summary
            .capacity
            .as_ref()
            .expect("fixture capacity should be preserved");
        assert_eq!(capacity.total_space_bytes, 100);
        assert_eq!(capacity.used_space_bytes, 75);
        assert_eq!(capacity.free_space_bytes, 25);
        assert_eq!(capacity.available_space_bytes, 20);
        assert_eq!(capacity.reserved_space_bytes, 5);
        assert_eq!(summary.file_count, 2);
        assert_eq!(
            summary
                .categories
                .iter()
                .map(|item| item.file_count)
                .sum::<u64>(),
            2
        );
        assert_eq!(
            summary
                .categories
                .iter()
                .map(|item| item.size_bytes)
                .sum::<u64>(),
            expected_size
        );
        assert_eq!(summary.directory_count, 2);
        assert!(summary.top_level_items.len() <= 24);
        assert!(summary
            .top_level_items
            .iter()
            .all(|item| item.name != "large.txt"));
        let root = repository
            .directory(summary.root_directory_id, 0, 100)
            .expect("root directory should be indexed");
        assert_eq!(root.items.len(), 2);

        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
        fs::remove_dir_all(&repository_path).expect("repository should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn counts_hard_link_bytes_once() {
        let fixture = unique_fixture_path("hard-link-test");
        fs::create_dir_all(&fixture).expect("fixture directory should be created");
        let original = fixture.join("original.bin");
        fs::write(&original, b"abcdefgh").expect("fixture file should be written");
        let repository_path = unique_fixture_path("hard-link-repository");
        let repository = ScanRepository::open(&repository_path).expect("repository should open");
        fs::hard_link(&original, fixture.join("linked.bin"))
            .expect("fixture hard link should be created");

        let completed = scan_directory(
            &fixture,
            "Fixture",
            None,
            None,
            Vec::new(),
            Arc::new(AtomicBool::new(false)),
            repository,
        )
        .expect("fixture scan should succeed");
        let summary = &completed.summary;

        assert_eq!(summary.file_count, 2);
        assert_eq!(
            summary.total_size_bytes,
            allocated_size(&fs::metadata(&original).expect("original metadata should exist"))
        );
        assert_eq!(summary.skipped_hard_link_count, 1);
        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
        fs::remove_dir_all(&repository_path).expect("repository should be removed");
    }

    #[test]
    fn stops_before_traversal_when_cancellation_is_requested() {
        let fixture = unique_fixture_path("cancel-test");
        fs::create_dir_all(&fixture).expect("fixture directory should be created");
        let repository_path = unique_fixture_path("cancel-repository");
        let repository = ScanRepository::open(&repository_path).expect("repository should open");
        let cancellation = Arc::new(AtomicBool::new(false));
        cancellation.store(true, Ordering::Relaxed);

        let result = scan_directory(
            &fixture,
            "Fixture",
            None,
            None,
            Vec::new(),
            cancellation,
            repository,
        );

        assert!(matches!(result, Err(ScanFailure::Cancelled)));
        fs::remove_dir_all(&fixture).expect("fixture directory should be removed");
        fs::remove_dir_all(&repository_path).expect("repository should be removed");
    }
}
