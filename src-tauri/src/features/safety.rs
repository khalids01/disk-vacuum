use std::path::Path;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CleanupPolicy {
    AutoClean,
    Regeneratable,
    Review,
    Protected,
}

pub fn cleanup_policy(path: &Path) -> CleanupPolicy {
    if protected_path(path) {
        return CleanupPolicy::Protected;
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    match name.as_str() {
        "__pycache__" | ".pytest_cache" | ".mypy_cache" | ".ruff_cache" | ".parcel-cache"
        | "coverage" => CleanupPolicy::AutoClean,
        ".next" | ".nuxt" | ".svelte-kit" | ".turbo" if parent.join("package.json").is_file() => {
            CleanupPolicy::AutoClean
        }
        "node_modules" if parent.join("package.json").is_file() => CleanupPolicy::Regeneratable,
        "target" if parent.join("Cargo.toml").is_file() || parent.join("pom.xml").is_file() => {
            CleanupPolicy::Regeneratable
        }
        "bin" | "obj" if has_project_extension(parent, &["csproj", "fsproj", "vbproj", "sln"]) => {
            CleanupPolicy::Regeneratable
        }
        "build"
            if parent.join("build.gradle").is_file()
                || parent.join("build.gradle.kts").is_file() =>
        {
            CleanupPolicy::Regeneratable
        }
        _ => CleanupPolicy::Review,
    }
}

fn has_project_extension(parent: &Path, extensions: &[&str]) -> bool {
    std::fs::read_dir(parent).ok().is_some_and(|entries| {
        entries.filter_map(Result::ok).any(|entry| {
            entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| extensions.contains(&value))
        })
    })
}

pub fn protected_path(path: &Path) -> bool {
    #[cfg(target_os = "linux")]
    {
        const ROOTS: &[&str] = &[
            "/bin",
            "/boot",
            "/dev",
            "/etc",
            "/lib",
            "/lib32",
            "/lib64",
            "/lost+found",
            "/proc",
            "/root",
            "/run",
            "/sbin",
            "/snap",
            "/sys",
            "/usr",
            "/var/lib",
            "/var/lock",
            "/var/run",
        ];
        return ROOTS
            .iter()
            .any(|root| path == Path::new(root) || path.starts_with(root));
    }
    #[cfg(target_os = "macos")]
    {
        const ROOTS: &[&str] = &[
            "/System",
            "/Library",
            "/Applications",
            "/bin",
            "/sbin",
            "/usr",
            "/private",
        ];
        return ROOTS
            .iter()
            .any(|root| path == Path::new(root) || path.starts_with(root));
    }
    #[cfg(target_os = "windows")]
    {
        let normalized = path
            .to_string_lossy()
            .replace('/', "\\")
            .to_ascii_lowercase();
        if normalized.len() == 3 && normalized.as_bytes()[1] == b':' && normalized.ends_with('\\') {
            return true;
        }
        let roots = [
            std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into()),
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into()),
            std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".into()),
            std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".into()),
        ];
        if roots
            .iter()
            .any(|root| starts_with_windows_path(&normalized, root))
        {
            return true;
        }
        return [
            "\\system volume information",
            "\\recovery",
            "\\$recycle.bin",
        ]
        .iter()
        .any(|part| normalized.contains(part))
            || [
                "pagefile.sys",
                "hiberfil.sys",
                "swapfile.sys",
                "bootmgr",
                "ntldr",
            ]
            .iter()
            .any(|name| normalized.ends_with(name));
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        true
    }
}

#[cfg(target_os = "windows")]
fn starts_with_windows_path(path: &str, root: &str) -> bool {
    let root = root
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase();
    path == root
        || path
            .strip_prefix(&root)
            .is_some_and(|rest| rest.starts_with('\\'))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn obvious_system_paths_are_protected() {
        #[cfg(target_os = "linux")]
        assert!(protected_path(Path::new("/usr/lib/libc.so")));
        #[cfg(target_os = "macos")]
        assert!(protected_path(Path::new("/System/Library/CoreServices")));
        #[cfg(target_os = "windows")]
        assert!(protected_path(Path::new("C:\\Windows\\System32")));
    }
    #[test]
    fn unknown_paths_are_never_auto_cleaned() {
        assert_eq!(
            cleanup_policy(Path::new("unknown-folder")),
            CleanupPolicy::Review
        );
    }
}
