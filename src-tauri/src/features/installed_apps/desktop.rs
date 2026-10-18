use super::*;

// Require an exact canonical path: no symlinked ancestors or redirected leaves.
fn validate_directory(path: &Path, base: &Path) -> Result<(), String> {
    let canonical_base = base.canonicalize().map_err(|e| e.to_string())?;
    let expected = canonical_base.join(path.strip_prefix(base).map_err(|e| e.to_string())?);
    let canonical = path.canonicalize().map_err(|e| e.to_string())?;
    if path == base
        || !path.is_dir()
        || canonical != expected
        || !canonical.starts_with(&canonical_base)
        || redirected_metadata(&fs::symlink_metadata(path).map_err(|e| e.to_string())?)
    {
        return Err(
            "Application path failed validation; symlinked paths are not supported.".into(),
        );
    }
    let mut current = base.to_path_buf();
    if redirected_metadata(&fs::symlink_metadata(&current).map_err(|e| e.to_string())?) {
        return Err("Application base directory is redirected.".into());
    }
    for component in path
        .strip_prefix(base)
        .map_err(|e| e.to_string())?
        .components()
    {
        if !matches!(component, std::path::Component::Normal(_)) {
            return Err("Application path contains an invalid component.".into());
        }
        current.push(component);
        if redirected_metadata(&fs::symlink_metadata(&current).map_err(|e| e.to_string())?) {
            return Err("Application path contains a redirected directory.".into());
        }
    }
    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn find_app(key: &str) -> Result<InstalledApp, String> {
    inventory()?
        .into_iter()
        .find(|app| app.key == key)
        .ok_or_else(|| "Application was not found. Refresh the list.".into())
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
pub(super) fn clear_cache(key: &str) -> Result<(), String> {
    let app = find_app(key)?;
    let path = PathBuf::from(
        app.cache_path
            .ok_or("No identifiable cache is available for this app.")?,
    );
    #[cfg(target_os = "macos")]
    let base = PathBuf::from(env::var_os("HOME").ok_or("Home directory is unavailable.")?)
        .join("Library/Caches");
    #[cfg(target_os = "windows")]
    let base = PathBuf::from(env::var_os("LOCALAPPDATA").ok_or("Local app data is unavailable.")?)
        .join("Packages");
    validate_directory(&path, &base)?;
    trash::delete(path).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn app_roots() -> Vec<PathBuf> {
    let mut roots = vec![
        PathBuf::from("/Applications"),
        PathBuf::from("/Applications/Utilities"),
    ];
    if let Some(home) = env::var_os("HOME") {
        roots.push(PathBuf::from(home).join("Applications"));
    }
    roots
}

#[cfg(target_os = "macos")]
fn plist_value(bundle: &Path, field: &str) -> Option<String> {
    let result = Command::new("/usr/bin/plutil")
        .args(["-extract", field, "raw", "-o", "-"])
        .arg(bundle.join("Contents/Info.plist"))
        .output()
        .ok()?;
    result
        .status
        .success()
        .then(|| String::from_utf8_lossy(&result.stdout).trim().to_owned())
}

#[cfg(target_os = "macos")]
pub(super) fn inventory() -> Result<Vec<InstalledApp>, String> {
    let mut apps = Vec::new();
    for root in app_roots() {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_none_or(|ext| ext != "app") || !path.is_dir() {
                continue;
            }
            let id = plist_value(&path, "CFBundleIdentifier");
            let cache = id
                .as_ref()
                .filter(|id| valid_bundle_id(id))
                .and_then(|id| {
                    env::var_os("HOME")
                        .map(|home| PathBuf::from(home).join("Library/Caches").join(id))
                })
                .filter(|cache| cache.is_dir());
            let is_current_app = env::current_exe()
                .ok()
                .is_some_and(|exe| exe.starts_with(&path));
            let removable = id.as_ref().is_some_and(|id| !id.starts_with("com.apple."))
                && !is_current_app
                && validate_directory(&path, &root).is_ok();
            apps.push(InstalledApp {
                key: format!("mac:{}", path.to_string_lossy()),
                name: plist_value(&path, "CFBundleDisplayName")
                    .or_else(|| plist_value(&path, "CFBundleName"))
                    .filter(|name| !name.is_empty())
                    .unwrap_or_else(|| {
                        path.file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .into_owned()
                    }),
                source: "macOS application bundle".into(),
                installed_bytes: directory_size(&path),
                installation_path: Some(path.to_string_lossy().into_owned()),
                cache_bytes: cache.as_ref().and_then(|cache| directory_size(cache)),
                cache_path: cache.map(|cache| cache.to_string_lossy().into_owned()),
                uninstall_available: removable,
            });
        }
    }
    apps.sort_by_key(|app| app.name.to_lowercase());
    Ok(apps)
}

#[cfg(any(target_os = "macos", test))]
fn valid_bundle_id(id: &str) -> bool {
    id.len() <= 255
        && id.contains('.')
        && !id.starts_with('.')
        && !id.ends_with('.')
        && id.split('.').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        })
}

#[cfg(target_os = "macos")]
pub(super) fn uninstall(key: &str) -> Result<(), String> {
    let app = find_app(key)?;
    if !app.uninstall_available {
        return Err("This app cannot be removed through DiskVacuum.".into());
    }
    let path = PathBuf::from(
        key.strip_prefix("mac:")
            .ok_or("Invalid application identifier.")?,
    );
    let root = app_roots()
        .into_iter()
        .find(|root| path.parent() == Some(root.as_path()))
        .ok_or("Application is outside the supported Applications folders.")?;
    validate_directory(&path, &root)?;
    trash::delete(path).map_err(|e| {
        format!("Could not move app to Trash: {e}. Quit the app and check folder permissions.")
    })
}

