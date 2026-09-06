use std::{collections::HashMap, path::PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCommandError {
    pub code: String,
    pub message: String,
}

impl ScanCommandError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_owned(),
            message: message.to_owned(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCapacity {
    pub total_space_bytes: u64,
    pub used_space_bytes: u64,
    pub free_space_bytes: u64,
    pub available_space_bytes: u64,
    pub reserved_space_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScanProgressStage {
    Scanning,
    Saving,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub stage: ScanProgressStage,
    pub target_label: String,
    pub entries_visited: u64,
    pub bytes_observed: u64,
    pub elapsed_milliseconds: u64,
    pub capacity: Option<ScanCapacity>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanNodeSummary {
    pub id: u64,
    pub name: String,
    pub kind: ScanNodeKind,
    pub size_bytes: u64,
    pub category: ScanCategory,
    pub modified_at_unix_seconds: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanCategory {
    Applications,
    Documents,
    Downloads,
    Images,
    Video,
    Audio,
    Archives,
    Developer,
    Ai,
    Caches,
    System,
    Other,
}

impl ScanCategory {
    pub const ALL: [Self; 12] = [
        Self::Applications,
        Self::Documents,
        Self::Downloads,
        Self::Images,
        Self::Video,
        Self::Audio,
        Self::Archives,
        Self::Developer,
        Self::Ai,
        Self::Caches,
        Self::System,
        Self::Other,
    ];

    pub const fn index(self) -> usize {
        self as usize
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCategorySummary {
    pub category: ScanCategory,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanNodeKind {
    File,
    Directory,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub target_label: String,
    pub completed_at_unix_seconds: u64,
    pub total_size_bytes: u64,
    pub capacity: Option<ScanCapacity>,
    pub file_count: u64,
    pub directory_count: u64,
    pub permission_denied_count: u64,
    pub unreadable_entry_count: u64,
    pub skipped_symlink_count: u64,
    pub skipped_hard_link_count: u64,
    pub skipped_mounted_filesystem_count: u64,
    pub skipped_special_file_count: u64,
    pub root_directory_id: u64,
    pub top_level_items: Vec<ScanNodeSummary>,
    pub categories: Vec<ScanCategorySummary>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ScanDirectoryRecord {
    pub id: u64,
    pub parent_id: Option<u64>,
    pub name: String,
    pub children: Vec<ScanNodeSummary>,
}

pub struct CompletedScan {
    pub root_path: PathBuf,
    pub summary: ScanSummary,
    pub directories: HashMap<u64, ScanDirectoryRecord>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanTreemapNodeKind {
    File,
    Directory,
    Group,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanTreemapNode {
    pub id: Option<u64>,
    pub name: String,
    pub kind: ScanTreemapNodeKind,
    pub size_bytes: u64,
    pub category: ScanCategory,
    pub grouped_item_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanNodeDetails {
    pub id: u64,
    pub parent_directory_id: u64,
    pub name: String,
    pub kind: ScanNodeKind,
    pub size_bytes: u64,
    pub category: ScanCategory,
    pub path: String,
    pub child_count: usize,
    pub modified_at_unix_seconds: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanTreemapSummary {
    pub directory_id: u64,
    pub parent_id: Option<u64>,
    pub name: String,
    pub total_items: usize,
    pub nodes: Vec<ScanTreemapNode>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSearchResult {
    pub id: u64,
    pub parent_directory_id: u64,
    pub name: String,
    pub kind: ScanNodeKind,
    pub size_bytes: u64,
    pub category: ScanCategory,
    pub path: String,
    pub modified_at_unix_seconds: Option<u64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSearchResponse {
    pub query: String,
    pub matched_count: usize,
    pub results: Vec<ScanSearchResult>,
    pub superseded: bool,
    pub elapsed_milliseconds: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDirectoryPage {
    pub directory_id: u64,
    pub parent_id: Option<u64>,
    pub name: String,
    pub total_items: usize,
    pub offset: usize,
    pub items: Vec<ScanNodeSummary>,
}
