use std::sync::Mutex;

use crate::features::scan::model::ScanSummary;

#[derive(Default)]
pub struct AppState {
    pub completed_scan: Mutex<Option<ScanSummary>>,
}
