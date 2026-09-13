use std::path::Path;

use super::model::ScanCategory;

pub const CATEGORY_COUNT: usize = 12;

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "doc", "docx", "epub", "md", "odt", "pages", "pdf", "ppt", "pptx", "rtf", "tex", "txt", "xls",
    "xlsx",
];
const IMAGE_EXTENSIONS: &[&str] = &[
    "avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp",
];
const VIDEO_EXTENSIONS: &[&str] = &[
    "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv",
];
const AUDIO_EXTENSIONS: &[&str] = &[
    "aac", "aiff", "alac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "wma",
];
const ARCHIVE_EXTENSIONS: &[&str] = &[
    "7z", "bz2", "cab", "gz", "iso", "rar", "tar", "tgz", "xz", "zip", "zst",
];
const APPLICATION_EXTENSIONS: &[&str] = &[
    "apk", "appimage", "deb", "dmg", "exe", "flatpak", "msi", "pkg", "rpm",
];
const DEVELOPER_EXTENSIONS: &[&str] = &[
    "c", "cc", "cpp", "cs", "css", "dart", "go", "h", "hpp", "html", "java", "js", "jsx", "kt",
    "kts", "php", "py", "rb", "rs", "sh", "sql", "swift", "ts", "tsx", "vue",
];

pub fn classify_path(path: &Path, is_directory: bool) -> ScanCategory {
    if let Some(category) = classify_context(path) {
        return category;
    }
    if is_directory {
        return ScanCategory::Other;
    }

    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return ScanCategory::Other;
    };
    if matches_any(extension, DOCUMENT_EXTENSIONS) {
        ScanCategory::Documents
    } else if matches_any(extension, IMAGE_EXTENSIONS) {
        ScanCategory::Images
    } else if matches_any(extension, VIDEO_EXTENSIONS) {
        ScanCategory::Video
    } else if matches_any(extension, AUDIO_EXTENSIONS) {
        ScanCategory::Audio
    } else if matches_any(extension, ARCHIVE_EXTENSIONS) {
        ScanCategory::Archives
    } else if matches_any(extension, APPLICATION_EXTENSIONS) {
        ScanCategory::Applications
    } else if matches_any(extension, DEVELOPER_EXTENSIONS) {
        ScanCategory::Developer
    } else {
        ScanCategory::Other
    }
}

fn classify_context(path: &Path) -> Option<ScanCategory> {
    if is_system_location(path) {
        return Some(ScanCategory::System);
    }

    for component in path.components().rev() {
        let Some(name) = component.as_os_str().to_str() else {
            continue;
        };
        let category = if matches_any(name, &["download", "downloads"]) {
            ScanCategory::Downloads
        } else if matches_any(name, &["applications", "bin", "opt"]) {
            ScanCategory::Applications
        } else if matches_any(
            name,
            &[
                "node_modules",
                "target",
                ".git",
                ".cargo",
                ".gradle",
                ".npm",
                ".pnpm-store",
                ".yarn",
                ".bun",
                ".codex",
                ".vscode",
                ".windsurf",
                "__pycache__",
                ".venv",
                "venv",
            ],
        ) {
            ScanCategory::Developer
        } else if matches_any(name, &["cache", "caches", ".cache", "tmp", "temp"]) {
            ScanCategory::Caches
        } else if matches_any(name, &[".ollama", ".lmstudio", "huggingface", "models"]) {
            ScanCategory::Ai
        } else {
            continue;
        };
        return Some(category);
    }
    None
}

fn is_system_location(path: &Path) -> bool {
    let normalized = path
        .strip_prefix("/System/Volumes/Data")
        .map(|suffix| Path::new("/").join(suffix))
        .unwrap_or_else(|_| path.to_path_buf());
    if [
        "/System",
        "/Library",
        "/Applications",
        "/bin",
        "/boot",
        "/dev",
        "/etc",
        "/lib",
        "/lib32",
        "/lib64",
        "/private",
        "/proc",
        "/run",
        "/sbin",
        "/sys",
        "/usr",
        "/var",
    ]
    .iter()
    .any(|root| normalized == Path::new(root) || normalized.starts_with(root))
    {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        let normalized = path
            .to_string_lossy()
            .replace('/', "\\")
            .to_ascii_lowercase();
        return normalized.starts_with("c:\\windows\\")
            || normalized.starts_with("c:\\program files\\")
            || normalized.starts_with("c:\\programdata\\");
    }

    #[cfg(not(target_os = "windows"))]
    false
}

fn matches_any(value: &str, candidates: &[&str]) -> bool {
    candidates
        .iter()
        .any(|candidate| value.eq_ignore_ascii_case(candidate))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::classify_path;
    use crate::features::scan::model::ScanCategory;

    #[test]
    fn classifies_extensions_case_insensitively() {
        assert_eq!(
            classify_path(Path::new("/home/me/photo.JPEG"), false),
            ScanCategory::Images
        );
    }

    #[test]
    fn path_context_takes_priority_over_extension() {
        assert_eq!(
            classify_path(Path::new("/home/me/Downloads/archive.zip"), false),
            ScanCategory::Downloads
        );
        assert_eq!(
            classify_path(Path::new("/work/node_modules/readme.md"), false),
            ScanCategory::Developer
        );
    }

    #[test]
    fn system_classification_uses_roots_not_folder_names() {
        assert_eq!(
            classify_path(
                Path::new("/System/Volumes/Data/Users/khalid/.windsurf/cache.bin"),
                false,
            ),
            ScanCategory::Developer
        );
        assert_eq!(
            classify_path(Path::new("/System/Library/CoreServices/file.bin"), false),
            ScanCategory::System
        );
        assert_eq!(
            classify_path(Path::new("/storage/emulated/0/Download/archive.zip"), false),
            ScanCategory::Downloads
        );
    }
}
