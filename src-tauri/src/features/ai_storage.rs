use crate::features::scan::model::{AiStorageDataType, LargeFileSafety};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestEntry {
    suffix: String,
    tool: String,
    data_type: AiStorageDataType,
    safety: LargeFileSafety,
    consequence: String,
}
#[derive(Clone)]
pub struct AiDetection {
    pub tool: String,
    pub data_type: AiStorageDataType,
    pub safety: LargeFileSafety,
    pub consequence: String,
}
static MANIFEST: OnceLock<Vec<ManifestEntry>> = OnceLock::new();
fn manifest() -> &'static [ManifestEntry] {
    MANIFEST.get_or_init(|| {
        serde_json::from_str(include_str!("../../resources/ai-storage-manifest.json"))
            .expect("bundled AI storage manifest must be valid")
    })
}
pub fn is_candidate_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "models"
            | "hub"
            | "assets"
            | "cache"
            | "cacheddata"
            | "logs"
            | "workspacestorage"
            | "projects"
            | "sessions"
            | "log"
            | "index"
    )
}
pub fn detect(path: &str) -> Option<AiDetection> {
    let path = path.replace('\\', "/").to_ascii_lowercase();
    manifest()
        .iter()
        .find(|e| path.ends_with(&e.suffix))
        .map(|e| AiDetection {
            tool: e.tool.clone(),
            data_type: e.data_type,
            safety: e.safety,
            consequence: e.consequence.clone(),
        })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn matches_linux_and_macos_paths_without_broad_names() {
        assert!(detect("/home/me/.ollama/models").is_some());
        assert!(detect("/Users/me/Library/Application Support/Cursor/Cache").is_some());
        assert!(detect("/home/me/photos/models").is_none());
    }
}
