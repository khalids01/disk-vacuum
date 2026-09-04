use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanNodeSummary {
    pub id: String,
    pub name: String,
    pub kind: ScanNodeKind,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanNodeKind {
    File,
    Directory,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub target_label: String,
    pub completed_at_unix_seconds: u64,
    pub total_size_bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub permission_denied_count: u64,
    pub unreadable_entry_count: u64,
    pub skipped_symlink_count: u64,
    pub skipped_special_file_count: u64,
    pub top_level_items: Vec<ScanNodeSummary>,
}