#[cfg(any(target_os = "windows", test))]
fn encode_powershell(script: &str) -> String {
    use base64::Engine;
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

#[cfg(any(target_os = "windows", test))]
fn windows_script(script: &str) -> String {
    format!(
        "{}\ntry {{\n{}\n}} catch {{ [Console]::Error.WriteLine($_.Exception.Message); exit 1 }}",
        include_str!("windows-policy.ps1"),
        script
    )
}

#[cfg(target_os = "windows")]
fn powershell(script: &str, key: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let script = windows_script(script);
    let system_root =
        env::var_os("SystemRoot").ok_or("Windows system directory is unavailable.")?;
    let executable =
        PathBuf::from(system_root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    // Use the OS executable, with encoded UTF-16 script and a separate data-only key.
    // No shell search, string interpolation, or command-line quote interpretation.
    let result = Command::new(executable)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW; native uninstallers can still show their own UI.
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            &encode_powershell(&script),
        ])
        .env("DISKVACUUM_APP_KEY", key)
        .output()
        .map_err(|e| e.to_string())?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr)
            .chars()
            .take(1000)
            .collect());
    }
    Ok(String::from_utf8_lossy(&result.stdout)
        .trim_start_matches('\u{feff}')
        .trim()
        .to_owned())
}

#[cfg(any(target_os = "windows", test))]
fn parse_windows_inventory(json: &str) -> Result<Vec<InstalledApp>, String> {
    serde_json::from_str(json).map_err(|e| format!("Could not read Windows app inventory: {e}"))
}

#[cfg(target_os = "windows")]
pub(super) fn inventory() -> Result<Vec<InstalledApp>, String> {
    let json = powershell(include_str!("windows-inventory.ps1"), "")?;
    let mut apps = parse_windows_inventory(&json)?;
    for app in &mut apps {
        if app.key.starts_with("appx:") {
            app.installed_bytes = app
                .installation_path
                .as_ref()
                .and_then(|path| directory_size(Path::new(path)));
        }
        if let Some(path) = &app.cache_path {
            app.cache_bytes = directory_size(Path::new(path));
        }
    }
    apps.sort_by_key(|app| app.name.to_lowercase());
    Ok(apps)
}

#[cfg(target_os = "windows")]
pub(super) fn uninstall(key: &str) -> Result<(), String> {
    let app = find_app(key)?;
    if !app.uninstall_available {
        return Err("This app does not provide a supported uninstaller.".into());
    }
    powershell(include_str!("windows-uninstall.ps1"), key).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn powershell_encoding_preserves_unicode_and_literal_script_text() {
        use base64::Engine;
        let script = "Write-Output 'App \"quote\" $literal café 🧹'\n";
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encode_powershell(script))
            .unwrap();
        let utf16: Vec<u16> = bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes(*pair))
            .collect();
        assert_eq!(String::from_utf16(&utf16).unwrap(), script);
        for entry in [
            include_str!("windows-inventory.ps1"),
            include_str!("windows-uninstall.ps1"),
        ] {
            let combined = windows_script(entry);
            // Windows CreateProcess has a 32,767 UTF-16-character command-line limit.
            assert!(encode_powershell(&combined).len() + 1024 < 32_767);
        }
    }

    #[test]
    fn windows_inventory_contract_accepts_empty_single_and_unknown_sizes() {
        assert!(parse_windows_inventory("[]").unwrap().is_empty());
        let rows = parse_windows_inventory(r#"[{"key":"winreg:HKCU64:example","name":"Example","source":"Windows desktop","installedBytes":null,"installationPath":"C:\\Apps\\Example","cacheBytes":null,"cachePath":null,"uninstallAvailable":true}]"#).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Example");
        assert_eq!(rows[0].installed_bytes, None);
        assert!(rows[0].installation_path.is_some());
        assert!(parse_windows_inventory("{}").is_err());
        assert!(parse_windows_inventory("not JSON").is_err());
    }

    #[test]
    fn bundle_ids_cannot_escape_the_cache_root() {
        assert!(valid_bundle_id("com.example.App-1"));
        for id in [
            "../Caches",
            "com/other",
            "com..app",
            ".",
            "com.example/../../",
            "com.example\\other",
        ] {
            assert!(!valid_bundle_id(id));
        }
    }
    #[test]
    fn directory_validation_rejects_root_and_outside_paths() {
        let base = env::temp_dir().join(format!("diskvacuum-app-test-{}", std::process::id()));
        let child = base.join("cache");
        fs::create_dir_all(&child).unwrap();
        assert!(validate_directory(&child, &base).is_ok());
        assert!(validate_directory(&base, &base).is_err());
        assert!(validate_directory(&env::temp_dir(), &base).is_err());
        #[cfg(unix)]
        {
            fs::create_dir_all(child.join("nested")).unwrap();
            let link = base.join("redirect");
            std::os::unix::fs::symlink(&child, &link).unwrap();
            assert!(validate_directory(&link, &base).is_err());
            assert!(validate_directory(&link.join("nested"), &base).is_err());
            assert!(validate_directory(&link.join("nested"), &link).is_err());
        }
        fs::remove_dir_all(base).unwrap();
    }
}
