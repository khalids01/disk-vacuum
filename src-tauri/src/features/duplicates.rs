use crate::{
    app_state::AppState,
    features::scan::model::{
        DuplicateCandidate, DuplicateFile, DuplicateGroup, DuplicateProgress, DuplicateReport,
    },
};
use rayon::{prelude::*, ThreadPoolBuilder};
use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek, SeekFrom},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc,
    },
};
use tauri::{AppHandle, Emitter, State};
const EVENT: &str = "duplicate-progress";

#[tauri::command]
pub async fn analyze_duplicates(
    minimum_size_bytes: u64,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DuplicateReport, String> {
    let cancellation = Arc::new(AtomicBool::new(false));
    {
        let mut active = state
            .active_duplicate_scan
            .lock()
            .map_err(|_| "Duplicate state unavailable.")?;
        if active.is_some() {
            return Err("Duplicate analysis is already running.".into());
        }
        *active = Some(cancellation.clone());
    }
    let repository = state.scan_repository.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        emit(&app, "sizing", 0, 0);
        let candidates =
            repository.duplicate_candidates(minimum_size_bytes.max(1), &cancellation)?;
        analyze(candidates, app, cancellation)
    })
    .await
    .map_err(|_| "Duplicate analysis stopped unexpectedly.".to_owned())?;
    state
        .active_duplicate_scan
        .lock()
        .map_err(|_| "Duplicate state unavailable.")?
        .take();
    if let Ok(report) = &result {
        *state
            .duplicate_report
            .lock()
            .map_err(|_| "Duplicate state unavailable.")? = Some(report.clone());
    }
    result
}
#[tauri::command]
pub fn cancel_duplicate_analysis(state: State<'_, AppState>) -> Result<bool, String> {
    let active = state
        .active_duplicate_scan
        .lock()
        .map_err(|_| "Duplicate state unavailable.")?;
    Ok(active.as_ref().is_some_and(|flag| {
        flag.store(true, Ordering::Relaxed);
        true
    }))
}
#[tauri::command]
pub fn get_duplicate_report(state: State<'_, AppState>) -> Result<Option<DuplicateReport>, String> {
    state
        .duplicate_report
        .lock()
        .map(|v| v.clone())
        .map_err(|_| "Duplicate state unavailable.".into())
}

