use std::cmp::Reverse;

use super::model::{
    CompletedScan, ScanCategory, ScanTreemapNode, ScanTreemapNodeKind, ScanTreemapSummary,
};

const MAX_TREEMAP_NODES: usize = 64;
const MIN_TREEMAP_NODES: usize = 4;

pub fn build_treemap_summary(
    completed_scan: &CompletedScan,
    directory_id: u64,
    requested_max_nodes: usize,
) -> Result<ScanTreemapSummary, String> {
    let directory = completed_scan
        .directories
        .get(&directory_id)
        .ok_or_else(|| "The scanned directory is no longer available.".to_owned())?;
    let max_nodes = requested_max_nodes.clamp(MIN_TREEMAP_NODES, MAX_TREEMAP_NODES);
    let visible_count = if directory.children.len() > max_nodes {
        max_nodes - 1
    } else {
        directory.children.len()
    };
    let mut nodes = directory.children[..visible_count]
        .iter()
        .map(|item| ScanTreemapNode {
            id: Some(item.id),
            name: item.name.clone(),
            kind: match item.kind {
                super::model::ScanNodeKind::File => ScanTreemapNodeKind::File,
                super::model::ScanNodeKind::Directory => ScanTreemapNodeKind::Directory,
            },
            size_bytes: item.size_bytes,
            category: item.category,
            grouped_item_count: 1,
        })
        .collect::<Vec<_>>();

    let grouped_items = &directory.children[visible_count..];
    if !grouped_items.is_empty() {
        let mut category_bytes = [0_u64; 12];
        let grouped_size_bytes = grouped_items.iter().fold(0_u64, |total, item| {
            category_bytes[item.category.index()] =
                category_bytes[item.category.index()].saturating_add(item.size_bytes);
            total.saturating_add(item.size_bytes)
        });
        let category = ScanCategory::ALL
            .into_iter()
            .max_by_key(|category| category_bytes[category.index()])
            .unwrap_or(ScanCategory::Other);
        nodes.push(ScanTreemapNode {
            id: None,
            name: "Other items".to_owned(),
            kind: ScanTreemapNodeKind::Group,
            size_bytes: grouped_size_bytes,
            category,
            grouped_item_count: grouped_items.len(),
        });
    }
    nodes.sort_by_key(|node| Reverse(node.size_bytes));

    Ok(ScanTreemapSummary {
        directory_id: directory.id,
        parent_id: directory.parent_id,
        name: directory.name.clone(),
        total_items: directory.children.len(),
        nodes,
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::build_treemap_summary;
    use crate::features::scan::model::{
        CompletedScan, ScanCategory, ScanDirectoryRecord, ScanNodeKind, ScanNodeSummary,
        ScanSummary, ScanTreemapNodeKind,
    };

    fn completed_scan(children: Vec<ScanNodeSummary>) -> CompletedScan {
        CompletedScan {
            summary: ScanSummary {
                target_label: "Fixture".to_owned(),
                completed_at_unix_seconds: 0,
                total_size_bytes: 0,
                capacity: None,
                file_count: 0,
                directory_count: 1,
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
            directories: HashMap::from([(
                0,
                ScanDirectoryRecord {
                    id: 0,
                    parent_id: None,
                    name: "Fixture".to_owned(),
                    children,
                },
            )]),
        }
    }

    #[test]
    fn bounds_nodes_and_groups_the_exact_remainder() {
        let children = (0..10)
            .map(|index| ScanNodeSummary {
                id: index,
                name: format!("item-{index}"),
                kind: ScanNodeKind::File,
                size_bytes: 10 - index,
                category: ScanCategory::Documents,
            })
            .collect();
        let summary = build_treemap_summary(&completed_scan(children), 0, 4)
            .expect("treemap summary should build");

        assert_eq!(summary.nodes.len(), 4);
        let group = summary
            .nodes
            .iter()
            .find(|node| matches!(node.kind, ScanTreemapNodeKind::Group))
            .expect("remainder should be grouped");
        assert_eq!(group.grouped_item_count, 7);
        assert_eq!(group.size_bytes, 28);
        assert_eq!(
            summary
                .nodes
                .iter()
                .map(|node| node.size_bytes)
                .sum::<u64>(),
            55
        );
    }

    #[test]
    fn rejects_unknown_directories() {
        let error = build_treemap_summary(&completed_scan(Vec::new()), 99, 48)
            .expect_err("unknown directory should fail");
        assert!(error.contains("no longer available"));
    }
}
