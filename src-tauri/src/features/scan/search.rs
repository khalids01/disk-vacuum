use std::{cmp::Ordering, collections::BinaryHeap, path::PathBuf, time::Instant};

use super::model::{CompletedScan, ScanSearchResponse, ScanSearchResult};

const MAX_SEARCH_RESULTS: usize = 100;
const MIN_SEARCH_QUERY_LENGTH: usize = 2;

struct RankedResult {
    rank: u8,
    result: ScanSearchResult,
}

impl PartialEq for RankedResult {
    fn eq(&self, other: &Self) -> bool {
        self.rank == other.rank && self.result.size_bytes == other.result.size_bytes
    }
}

impl Eq for RankedResult {}

impl PartialOrd for RankedResult {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for RankedResult {
    fn cmp(&self, other: &Self) -> Ordering {
        self.rank
            .cmp(&other.rank)
            .then_with(|| other.result.size_bytes.cmp(&self.result.size_bytes))
    }
}

pub fn search_completed_scan(
    completed_scan: &CompletedScan,
    query: &str,
    requested_limit: usize,
    is_superseded: impl Fn() -> bool,
) -> ScanSearchResponse {
    let started_at = Instant::now();
    let query = query.trim();
    let limit = requested_limit.clamp(1, MAX_SEARCH_RESULTS);
    if query.chars().count() < MIN_SEARCH_QUERY_LENGTH {
        return response(query, Vec::new(), 0, false, started_at);
    }

    let path_parts = query
        .split(['/', '\\'])
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    let is_path_query = path_parts.len() > 1;
    let mut results = BinaryHeap::<RankedResult>::with_capacity(limit);
    let mut matched_count = 0_usize;
    let mut entries_checked = 0_usize;

    for directory in completed_scan.directories.values() {
        let directory_parts =
            is_path_query.then(|| directory_path_parts(completed_scan, directory.id));
        for node in &directory.children {
            entries_checked += 1;
            if entries_checked.is_multiple_of(4_096) && is_superseded() {
                return response(query, Vec::new(), matched_count, true, started_at);
            }

            let name_rank = match_rank(&node.name, query);
            let path_matches = is_path_query
                && directory_parts
                    .as_ref()
                    .is_some_and(|parts| path_matches_query(parts, &node.name, &path_parts));
            let Some(rank) = name_rank.or(path_matches.then_some(3)) else {
                continue;
            };
            matched_count += 1;

            if results.len() >= limit
                && results.peek().is_some_and(|worst| {
                    rank > worst.rank
                        || (rank == worst.rank && node.size_bytes <= worst.result.size_bytes)
                })
            {
                continue;
            }

            let result = ScanSearchResult {
                id: node.id,
                parent_directory_id: directory.id,
                name: node.name.clone(),
                kind: node.kind,
                size_bytes: node.size_bytes,
                category: node.category,
                path: node_path(completed_scan, directory.id, &node.name)
                    .to_string_lossy()
                    .into_owned(),
                modified_at_unix_seconds: node.modified_at_unix_seconds,
            };
            if results.len() >= limit {
                results.pop();
            }
            results.push(RankedResult { rank, result });
        }
    }

    response(
        query,
        results
            .into_sorted_vec()
            .into_iter()
            .map(|item| item.result)
            .collect(),
        matched_count,
        false,
        started_at,
    )
}

pub fn node_path(completed_scan: &CompletedScan, directory_id: u64, name: &str) -> PathBuf {
    let mut directory_names = Vec::new();
    let mut current_id = directory_id;
    while current_id != completed_scan.summary.root_directory_id {
        let Some(current) = completed_scan.directories.get(&current_id) else {
            break;
        };
        directory_names.push(current.name.as_str());
        let Some(parent_id) = current.parent_id else {
            break;
        };
        current_id = parent_id;
    }

    let mut path = completed_scan.root_path.clone();
    for directory_name in directory_names.into_iter().rev() {
        path.push(directory_name);
    }
    path.push(name);
    path
}

fn directory_path_parts(completed_scan: &CompletedScan, directory_id: u64) -> Vec<String> {
    let mut parts = completed_scan
        .root_path
        .components()
        .filter_map(|component| component.as_os_str().to_str().map(str::to_owned))
        .collect::<Vec<_>>();
    let mut directory_names = Vec::new();
    let mut current_id = directory_id;
    while current_id != completed_scan.summary.root_directory_id {
        let Some(current) = completed_scan.directories.get(&current_id) else {
            break;
        };
        directory_names.push(current.name.clone());
        let Some(parent_id) = current.parent_id else {
            break;
        };
        current_id = parent_id;
    }
    parts.extend(directory_names.into_iter().rev());
    parts
}

fn path_matches_query(directory_parts: &[String], name: &str, query_parts: &[&str]) -> bool {
    let total_parts = directory_parts.len() + 1;
    if query_parts.len() > total_parts {
        return false;
    }

    (0..=total_parts - query_parts.len()).any(|start| {
        query_parts.iter().enumerate().all(|(offset, query_part)| {
            let part_index = start + offset;
            let value = if part_index == directory_parts.len() {
                name
            } else {
                &directory_parts[part_index]
            };
            contains_ignore_ascii_case(value, query_part)
        })
    })
}

fn match_rank(name: &str, query: &str) -> Option<u8> {
    if name.eq_ignore_ascii_case(query) {
        Some(0)
    } else if name
        .get(..query.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(query))
    {
        Some(1)
    } else if contains_ignore_ascii_case(name, query) {
        Some(2)
    } else {
        None
    }
}

fn contains_ignore_ascii_case(haystack: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return true;
    }
    haystack
        .as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

fn response(
    query: &str,
    results: Vec<ScanSearchResult>,
    matched_count: usize,
    superseded: bool,
    started_at: Instant,
) -> ScanSearchResponse {
    ScanSearchResponse {
        query: query.to_owned(),
        matched_count,
        results,
        superseded,
        elapsed_milliseconds: started_at.elapsed().as_millis() as u64,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::search_completed_scan;
    use crate::features::scan::model::{
        CompletedScan, ScanCategory, ScanDirectoryRecord, ScanNodeKind, ScanNodeSummary,
        ScanSummary,
    };

    fn fixture() -> CompletedScan {
        let file = |id, name: &str, size| ScanNodeSummary {
            id,
            name: name.to_owned(),
            kind: ScanNodeKind::File,
            size_bytes: size,
            category: ScanCategory::Documents,
            modified_at_unix_seconds: Some(1_700_000_000),
        };
        CompletedScan {
            root_path: "/home/tester".into(),
            summary: ScanSummary {
                target_label: "Home".to_owned(),
                completed_at_unix_seconds: 0,
                total_size_bytes: 60,
                capacity: None,
                file_count: 3,
                directory_count: 2,
                permission_denied_count: 0,
                unreadable_entry_count: 0,
                skipped_symlink_count: 0,
                skipped_hard_link_count: 0,
                skipped_mounted_filesystem_count: 0,
                skipped_special_file_count: 0,
                root_directory_id: 0,
                top_level_items: Vec::new(),
                categories: Vec::new(),
            },
            directories: HashMap::from([
                (
                    0,
                    ScanDirectoryRecord {
                        id: 0,
                        parent_id: None,
                        name: "Home".to_owned(),
                        children: vec![ScanNodeSummary {
                            id: 1,
                            name: "Documents".to_owned(),
                            kind: ScanNodeKind::Directory,
                            size_bytes: 60,
                            category: ScanCategory::Documents,
                            modified_at_unix_seconds: None,
                        }],
                    },
                ),
                (
                    1,
                    ScanDirectoryRecord {
                        id: 1,
                        parent_id: Some(0),
                        name: "Documents".to_owned(),
                        children: vec![
                            file(2, "Report.PDF", 10),
                            file(3, "report-final.pdf", 30),
                            file(4, "notes.txt", 20),
                        ],
                    },
                ),
            ]),
        }
    }

    #[test]
    fn ranks_case_insensitive_name_matches_and_limits_results() {
        let response = search_completed_scan(&fixture(), "REPORT", 1, || false);
        assert_eq!(response.matched_count, 2);
        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].name, "report-final.pdf");
        assert_eq!(
            response.results[0].path,
            "/home/tester/Documents/report-final.pdf"
        );
    }

