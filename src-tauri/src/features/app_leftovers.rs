use crate::features::scan::model::AppLeftoverConfidence;
use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
};

#[derive(Clone)]
pub struct LeftoverDetection {
    pub app_name: String,
    pub confidence: AppLeftoverConfidence,
    pub evidence: String,
}

pub fn installed_app_tokens() -> HashSet<String> {
    let mut roots: Vec<PathBuf> = Vec::new();
    #[cfg(target_os = "linux")]
    {
        roots.extend([
            PathBuf::from("/usr/share/applications"),
            PathBuf::from("/usr/local/share/applications"),
        ]);
        if let Some(home) = env::var_os("HOME") {
            roots.push(PathBuf::from(home).join(".local/share/applications"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        roots.extend([
            PathBuf::from("/Applications"),
            PathBuf::from("/System/Applications"),
        ]);
        if let Some(home) = env::var_os("HOME") {
            roots.push(PathBuf::from(home).join("Applications"));
        }
    }
    #[cfg(target_os = "windows")]
    {
        for variable in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(path) = env::var_os(variable) {
                roots.push(PathBuf::from(path));
            }
        }
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            roots.push(PathBuf::from(local_app_data).join("Programs"));
        }
    }
    let mut tokens = HashSet::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let stem = name
                .strip_suffix(".desktop")
                .or_else(|| name.strip_suffix(".app"))
                .unwrap_or(&name);
            add_variants(&mut tokens, stem);
        }
    }
    tokens
}

pub fn is_candidate_parent_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        ".cache"
            | ".config"
            | "share"
            | "state"
            | "caches"
            | "application support"
            | "logs"
            | "saved application state"
    )
}

pub fn detect(path: &str, name: &str, installed: &HashSet<String>) -> Option<LeftoverDetection> {
    let normalized_path = path.replace('\\', "/");
    let parent = Path::new(&normalized_path).parent()?.to_string_lossy();
    let root_kind = recognized_root(&parent)?;
    let token = normalize(name);
    if token.len() < 3
        || is_generic(&token)
        || installed
            .iter()
            .any(|value| token == *value || token.contains(value) || value.contains(&token))
    {
        return None;
    }
    let reverse_domain =
        name.matches('.').count() >= 2 && name.split('.').all(|part| !part.is_empty());
    let confidence = if reverse_domain && matches!(root_kind, "cache" | "logs") {
        AppLeftoverConfidence::High
    } else if matches!(root_kind, "cache" | "logs" | "state") {
        AppLeftoverConfidence::Likely
    } else {
        AppLeftoverConfidence::Review
    };
    Some(LeftoverDetection {
        app_name: display_name(name),
        confidence,
        evidence: format!("No matching installed application was found; this is a recognized {root_kind} location."),
    })
}

fn recognized_root(parent: &str) -> Option<&'static str> {
    let p = parent.replace('\\', "/").to_ascii_lowercase();
    if p.ends_with("/.cache") || p.ends_with("/library/caches") {
        Some("cache")
    } else if p.ends_with("/.config")
        || p.ends_with("/library/application support")
        || p.ends_with("/.local/share")
    {
        Some("application data")
    } else if p.ends_with("/.local/state") || p.ends_with("/library/saved application state") {
        Some("state")
    } else if p.ends_with("/library/logs") {
        Some("logs")
    } else {
        None
    }
}

fn normalize(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}
fn add_variants(tokens: &mut HashSet<String>, value: &str) {
    let full = normalize(value);
    if full.len() >= 3 {
        tokens.insert(full);
    }
    for part in value.split(['.', '-', '_']) {
        let part = normalize(part);
        if part.len() >= 4 && !matches!(part.as_str(), "com" | "org" | "desktop" | "linux") {
            tokens.insert(part);
        }
    }
}
fn display_name(value: &str) -> String {
    value
        .trim_end_matches(".savedState")
        .split('.')
        .next_back()
        .unwrap_or(value)
        .replace(['-', '_'], " ")
}
fn is_generic(value: &str) -> bool {
    matches!(
        value,
        "applications"
            | "fontconfig"
            | "icons"
            | "themes"
            | "mime"
            | "sessions"
            | "logs"
            | "cache"
            | "tmp"
            | "recentlyused"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn installed_apps_are_not_reported() {
        let installed = HashSet::from(["firefox".into()]);
        assert!(detect("/home/me/.cache/firefox", "firefox", &installed).is_none());
    }
    #[test]
    fn recognized_orphans_are_conservative() {
        let installed = HashSet::new();
        assert_eq!(
            detect("/home/me/.config/old-tool", "old-tool", &installed)
                .unwrap()
                .confidence,
            AppLeftoverConfidence::Review
        );
        assert!(detect("/home/me/Documents/old-tool", "old-tool", &installed).is_none());
    }
}
