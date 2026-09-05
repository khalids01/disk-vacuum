use std::path::Path;

use super::model::ScanCategory;

pub const CATEGORY_COUNT: usize = 12;

pub fn classify_path(path: &Path, is_directory: bool) -> ScanCategory {
    if let Some(category) = classify_context(path) {
        return category;
    }

    if is_directory {
        return ScanCategory::Other;
    }

    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "doc" | "docx" | "epub" | "md" | "odt" | "pages" | "pdf" | "ppt" | "pptx" | "rtf"
        | "tex" | "txt" | "xls" | "xlsx" => ScanCategory::Documents,
        "avif" | "bmp" | "gif" | "heic" | "heif" | "ico" | "jpeg" | "jpg" | "png" | "svg"
        | "tif" | "tiff" | "webp" => ScanCategory::Images,
        "3gp" | "avi" | "flv" | "m4v" | "mkv" | "mov" | "mp4" | "mpeg" | "mpg" | "webm" | "wmv" => {
            ScanCategory::Video
        }
        "aac" | "aiff" | "alac" | "flac" | "m4a" | "mp3" | "ogg" | "opus" | "wav" | "wma" => {
            ScanCategory::Audio
        }
        "7z" | "bz2" | "cab" | "gz" | "iso" | "rar" | "tar" | "tgz" | "xz" | "zip" | "zst" => {
            ScanCategory::Archives
        }
        "apk" | "appimage" | "deb" | "dmg" | "exe" | "flatpak" | "msi" | "pkg" | "rpm" => {
            ScanCategory::Applications
        }
        "c" | "cc" | "cpp" | "cs" | "css" | "dart" | "go" | "h" | "hpp" | "html" | "java"
        | "js" | "jsx" | "kt" | "kts" | "php" | "py" | "rb" | "rs" | "sh" | "sql" | "swift"
        | "ts" | "tsx" | "vue" => ScanCategory::Developer,
        _ => ScanCategory::Other,
    }
}

fn classify_context(path: &Path) -> Option<ScanCategory> {
    for component in path.components().rev() {
        let name = component.as_os_str().to_string_lossy().to_ascii_lowercase();
        let category = match name.as_str() {
            "downloads" => ScanCategory::Downloads,
            "applications" | "bin" | "opt" => ScanCategory::Applications,
            "node_modules" | "target" | ".git" | ".cargo" | ".gradle" | ".npm" | ".pnpm-store"
            | ".yarn" | "__pycache__" | ".venv" | "venv" => ScanCategory::Developer,
            "cache" | "caches" | ".cache" | "tmp" | "temp" => ScanCategory::Caches,
            ".ollama" | ".lmstudio" | "huggingface" | "models" => ScanCategory::Ai,
            "system" | "usr" | "var" | "etc" | "library" => ScanCategory::System,
            _ => continue,
        };
        return Some(category);
    }

    None
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
}
