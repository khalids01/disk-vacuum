use std::sync::{
    atomic::{AtomicBool, AtomicU64},
    Arc, Mutex,
};

use crate::features::scan::model::ScanSummary;

pub struct AppState {
    pub completed_scan: Mutex<Option<ScanSummary>>,
    pub active_scan: Mutex<Option<ActiveScan>>,
    pub next_scan_id: AtomicU64,
}

#[derive(Clone)]
pub struct ActiveScan {
    pub id: u64,
    pub cancellation: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            completed_scan: Mutex::new(None),
            active_scan: Mutex::new(None),
            next_scan_id: AtomicU64::new(1),
        }
    }
}
