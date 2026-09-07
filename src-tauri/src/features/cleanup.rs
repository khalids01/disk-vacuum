use crate::{
    app_state::AppState,
    features::scan::model::{DuplicateFile, DuplicateGroup, DuplicateReport, ScanCategory},
};
use serde::Serialize;
use std::{collections::HashSet, fs, fs::File, io::Read, path::Path};
use tauri::State;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupIssue {
    pub id: u64,
    pub path: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPreview {
    pub ready: Vec<DuplicateFile>,
    pub rejected: Vec<CleanupIssue>,
    pub reclaimable_size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub moved_ids: Vec<u64>,
    pub failed: Vec<CleanupIssue>,
    pub reclaimed_size_bytes: u64,
}

#[tauri::command]
pub fn preview_duplicate_cleanup(
    file_ids: Vec<u64>,
    state: State<'_, AppState>,
) -> Result<CleanupPreview, String> {
    build_preview(&file_ids, &state)
}

#[tauri::command]
pub async fn trash_duplicate_files(
    file_ids: Vec<u64>,
    state: State<'_, AppState>,
) -> Result<CleanupResult, String> {
    let preview = build_preview(&file_ids, &state)?;
    if !preview.rejected.is_empty() {
        return Err(
            "Some selected files failed safety validation. Review them before trying again.".into(),
        );
    }
    let outcomes = tauri::async_runtime::spawn_blocking(move || {
        preview
            .ready
            .into_iter()
            .map(|file| {
                let result = trash::delete(&file.path).map_err(|error| error.to_string());
                (file, result)
            })
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|_| "The Trash operation stopped unexpectedly.".to_owned())?;

    let mut moved_ids = Vec::new();
    let mut failed = Vec::new();
    let mut reclaimed_size_bytes = 0;
    for (file, outcome) in outcomes {
        match outcome {
            Ok(()) => {
                moved_ids.push(file.id);
                reclaimed_size_bytes += file.size_bytes;
            }
            Err(reason) => failed.push(CleanupIssue {
                id: file.id,
                path: file.path,
                reason,
            }),
        }
    }
    update_report(&state, &moved_ids)?;
    Ok(CleanupResult {
        moved_ids,
        failed,
        reclaimed_size_bytes,
    })
}

fn build_preview(file_ids: &[u64], state: &AppState) -> Result<CleanupPreview, String> {
    let root = fs::canonicalize(state.scan_repository.scan_root_path()?)
        .map_err(|error| format!("The scanned root is no longer available: {error}"))?;
    let report = state
        .duplicate_report
        .lock()
        .map_err(|_| "Duplicate state unavailable.")?
        .clone()
        .ok_or("Run duplicate analysis before reviewing cleanup.")?;
    let mut preview = preview_report(file_ids, &root, report)?;
    let mut allowed = Vec::new();
    for file in std::mem::take(&mut preview.ready) {
        let excluded = fs::canonicalize(&file.path)
            .ok()
            .is_some_and(|path| state.settings.is_excluded(&path).unwrap_or(true));
        if excluded {
            preview.rejected.push(CleanupIssue {
                id: file.id,
                path: file.path,
                reason: "This path is protected by your exclusions.".into(),
            });
        } else {
            allowed.push(file);
        }
    }
    preview.ready = allowed;
    preview.reclaimable_size_bytes = preview.ready.iter().map(|file| file.size_bytes).sum();
    Ok(preview)
}

fn preview_report(
    file_ids: &[u64],
    root: &Path,
    report: DuplicateReport,
) -> Result<CleanupPreview, String> {
    let requested = file_ids.iter().copied().collect::<HashSet<_>>();
    if requested.is_empty() {
        return Err("Select at least one duplicate copy.".into());
    }
    let mut ready = Vec::new();
    let mut rejected = Vec::new();
    for group in report.groups {
        validate_group(&requested, root, group, &mut ready, &mut rejected);
    }
    if ready.len() + rejected.len() != requested.len() {
        return Err("One or more selected files are not in the current duplicate report.".into());
    }
    Ok(CleanupPreview {
        reclaimable_size_bytes: ready.iter().map(|file| file.size_bytes).sum(),
        ready,
        rejected,
    })
}

fn validate_group(
    requested: &HashSet<u64>,
    root: &Path,
    group: DuplicateGroup,
    ready: &mut Vec<DuplicateFile>,
    rejected: &mut Vec<CleanupIssue>,
) {
    let selected = group
        .files
        .iter()
        .filter(|file| requested.contains(&file.id))
        .count();
    if selected >= group.files.len() {
        rejected.extend(
            group
                .files
                .iter()
                .filter(|file| requested.contains(&file.id))
                .map(|file| issue(file, "At least one copy in every group must be kept.")),
        );
        return;
    }
    for file in group
        .files
        .into_iter()
        .filter(|file| requested.contains(&file.id))
    {
        if file.recommended_keep {
            rejected.push(issue(
                &file,
                "The recommended keep copy cannot be moved automatically.",
            ));
        } else if let Err(reason) = validate_file(root, &file, &group.id) {
            rejected.push(issue(&file, &reason));
        } else {
            ready.push(file);
        }
    }
}

fn validate_file(root: &Path, file: &DuplicateFile, expected_hash: &str) -> Result<(), String> {
    let path = Path::new(&file.path);
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("File is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Symbolic links are not eligible for cleanup.".into());
    }
    if !metadata.is_file() {
        return Err("The selected path is no longer a regular file.".into());
    }
    if metadata.len() != file.size_bytes {
        return Err("The file size changed after duplicate analysis.".into());
    }
    let canonical =
        fs::canonicalize(path).map_err(|error| format!("Path cannot be verified: {error}"))?;
    if canonical == root || !canonical.starts_with(root) {
        return Err("The path is outside the current scan scope.".into());
    }
    if full_hash(&canonical)? != expected_hash {
        return Err("The file contents changed after duplicate analysis.".into());
    }
    if protected_path(&canonical) {
        return Err("This operating-system location is protected.".into());
    }
    Ok(())
}

fn full_hash(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| format!("File cannot be read: {error}"))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = vec![0; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("File cannot be read: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

fn protected_path(path: &Path) -> bool {
    #[cfg(target_os = "linux")]
    const PROTECTED: &[&str] = &[
        "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/run", "/sbin",
        "/sys", "/usr", "/var/lib", "/var/run",
    ];
    #[cfg(target_os = "macos")]
    const PROTECTED: &[&str] = &[
        "/System",
        "/Library",
        "/Applications",
        "/bin",
        "/sbin",
        "/usr",
        "/private",
    ];
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    const PROTECTED: &[&str] = &[];
    PROTECTED.iter().any(|prefix| path.starts_with(prefix))
}

fn issue(file: &DuplicateFile, reason: &str) -> CleanupIssue {
    CleanupIssue {
        id: file.id,
        path: file.path.clone(),
        reason: reason.into(),
    }
}

fn update_report(state: &AppState, moved_ids: &[u64]) -> Result<(), String> {
    if moved_ids.is_empty() {
        return Ok(());
    }
    let moved = moved_ids.iter().copied().collect::<HashSet<_>>();
    let mut report = state
        .duplicate_report
        .lock()
        .map_err(|_| "Duplicate state unavailable.")?;
    if let Some(report) = report.as_mut() {
        for group in &mut report.groups {
            group.files.retain(|file| !moved.contains(&file.id));
        }
        report.groups.retain(|group| group.files.len() > 1);
        report.group_count = report.groups.len();
        report.duplicate_file_count = report.groups.iter().map(|group| group.files.len()).sum();
        report.reclaimable_size_bytes = report
            .groups
            .iter()
            .map(|group| {
                group
                    .file_size_bytes
                    .saturating_mul((group.files.len() - 1) as u64)
            })
            .sum();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture(path: &Path, size: u64) -> DuplicateFile {
        DuplicateFile {
            id: 1,
            parent_directory_id: 0,
            path: path.to_string_lossy().into_owned(),
            name: "copy.bin".into(),
            size_bytes: size,
            modified_at_unix_seconds: None,
            recommended_keep: false,
        }
    }

    #[test]
    fn rejects_changed_content_and_paths_outside_scan_scope() {
        let base = std::env::temp_dir().join(format!(
            "disk-vacuum-cleanup-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let root = base.join("scan");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("copy.bin");
        fs::write(&path, b"original").unwrap();
        let file = fixture(&path, 8);
        let hash = full_hash(&path).unwrap();
        assert!(validate_file(&root, &file, &hash).is_ok());

        fs::write(&path, b"modified").unwrap();
        assert!(validate_file(&root, &file, &hash)
            .unwrap_err()
            .contains("contents changed"));

        let outside_path = base.join("outside.bin");
        fs::write(&outside_path, b"original").unwrap();
        let outside = fixture(&outside_path, 8);
        assert!(validate_file(&root, &outside, &hash)
            .unwrap_err()
            .contains("outside the current scan scope"));
        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symbolic_links() {
        use std::os::unix::fs::symlink;
        let base = std::env::temp_dir().join("disk-vacuum-cleanup-symlink-test");
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let target = base.join("target.bin");
        let link = base.join("link.bin");
        fs::write(&target, b"same").unwrap();
        symlink(&target, &link).unwrap();
        let file = fixture(&link, 4);
        assert!(validate_file(&base, &file, "unused")
            .unwrap_err()
            .contains("Symbolic links"));
        fs::remove_dir_all(base).unwrap();
    }
}

#[derive(Clone, Debug, serde::Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTargetInput {
    pub id: u64,
    pub parent_directory_id: u64,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupTargetPreview {
    pub ready: Vec<CleanupTargetInput>,
    pub rejected: Vec<CleanupIssue>,
    pub reclaimable_size_bytes: u64,
}

#[tauri::command]
pub fn preview_cleanup_targets(
    targets: Vec<CleanupTargetInput>,
    state: State<'_, AppState>,
) -> Result<CleanupTargetPreview, String> {
    validate_targets(targets, &state)
}

#[tauri::command]
pub async fn trash_cleanup_targets(
    targets: Vec<CleanupTargetInput>,
    state: State<'_, AppState>,
) -> Result<CleanupResult, String> {
    let preview = validate_targets(targets, &state)?;
    if !preview.rejected.is_empty() {
        return Err("Some selected locations failed safety validation.".into());
    }
    let outcomes = tauri::async_runtime::spawn_blocking(move || {
        preview
            .ready
            .into_iter()
            .map(|target| {
                let result = trash::delete(&target.path).map_err(|error| error.to_string());
                (target, result)
            })
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|_| "The Trash operation stopped unexpectedly.".to_owned())?;
    let mut moved_ids = Vec::new();
    let mut failed = Vec::new();
    let mut reclaimed_size_bytes = 0;
    for (target, outcome) in outcomes {
        match outcome {
            Ok(()) => {
                moved_ids.push(target.id);
                reclaimed_size_bytes += target.size_bytes;
            }
            Err(reason) => failed.push(CleanupIssue {
                id: target.id,
                path: target.path,
                reason,
            }),
        }
    }
    Ok(CleanupResult {
        moved_ids,
        failed,
        reclaimed_size_bytes,
    })
}

fn validate_targets(
    targets: Vec<CleanupTargetInput>,
    state: &AppState,
) -> Result<CleanupTargetPreview, String> {
    if targets.is_empty() {
        return Err("Select at least one location.".into());
    }
    let root = fs::canonicalize(state.scan_repository.scan_root_path()?)
        .map_err(|error| format!("The scanned root is no longer available: {error}"))?;
    let mut seen = HashSet::new();
    let mut ready = Vec::new();
    let mut rejected = Vec::new();
    for target in targets {
        if !seen.insert(target.id) {
            continue;
        }
        let validation = state
            .scan_repository
            .node_details(target.parent_directory_id, target.id)
            .and_then(|indexed| {
                if indexed.path != target.path || indexed.size_bytes != target.size_bytes {
                    return Err("The selection no longer matches the saved scan.".into());
                }
                if indexed.category == ScanCategory::System {
                    return Err("System files are protected from cleanup.".into());
                }
                let canonical = fs::canonicalize(&target.path)
                    .map_err(|error| format!("Path cannot be verified: {error}"))?;
                if state.settings.is_excluded(&canonical)? {
                    return Err("This path is protected by your exclusions.".into());
                }
                validate_target_path(&root, &target.path, target.size_bytes)
            });
        match validation {
            Ok(()) => ready.push(target),
            Err(reason) => rejected.push(CleanupIssue {
                id: target.id,
                path: target.path,
                reason,
            }),
        }
    }
    Ok(CleanupTargetPreview {
        reclaimable_size_bytes: ready.iter().map(|item| item.size_bytes).sum(),
        ready,
        rejected,
    })
}

fn validate_target_path(root: &Path, value: &str, expected_size: u64) -> Result<(), String> {
    let path = Path::new(value);
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("Location is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Symbolic links are not eligible for cleanup.".into());
    }
    if !metadata.is_file() && !metadata.is_dir() {
        return Err("The selected path is not a regular file or directory.".into());
    }
    if metadata.is_file() && metadata.len() != expected_size {
        return Err("The file changed after the scan.".into());
    }
    let canonical =
        fs::canonicalize(path).map_err(|error| format!("Path cannot be verified: {error}"))?;
    if canonical == root || !canonical.starts_with(root) {
        return Err("The path is outside the current scan scope.".into());
    }
    if protected_path(&canonical) {
        return Err("This operating-system location is protected.".into());
    }
    Ok(())
}