fn analyze(
    candidates: Vec<DuplicateCandidate>,
    app: AppHandle,
    cancel: Arc<AtomicBool>,
) -> Result<DuplicateReport, String> {
    let pool = ThreadPoolBuilder::new()
        .num_threads(4)
        .thread_name(|i| format!("disk-vacuum-duplicate-{i}"))
        .build()
        .map_err(|e| e.to_string())?;
    let total = candidates.len() as u64;
    emit(&app, "partialHash", 0, total);
    let done = AtomicU64::new(0);
    let partial = pool.install(|| {
        candidates
            .into_par_iter()
            .filter_map(|item| {
                if cancel.load(Ordering::Relaxed) {
                    return None;
                }
                let hash = partial_hash(&item.path, item.size_bytes);
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                if n % 32 == 0 || n == total {
                    emit(&app, "partialHash", n, total)
                }
                hash.ok().map(|hash| (hash, item))
            })
            .collect::<Vec<_>>()
    });
    if cancel.load(Ordering::Relaxed) {
        return Err("Duplicate analysis cancelled.".into());
    }
    let mut buckets: HashMap<[u8; 32], Vec<DuplicateCandidate>> = HashMap::new();
    for (hash, item) in partial {
        buckets.entry(hash).or_default().push(item)
    }
    let finalists = buckets
        .into_values()
        .filter(|v| v.len() > 1)
        .flatten()
        .collect::<Vec<_>>();
    let total = finalists.len() as u64;
    emit(&app, "fullHash", 0, total);
    let done = AtomicU64::new(0);
    let full = pool.install(|| {
        finalists
            .into_par_iter()
            .filter_map(|item| {
                if cancel.load(Ordering::Relaxed) {
                    return None;
                }
                let hash = full_hash(&item.path);
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                if n % 16 == 0 || n == total {
                    emit(&app, "fullHash", n, total)
                }
                hash.ok().map(|hash| (hash, item))
            })
            .collect::<Vec<_>>()
    });
    if cancel.load(Ordering::Relaxed) {
        return Err("Duplicate analysis cancelled.".into());
    }
    let mut exact: HashMap<[u8; 32], Vec<DuplicateCandidate>> = HashMap::new();
    for (hash, item) in full {
        exact.entry(hash).or_default().push(item)
    }
    let mut groups = exact
        .into_iter()
        .filter_map(|(hash, mut files)| {
            if files.len() < 2 {
                return None;
            }
            files.sort_by(|a, b| {
                b.modified_at_unix_seconds
                    .cmp(&a.modified_at_unix_seconds)
                    .then(a.path.len().cmp(&b.path.len()))
            });
            let size = files[0].size_bytes;
            Some(DuplicateGroup {
                id: hex(&hash),
                file_size_bytes: size,
                reclaimable_size_bytes: size.saturating_mul((files.len() - 1) as u64),
                files: files
                    .into_iter()
                    .enumerate()
                    .map(|(i, f)| DuplicateFile {
                        id: f.id,
                        parent_directory_id: f.parent_directory_id,
                        path: f.path,
                        name: f.name,
                        size_bytes: f.size_bytes,
                        modified_at_unix_seconds: f.modified_at_unix_seconds,
                        recommended_keep: i == 0,
                    })
                    .collect(),
            })
        })
        .collect::<Vec<_>>();
    groups.sort_by(|a, b| b.reclaimable_size_bytes.cmp(&a.reclaimable_size_bytes));
    let reclaimable_size_bytes = groups.iter().map(|g| g.reclaimable_size_bytes).sum();
    let duplicate_file_count = groups.iter().map(|g| g.files.len()).sum();
    emit(&app, "complete", total, total);
    Ok(DuplicateReport {
        group_count: groups.len(),
        duplicate_file_count,
        reclaimable_size_bytes,
        groups,
    })
}
fn partial_hash(path: &str, size: u64) -> Result<[u8; 32], String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut h = blake3::Hasher::new();
    h.update(&size.to_le_bytes());
    let mut b = vec![0; 65536.min(size as usize)];
    f.read_exact(&mut b).map_err(|e| e.to_string())?;
    h.update(&b);
    if size > 65536 {
        f.seek(SeekFrom::End(-(65536.min(size) as i64)))
            .map_err(|e| e.to_string())?;
        let mut tail = vec![0; 65536.min(size as usize)];
        f.read_exact(&mut tail).map_err(|e| e.to_string())?;
        h.update(&tail);
    }
    Ok(*h.finalize().as_bytes())
}
fn full_hash(path: &str) -> Result<[u8; 32], String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut h = blake3::Hasher::new();
    let mut b = vec![0; 1024 * 1024];
    loop {
        let n = f.read(&mut b).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        h.update(&b[..n]);
    }
    Ok(*h.finalize().as_bytes())
}
fn emit(app: &AppHandle, stage: &str, processed: u64, total: u64) {
    let _ = app.emit(
        EVENT,
        DuplicateProgress {
            stage: stage.into(),
            processed,
            total,
        },
    );
}
fn hex(bytes: &[u8; 32]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };
    #[test]
    fn confirms_content_not_filename() {
        let root = std::env::temp_dir().join(format!(
            "dv-dupes-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        let a = root.join("one.bin");
        let b = root.join("two.bin");
        let c = root.join("one-copy.bin");
        fs::write(&a, b"same bytes").unwrap();
        fs::write(&b, b"different!").unwrap();
        fs::write(&c, b"same bytes").unwrap();
        assert_eq!(
            full_hash(a.to_str().unwrap()).unwrap(),
            full_hash(c.to_str().unwrap()).unwrap()
        );
        assert_ne!(
            full_hash(a.to_str().unwrap()).unwrap(),
            full_hash(b.to_str().unwrap()).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }
}
