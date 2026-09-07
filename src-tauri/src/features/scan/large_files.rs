use std::{cmp::Ordering, path::Path};

use super::{
    model::{
        CompletedScan, LargeFileItem, LargeFileSafety, LargeFileSort, LargeFilesPage,
        LargeFilesQuery, ScanCategory, ScanNodeKind, ScanNodeSummary,
    },
    search::node_path,
};

const MAX_PAGE_SIZE: usize = 200;
const MAX_OFFSET: usize = 100_000;

struct Candidate<'a> {
    parent_directory_id: u64,
    node: &'a ScanNodeSummary,
}

pub fn query_large_files(
    completed_scan: &CompletedScan,
    query: &LargeFilesQuery,
) -> LargeFilesPage {
    let normalized_extension = query
        .extension
        .as_deref()
        .map(str::trim)
        .map(|value| value.trim_start_matches('.'))
        .filter(|value| !value.is_empty());
    let mut total_size_bytes = 0_u64;
    let mut candidates = Vec::new();

    for directory in completed_scan.directories.values() {
        for node in &directory.children {
            if node.kind != ScanNodeKind::File || node.size_bytes < query.minimum_size_bytes {
                continue;
            }
            if query
                .category
                .is_some_and(|selected| selected != node.category)
            {
                continue;
            }
            if normalized_extension.is_some_and(|selected| {
                file_extension(&node.name).is_none_or(|value| !value.eq_ignore_ascii_case(selected))
            }) {
                continue;
            }
            if query
                .safety
                .is_some_and(|selected| selected != classify_safety(node.category))
            {
                continue;
            }
            if query.modified_before_unix_seconds.is_some_and(|cutoff| {
                node.modified_at_unix_seconds
                    .is_none_or(|modified| modified > cutoff)
            }) {
                continue;
            }

            total_size_bytes = total_size_bytes.saturating_add(node.size_bytes);
            candidates.push(Candidate {
                parent_directory_id: directory.id,
                node,
            });
        }
    }

    candidates.sort_unstable_by(|left, right| compare_candidates(left, right, query.sort));
    let total_count = candidates.len();
    let offset = query.offset.min(MAX_OFFSET).min(total_count);
    let limit = query.limit.clamp(1, MAX_PAGE_SIZE);
    let items = candidates
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|candidate| build_item(completed_scan, candidate))
        .collect();

    LargeFilesPage {
        total_count,
        total_size_bytes,
        offset,
        items,
    }
}

fn compare_candidates(
    left: &Candidate<'_>,
    right: &Candidate<'_>,
    sort: LargeFileSort,
) -> Ordering {
    let ordering = match sort {
        LargeFileSort::SizeDescending => right.node.size_bytes.cmp(&left.node.size_bytes),
        LargeFileSort::ModifiedNewest => right
            .node
            .modified_at_unix_seconds
            .cmp(&left.node.modified_at_unix_seconds),
        LargeFileSort::ModifiedOldest => left
            .node
            .modified_at_unix_seconds
            .cmp(&right.node.modified_at_unix_seconds),
        LargeFileSort::NameAscending => {
            compare_ignore_ascii_case(&left.node.name, &right.node.name)
        }
    };
    ordering.then_with(|| left.node.id.cmp(&right.node.id))
}

fn compare_ignore_ascii_case(left: &str, right: &str) -> Ordering {
    left.bytes()
        .map(|byte| byte.to_ascii_lowercase())
        .cmp(right.bytes().map(|byte| byte.to_ascii_lowercase()))
}

fn build_item(completed_scan: &CompletedScan, candidate: Candidate<'_>) -> LargeFileItem {
    let path = node_path(
        completed_scan,
        candidate.parent_directory_id,
        &candidate.node.name,
    );
    let parent_path = path
        .parent()
        .map(|parent| parent.to_string_lossy().into_owned())
        .unwrap_or_default();

    LargeFileItem {
        id: candidate.node.id,
        parent_directory_id: candidate.parent_directory_id,
        name: candidate.node.name.clone(),
        path: path.to_string_lossy().into_owned(),
        parent_path,
        extension: file_extension(&candidate.node.name).map(str::to_ascii_lowercase),
        size_bytes: candidate.node.size_bytes,
        modified_at_unix_seconds: candidate.node.modified_at_unix_seconds,
        category: candidate.node.category,
        safety: classify_safety(candidate.node.category),
    }
}