    #[test]
    fn searches_a_quarter_million_entries_with_bounded_output() {
        const ITEM_COUNT: u64 = 250_000;
        let mut completed = fixture();
        completed
            .directories
            .get_mut(&1)
            .expect("fixture directory")
            .children = (0..ITEM_COUNT)
            .map(|index| ScanNodeSummary {
                id: index + 2,
                name: format!("file-{index}.txt"),
                kind: ScanNodeKind::File,
                size_bytes: ITEM_COUNT - index,
                category: ScanCategory::Documents,
                modified_at_unix_seconds: None,
            })
            .collect();

        let response = search_completed_scan(&completed, "file", 50, || false);
        assert_eq!(response.matched_count, ITEM_COUNT as usize);
        assert_eq!(response.results.len(), 50);
        assert_eq!(response.results[0].size_bytes, ITEM_COUNT);

        let superseded = search_completed_scan(&completed, "file", 50, || true);
        assert!(superseded.superseded);
        assert!(superseded.results.is_empty());
    }

    #[test]
    fn matches_path_components_and_can_be_superseded() {
        let response = search_completed_scan(&fixture(), "documents/notes", 10, || false);
        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].name, "notes.txt");

        let superseded = search_completed_scan(&fixture(), "report", 10, || true);
        assert!(
            !superseded.superseded,
            "small fixtures finish before cancellation polling"
        );
    }
}
