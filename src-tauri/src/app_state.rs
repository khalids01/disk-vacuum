use std::sync::{
    atomic::{AtomicBool, AtomicU64},
    Arc, Mutex,
};

use crate::{features::scan::model::CompletedScan, scan_repository::ScanRepository};

pub struct AppState {
    pub completed_scan: Arc<Mutex<Option<CompletedScan>>>,
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
    pub fn new(scan_repository: ScanRepository, completed_scan: Option<CompletedScan>) -> Self {
        Self {
            completed_scan: Arc::new(Mutex::new(completed_scan)),
            active_scan: Mutex::new(None),
            next_scan_id: AtomicU64::new(1),
            latest_search_id: Arc::new(AtomicU64::new(0)),
            scan_repository,
        }
    }
}