fn file_extension(name: &str) -> Option<&str> {
    Path::new(name).extension().and_then(|value| value.to_str())
}

fn classify_safety(category: ScanCategory) -> LargeFileSafety {
    match category {
        ScanCategory::System | ScanCategory::Applications => LargeFileSafety::Protected,
        ScanCategory::Caches => LargeFileSafety::LikelySafe,
        _ => LargeFileSafety::Review,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::query_large_files;
    use crate::features::scan::model::{
        CompletedScan, LargeFileSafety, LargeFileSort, LargeFilesQuery, ScanCategory,
        ScanDirectoryRecord, ScanNodeKind, ScanNodeSummary, ScanSummary,
    };

    fn completed_with_files(files: Vec<ScanNodeSummary>) -> CompletedScan {
        CompletedScan {
            root_path: "/home/tester".into(),
            summary: ScanSummary {
                target_label: "Home".into(),
                completed_at_unix_seconds: 0,
                total_size_bytes: 0,
                capacity: None,
                file_count: files.len() as u64,
                directory_count: 1,
                permission_denied_count: 0,
                unreadable_entry_count: 0,
                skipped_symlink_count: 0,
                skipped_hard_link_count: 0,
                skipped_mounted_filesystem_count: 0,
                skipped_special_file_count: 0,
                root_directory_id: 0,
                top_level_items: vec![],
                categories: vec![],
            },
            directories: HashMap::from([(
                0,
                ScanDirectoryRecord {
                    id: 0,
                    parent_id: None,
                    path: std::path::PathBuf::new(),
                    name: "Home".into(),
                    children: files,
                },
            )]),
        }
    }

    fn file(
        id: u64,
        name: String,
        size_bytes: u64,
        category: ScanCategory,
        modified: u64,
    ) -> ScanNodeSummary {
        ScanNodeSummary {
            id,
            name,
            kind: ScanNodeKind::File,
            size_bytes,
            category,
            modified_at_unix_seconds: Some(modified),
        }
    }

    #[test]
    fn filters_sorts_and_classifies_conservatively() {
        let scan = completed_with_files(vec![
            file(1, "movie.MKV".into(), 500, ScanCategory::Video, 20),
            file(2, "cache.bin".into(), 800, ScanCategory::Caches, 10),
            file(3, "system.bin".into(), 900, ScanCategory::System, 5),
        ]);
        let page = query_large_files(
            &scan,
            &LargeFilesQuery {
                minimum_size_bytes: 400,
                category: Some(ScanCategory::Caches),
                safety: Some(LargeFileSafety::LikelySafe),
                extension: Some(".BIN".into()),
                modified_before_unix_seconds: Some(15),
                sort: LargeFileSort::SizeDescending,
                offset: 0,
                limit: 100,
            },
        );
        assert_eq!(page.total_count, 1);
        assert_eq!(page.total_size_bytes, 800);
        assert!(matches!(page.items[0].safety, LargeFileSafety::LikelySafe));
    }

    #[test]
    fn bounds_a_quarter_million_file_result() {
        let files = (0..250_000)
            .map(|index| {
                file(
                    index,
                    format!("file-{index}.bin"),
                    index + 1,
                    ScanCategory::Other,
                    index,
                )
            })
            .collect();
        let scan = completed_with_files(files);
        let page = query_large_files(
            &scan,
            &LargeFilesQuery {
                minimum_size_bytes: 1,
                category: None,
                safety: None,
                extension: None,
                modified_before_unix_seconds: None,
                sort: LargeFileSort::SizeDescending,
                offset: 0,
                limit: 50,
            },
        );
        assert_eq!(page.total_count, 250_000);
        assert_eq!(page.items.len(), 50);
        assert_eq!(page.items[0].size_bytes, 250_000);
        assert!(matches!(page.items[0].safety, LargeFileSafety::Review));
    }
}
