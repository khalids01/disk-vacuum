use crate::{features::scan::model::ScanSummary, scan_repository::ScanRepository};
use std::sync::{
    atomic::{AtomicBool, AtomicU64},
    Arc, Mutex,
};

pub struct AppState {
    pub current_scan: Mutex<Option<ScanSummary>>,
    pub active_scan: Mutex<Option<ActiveScan>>,
    pub next_scan_id: AtomicU64,
    pub latest_search_id: Arc<AtomicU64>,
    pub scan_repository: ScanRepository,
}
#[derive(Clone)]
pub struct ActiveScan {
    pub id: u64,
    pub cancellation: Arc<AtomicBool>,
}
impl AppState {
    pub fn new(scan_repository: ScanRepository, current_scan: Option<ScanSummary>) -> Self {
        Self {
            current_scan: Mutex::new(current_scan),
            active_scan: Mutex::new(None),
            next_scan_id: AtomicU64::new(1),
            latest_search_id: Arc::new(AtomicU64::new(0)),
            scan_repository,
        }
    }
}
