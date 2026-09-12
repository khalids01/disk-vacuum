use std::path::{Path, PathBuf};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CleanupPolicy {
    AutoClean,
    Regeneratable,
    Review,
    Protected,
}

pub fn cleanup_policy(path: &Path) -> CleanupPolicy {
    if protected_path(path) || managed_runtime_path(path) {
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
        "dist" | "build" | "out" if parent.join("package.json").is_file() => {
            CleanupPolicy::Regeneratable
        }
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

fn managed_runtime_path(path: &Path) -> bool {
    path.components().any(|component| {
        component.as_os_str().to_str().is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                ".nvm" | ".volta" | ".asdf" | ".sdkman" | ".rustup" | ".pyenv"
            )
        })
    })
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
    if path == Path::new("/") || protected_user_path(path) {
        return true;
    }
    #[cfg(unix)]
    if path.parent() == Some(Path::new("/")) {
        return true;
    }
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
            "/var",
        ];
        const ANCHORS: &[&str] = &["/home", "/media", "/mnt", "/opt", "/srv", "/tmp"];
        return ROOTS
            .iter()
            .any(|root| path == Path::new(root) || path.starts_with(root))
            || ANCHORS.iter().any(|root| path == Path::new(root));
    }
    #[cfg(target_os = "macos")]
    {
        return macos_protected_path(path);
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

#[cfg(any(target_os = "macos", test))]
fn macos_protected_path(path: &Path) -> bool {
    let normalized = path
        .strip_prefix("/System/Volumes/Data")
        .map(|suffix| Path::new("/").join(suffix))
        .unwrap_or_else(|_| path.to_path_buf());
    if normalized == Path::new("/Users") || normalized == Path::new("/Volumes") {
        return true;
    }
    [
        "/System",
        "/Library",
        "/Applications",
        "/bin",
        "/sbin",
        "/usr",
        "/private",
    ]
    .iter()
    .any(|root| normalized == Path::new(root) || normalized.starts_with(root))
}

fn protected_user_path(path: &Path) -> bool {
    let Some(home) = user_home() else {
        return false;
    };
    protected_user_path_for(path, &home)
}

fn user_home() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let value = std::env::var_os("USERPROFILE");
    #[cfg(not(target_os = "windows"))]
    let value = std::env::var_os("HOME");
    value.map(PathBuf::from)
}

fn protected_user_path_for(path: &Path, home: &Path) -> bool {
    if same_path(path, home) {
        return true;
    }
    const PERSONAL_ANCHORS: &[&str] = &[
        "Desktop",
        "Documents",
        "Downloads",
        "Music",
        "Pictures",
        "Public",
        "Templates",
        "Videos",
    ];
    if PERSONAL_ANCHORS
        .iter()
        .any(|name| same_path(path, &home.join(name)))
    {
        return true;
    }
    const SENSITIVE_TREES: &[&str] = &[".ssh", ".gnupg", ".pki"];
    SENSITIVE_TREES
        .iter()
        .any(|name| path_is_within(path, &home.join(name)))
        || path_is_within(path, &home.join(".local/share/keyrings"))
        || path_is_within(path, &home.join("Library/Keychains"))
}

#[cfg(not(target_os = "windows"))]
fn same_path(path: &Path, root: &Path) -> bool {
    path == root
}

#[cfg(target_os = "windows")]
fn same_path(path: &Path, root: &Path) -> bool {
    path.to_string_lossy()
        .replace('/', "\\")
        .trim_end_matches('\\')
        .eq_ignore_ascii_case(
            root.to_string_lossy()
                .replace('/', "\\")
                .trim_end_matches('\\'),
        )
}

#[cfg(not(target_os = "windows"))]
fn path_is_within(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

#[cfg(target_os = "windows")]
fn path_is_within(path: &Path, root: &Path) -> bool {
    starts_with_windows_path(&path.to_string_lossy(), &root.to_string_lossy())
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
    #[test]
    fn macos_data_volume_user_paths_are_not_system_paths() {
        assert!(!macos_protected_path(Path::new(
            "/System/Volumes/Data/Users/me/Library/Caches/tool"
        )));
        assert!(macos_protected_path(Path::new(
            "/System/Volumes/Data/System/Library"
        )));
        assert!(macos_protected_path(Path::new(
            "/System/Volumes/Data/private/var"
        )));
    }

    #[test]
    fn runtime_managers_are_always_protected() {
        assert_eq!(
            cleanup_policy(Path::new(
                "/home/me/.nvm/versions/node/v24/lib/node_modules"
            )),
            CleanupPolicy::Protected
        );
    }

    #[test]
    fn home_and_personal_folder_roots_are_protected() {
        let home = Path::new("/home/example");
        assert!(protected_user_path_for(home, home));
        assert!(protected_user_path_for(
            Path::new("/home/example/Desktop"),
            home
        ));
        assert!(!protected_user_path_for(
            Path::new("/home/example/Desktop/photo.jpg"),
            home
        ));
    }

    #[test]
    fn credential_directories_are_protected_recursively() {
        let home = Path::new("/home/example");
        assert!(protected_user_path_for(
            Path::new("/home/example/.ssh/id_ed25519"),
            home
        ));
        assert!(protected_user_path_for(
            Path::new("/home/example/.local/share/keyrings/login.keyring"),
            home
        ));
    }
}
