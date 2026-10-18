use super::*;
use std::collections::{HashMap, HashSet};
pub(super) fn inventory() -> Result<Vec<InstalledApp>, String> {
    let mut apps = Vec::new();
    flatpaks(&mut apps);
    snaps(&mut apps);
    debs(&mut apps);
    apps.sort_by_key(|app| app.name.to_lowercase());
    Ok(apps)
}

fn output(program: &str, args: &[&str]) -> Option<String> {
    let result = Command::new(program)
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .ok()?;
    result
        .status
        .success()
        .then(|| String::from_utf8_lossy(&result.stdout).into_owned())
}

fn flatpaks(apps: &mut Vec<InstalledApp>) {
    for (scope, flag) in [("user", "--user"), ("system", "--system")] {
        let Some(lines) = output(
            "flatpak",
            &["list", flag, "--app", "--columns=application,name"],
        ) else {
            continue;
        };
        for line in lines.lines() {
            let mut columns = line.splitn(2, '\t');
            let Some(id) = columns
                .next()
                .map(str::trim)
                .filter(|id| valid_id(id) && !system_app_id(id))
            else {
                continue;
            };
            let name = columns
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(id);
            let location = output("flatpak", &["info", flag, "--show-location", id])
                .map(|path| PathBuf::from(path.trim()));
            let user_facing = location.as_ref().is_some_and(|location| {
                [
                    location.join("export/share/applications"),
                    location.join("files/share/applications"),
                ]
                .iter()
                .any(|root| {
                    fs::read_dir(root).ok().is_some_and(|entries| {
                        entries.flatten().any(|entry| {
                            entry.path().extension().is_some_and(|ext| ext == "desktop")
                                && fs::read_to_string(entry.path())
                                    .ok()
                                    .and_then(|contents| desktop_app(&contents))
                                    .is_some()
                        })
                    })
                })
            });
            if !user_facing {
                continue;
            }
            let size = output("flatpak", &["info", flag, "--show-size", id])
                .and_then(|value| value.trim().parse().ok());
            let cache = env::var_os("HOME")
                .map(PathBuf::from)
                .map(|home| home.join(".var/app").join(id).join("cache"));
            let cache_path = cache
                .as_ref()
                .filter(|path| path.is_dir())
                .map(|path| path.to_string_lossy().into_owned());
            let cache_bytes = cache
                .as_ref()
                .filter(|path| path.is_dir())
                .and_then(|path| directory_size(path));
            apps.push(InstalledApp {
                key: format!("flatpak:{scope}:{id}"),
                name: name.into(),
                source: format!("Flatpak ({scope})"),
                installed_bytes: size,
                installation_path: location.map(|path| path.to_string_lossy().into_owned()),
                cache_bytes,
                cache_path,
                uninstall_available: true,
            });
        }
    }
}

fn snap_is_user_app(metadata: &str) -> bool {
    metadata.lines().any(|line| {
        line.strip_prefix("name:")
            .is_some_and(|name| !name.trim().is_empty())
    }) && metadata
        .lines()
        .find_map(|line| line.strip_prefix("type:"))
        .is_none_or(|kind| kind.trim() == "app")
        && !metadata
            .lines()
            .any(|line| line.trim_start().starts_with("daemon:"))
}

fn snaps(apps: &mut Vec<InstalledApp>) {
    let Some(lines) = output("snap", &["list", "--color=never", "--unicode=never"]) else {
        return;
    };
    for line in lines.lines().skip(1) {
        let parts: Vec<_> = line.split_whitespace().collect();
        let Some(id) = parts
            .first()
            .copied()
            .filter(|id| valid_id(id) && !system_app_id(id))
        else {
            continue;
        };
        let desktop_dir = Path::new("/var/lib/snapd/desktop/applications");
        let has_desktop_entry = fs::read_dir(desktop_dir).ok().is_some_and(|entries| {
            entries.flatten().any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(&format!("{id}_"))
                    && entry.path().extension().is_some_and(|ext| ext == "desktop")
                    && fs::read_to_string(entry.path())
                        .ok()
                        .and_then(|contents| desktop_app(&contents))
                        .is_some()
            })
        });
        let snap_metadata = fs::read_to_string(format!("/snap/{id}/current/meta/snap.yaml"));
        let app_type = snap_metadata
            .as_ref()
            .ok()
            .is_some_and(|metadata| snap_is_user_app(metadata));
        if !has_desktop_entry || !app_type {
            continue;
        }
        let cache = env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join("snap").join(id).join("common/.cache"));
        let cache_path = cache
            .as_ref()
            .filter(|path| path.is_dir())
            .map(|path| path.to_string_lossy().into_owned());
        let cache_bytes = cache
            .as_ref()
            .filter(|path| path.is_dir())
            .and_then(|path| directory_size(path));
        // The current snap archive is a compressed on-disk size, unlike dpkg's estimate.
        let installed_bytes =
            parts
                .get(2)
                .filter(|revision| valid_id(revision))
                .and_then(|revision| {
                    fs::metadata(format!("/var/lib/snapd/snaps/{id}_{revision}.snap"))
                        .ok()
                        .map(|meta| meta.len())
                });
        apps.push(InstalledApp {
            key: format!("snap:system:{id}"),
            name: id.into(),
            source: "Snap".into(),
            installed_bytes,
            installation_path: Some(format!("/snap/{id}/current"))
                .filter(|path| Path::new(path).exists()),
            cache_bytes,
            cache_path,
            uninstall_available: true,
        });
    }
}

// Fail closed: packages without complete policy metadata never become candidates.
#[derive(Debug)]
struct DebPackage {
    name: String,
    size: Option<u64>,
    eligible: bool,
    relationships: String,
    provides: Vec<String>,
}

fn system_app_id(id: &str) -> bool {
    let id = id.to_ascii_lowercase();
    matches!(
        id.as_str(),
        "snap-store" | "firmware-updater" | "software-center" | "disk-vacuum" | "diskvacuum"
    ) || [
        "snapd",
        "core",
        "gnome-shell",
        "gnome-control-center",
        "gnome-settings",
        "gnome-session",
        "gnome-initial-setup",
        "gnome-software",
        "gnome-disk",
        "org.gnome.settings",
        "org.gnome.software",
        "org.gnome.disk",
        "org.kde.systemsettings",
        "org.kde.discover",
        "plasma-",
        "kde-plasma",
        "network-manager",
        "networkmanager",
        "systemd",
        "linux-",
        "grub",
        "shim-",
        "xserver-",
        "xwayland",
        "gdm",
        "sddm",
        "lightdm",
        "ubuntu-desktop",
        "ubuntu-session",
    ]
    .iter()
    .any(|prefix| id.starts_with(prefix))
}

fn desktop_app(contents: &str) -> Option<String> {
    let mut fields = HashMap::new();
    let mut in_entry = false;
    for line in contents.lines().map(str::trim) {
        if line.starts_with('[') {
            in_entry = line == "[Desktop Entry]";
            continue;
        }
        if in_entry {
            if let Some((key, value)) = line.split_once('=') {
                fields.insert(key, value);
            }
        }
    }
    if fields.get("Type") != Some(&"Application")
        || fields.get("Hidden") == Some(&"true")
        || fields.get("NoDisplay") == Some(&"true")
    {
        return None;
    }
    let categories: HashSet<_> = fields.get("Categories")?.split(';').collect();
    if [
        "System",
        "Settings",
        "HardwareSettings",
        "DesktopSettings",
        "PackageManager",
        "Security",
    ]
    .iter()
    .any(|category| categories.contains(category))
    {
        return None;
    }
    if ![
        "Development",
        "Office",
        "Game",
        "Graphics",
        "AudioVideo",
        "Audio",
        "Video",
        "Network",
        "Education",
        "Science",
        "Utility",
        "TextEditor",
    ]
    .iter()
    .any(|category| categories.contains(category))
    {
        return None;
    }
    fields
        .get("Name")
        .filter(|name| !name.is_empty())
        .map(|name| (*name).to_owned())
}

fn package_name(value: &str) -> &str {
    value.split(':').next().unwrap_or("")
}

fn deb_candidates(rows: &str, manual: &str) -> HashMap<String, Option<u64>> {
    let manual: HashSet<_> = manual.lines().map(package_name).collect();
    let packages: Vec<_> = rows
        .lines()
        .filter_map(|row| {
            let fields: Vec<_> = row.split('\t').collect();
            if fields.len() != 11 || fields[3] != "install ok installed" {
                return None;
            }
            let name = package_name(fields[0]);
            let section = fields[6].rsplit('/').next().unwrap_or("");
            let eligible = valid_id(name)
                && !system_app_id(name)
                && manual.contains(name)
                && fields[4] == "no"
                && fields[5] == "no"
                && matches!(fields[2], "optional" | "extra")
                && matches!(
                    section,
                    "editors"
                        | "education"
                        | "games"
                        | "graphics"
                        | "math"
                        | "net"
                        | "science"
                        | "sound"
                        | "text"
                        | "utils"
                        | "video"
                        | "web"
                        | "devel"
                        | "otherosfs"
                );
            Some(DebPackage {
                name: name.into(),
                size: fields[1]
                    .parse::<u64>()
                    .ok()
                    .map(|size| size.saturating_mul(1024)),
                eligible,
                relationships: fields[7..10].join(","),
                provides: fields[10]
                    .split(',')
                    .filter_map(|part| part.split_whitespace().next())
                    .map(package_name)
                    .map(str::to_owned)
                    .collect(),
            })
        })
        .collect();
    // Include all alternatives and virtual Provides names. Conservative for optional relationships.
    let depended_on: HashSet<String> = packages
        .iter()
        .flat_map(|package| {
            package
                .relationships
                .split([',', '|'])
                .filter_map(|part| part.split_whitespace().next())
                .map(package_name)
                .filter(|name| valid_id(name))
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .collect();
    packages
        .into_iter()
        .filter(|package| {
            package.eligible
                && !depended_on.contains(&package.name)
                && !package
                    .provides
                    .iter()
                    .any(|provided| depended_on.contains(provided))
        })
        .map(|package| (package.name, package.size))
        .collect()
}

fn debs(apps: &mut Vec<InstalledApp>) {
    let Some(manual) = output("apt-mark", &["showmanual"]) else {
        return;
    };
    let Some(rows) = output("dpkg-query", &["-W", "-f=${Package}\t${Installed-Size}\t${Priority}\t${Status}\t${Essential}\t${Protected}\t${Section}\t${Depends}\t${Pre-Depends}\t${Recommends}\t${Provides}\n"]) else { return };
    let Some(held) = output("apt-mark", &["showhold"]) else {
        return;
    };
    let held: HashSet<_> = held.lines().map(package_name).collect();
    let candidates: HashMap<_, _> = deb_candidates(&rows, &manual)
        .into_iter()
        .filter(|(name, _)| !held.contains(name.as_str()))
        .collect();
    let mut roots = vec![
        PathBuf::from("/usr/share/applications"),
        PathBuf::from("/usr/local/share/applications"),
    ];
    if let Some(home) = env::var_os("HOME") {
        roots.push(PathBuf::from(home).join(".local/share/applications"));
    }
    let mut seen = HashSet::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_none_or(|ext| ext != "desktop") {
                continue;
            }
            let Some(name) = fs::read_to_string(&path)
                .ok()
                .and_then(|contents| desktop_app(&contents))
            else {
                continue;
            };
            let Some(owners) = output("dpkg-query", &["-S", &path.to_string_lossy()]) else {
                continue;
            };
            for row in owners.lines() {
                let Some((owner, _)) = row.split_once(": ") else {
                    continue;
                };
                let owner = package_name(owner);
                let Some(size) = candidates.get(owner) else {
                    continue;
                };
                if !seen.insert(owner.to_owned()) {
                    continue;
                }
                // Reveal the installed executable when available, otherwise its launcher.
                let executable = output("dpkg-query", &["-L", owner]).and_then(|files| {
                    files
                        .lines()
                        .find(|file| file.starts_with("/usr/bin/") && Path::new(file).is_file())
                        .map(str::to_owned)
                });
                apps.push(InstalledApp {
                    key: format!("deb:system:{owner}"),
                    name: name.clone(),
                    source: "Debian package".into(),
                    installed_bytes: *size,
                    installation_path: executable
                        .or_else(|| Some(path.to_string_lossy().into_owned())),
                    cache_bytes: None,
                    cache_path: None,
                    uninstall_available: true,
                });
            }
        }
    }
}

fn valid_id(value: &str) -> bool {
    value.len() <= 200
        && value
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphanumeric)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'+' | b'-'))
}

pub(super) async fn clear_cache(key: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let app = inventory()?
            .into_iter()
            .find(|app| app.key == key)
            .ok_or("Application was not found. Refresh the list.")?;
        let cache = app
            .cache_path
            .ok_or("No identifiable cache is available for this app.")?;
        let path = PathBuf::from(cache);
        let home = PathBuf::from(env::var_os("HOME").ok_or("Home directory is unavailable.")?);
        let allowed = app.key.starts_with("flatpak:")
            && path
                == home
                    .join(".var/app")
                    .join(app.key.split(':').next_back().unwrap_or(""))
                    .join("cache")
            || app.key.starts_with("snap:")
                && path
                    == home
                        .join("snap")
                        .join(app.key.split(':').next_back().unwrap_or(""))
                        .join("common/.cache");
        let base = if app.key.starts_with("flatpak:") {
            home.join(".var/app")
        } else {
            home.join("snap")
        };
        let canonical_base = base.canonicalize().map_err(|error| error.to_string())?;
        let canonical_home = home.canonicalize().map_err(|error| error.to_string())?;
        let canonical_parent = path
            .parent()
            .ok_or("Cache has no parent.")?
            .canonicalize()
            .map_err(|error| error.to_string())?;
        let expected_parent = if app.key.starts_with("flatpak:") {
            canonical_base.join(app.key.split(':').next_back().unwrap_or(""))
        } else {
            canonical_base
                .join(app.key.split(':').next_back().unwrap_or(""))
                .join("common")
        };
        if !allowed
            || !canonical_base.starts_with(&canonical_home)
            || canonical_parent != expected_parent
            || path
                .symlink_metadata()
                .map_err(|error| error.to_string())?
                .file_type()
                .is_symlink()
        {
            return Err("Cache path failed validation.".into());
        }
        // Moving the whole cache directory to Trash keeps the operation reversible.
        trash::delete(&path).map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn single_package_removal(simulation: &str, requested: &str) -> bool {
    let mut removed = Vec::new();
    for line in simulation.lines() {
        if line.starts_with("Inst ") || line.starts_with("Conf ") || line.starts_with("Purg ") {
            return false;
        }
        if let Some(rest) = line.strip_prefix("Remv ") {
            removed.push(rest.split_whitespace().next().unwrap_or(""));
        }
    }
    removed == [requested]
}

pub(super) async fn uninstall(key: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let app = inventory()?.into_iter().find(|app| app.key == key).ok_or("Application was not found. Refresh the list.")?;
        if !app.uninstall_available { return Err("Uninstall is unavailable for this app.".into()) }
        let parts: Vec<_> = key.splitn(3, ':').collect();
        if parts.len() != 3 || !valid_id(parts[2]) { return Err("Invalid application identifier.".into()) }
        let (program, args): (&str, Vec<&str>) = match (parts[0], parts[1]) {
            ("flatpak", "user") => ("flatpak", vec!["uninstall", "--user", "--app", "--no-related", "--noninteractive", "--assumeyes", parts[2]]),
            ("flatpak", "system") => ("pkexec", vec!["flatpak", "uninstall", "--system", "--app", "--no-related", "--noninteractive", "--assumeyes", parts[2]]),
            ("snap", "system") => ("pkexec", vec!["snap", "remove", parts[2]]),
            ("deb", "system") => {
                let simulation = output("apt-get", &["-s", "--no-auto-remove", "remove", parts[2]]).ok_or("Could not preview package removal.")?;
                if !single_package_removal(&simulation, parts[2]) { return Err("Package manager would remove additional packages. Uninstall this app through your package manager instead.".into()) }
                ("pkexec", vec!["apt-get", "remove", "--yes", "--no-auto-remove", parts[2]])
            },
            _ => return Err("Unsupported installation method.".into()),
        };
        let result = Command::new(program).args(args).output().map_err(|error| error.to_string())?;
        if result.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&result.stderr).trim().chars().take(500).collect::<String>()) }
    }).await.map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identifiers_cannot_be_command_options_or_paths() {
        assert!(valid_id("org.example.App"));
        assert!(!valid_id("../other"));
        assert!(!valid_id("hello world"));
        assert!(!valid_id("--all"));
    }

    #[test]
    fn snap_base_packages_and_background_services_are_excluded() {
        assert!(snap_is_user_app(
            "name: firefox\napps:\n  firefox:\n    command: firefox\n"
        ));
        for metadata in [
            "",
            "name: core24\ntype: base",
            "name: system-service\napps:\n  service:\n    daemon: simple",
            "name: gadget\ntype: gadget",
            "name: kernel\ntype: kernel",
        ] {
            assert!(!snap_is_user_app(metadata));
        }
    }

    #[test]
    fn desktop_entries_exclude_settings_security_and_hidden_helpers() {
        let app = "[Desktop Entry]\nName=Barrier\nType=Application\nCategories=Network;Utility;\n";
        assert_eq!(desktop_app(app).as_deref(), Some("Barrier"));
        for extra in [
            "Hidden=true",
            "NoDisplay=true",
            "Categories=Settings;Utility;",
            "Categories=System;Utility;",
            "Categories=Security;Utility;",
            "Categories=PackageManager;",
        ] {
            assert!(desktop_app(&format!("{app}{extra}\n")).is_none(), "{extra}");
        }
        assert!(desktop_app("[Desktop Entry]\nName=Unknown\nType=Application\n").is_none());
        assert_eq!(
            desktop_app(&format!(
                "{app}[Desktop Action Helper]\nName=Helper\nCategories=Settings;\n"
            ))
            .as_deref(),
            Some("Barrier")
        );
    }

    #[test]
    fn deb_policy_rejects_protected_priorities_and_system_packages() {
        let rows = [
            "barrier\t120\toptional\tinstall ok installed\tno\tno\tnet\t\t\t\t",
            "essential-tool\t10\toptional\tinstall ok installed\tyes\tno\tutils\t\t\t\t",
            "protected-tool\t10\toptional\tinstall ok installed\tno\tyes\tutils\t\t\t\t",
            "important-tool\t10\timportant\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "standard-tool\t10\tstandard\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "gnome-control-center\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "auto-app\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "unknown-tool\t10\toptional\tinstall ok installed\t\t\tutils\t\t\t\t",
        ]
        .join("\n");
        let candidates = deb_candidates(&rows, "barrier\nessential-tool\nprotected-tool\nimportant-tool\nstandard-tool\ngnome-control-center\nunknown-tool");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates.get("barrier"), Some(&Some(120 * 1024)));
    }

    #[test]
    fn deb_policy_protects_dependencies_recommendations_and_virtual_providers() {
        let rows = [
            "standalone\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "needed-app\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "recommended-app\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "provider-app\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\tdesktop-input (= 1.0)",
            "predep-app\t10\toptional\tinstall ok installed\tno\tno\tutils\t\t\t\t",
            "desktop\t10\toptional\tinstall ok installed\tno\tno\tmetapackages\tneeded-app:amd64 (>= 1) | missing, desktop-input\tpredep-app\trecommended-app\t",
        ].join("\n");
        let candidates = deb_candidates(
            &rows,
            "standalone\nneeded-app\nrecommended-app\nprovider-app\npredep-app",
        );
        assert_eq!(candidates.len(), 1);
        assert!(candidates.contains_key("standalone"));
        assert!(deb_candidates("malformed", "malformed").is_empty());
    }

    #[test]
    fn removal_preview_cannot_change_other_packages() {
        assert!(single_package_removal(
            "Reading package lists...\nRemv barrier [2.4]\n",
            "barrier"
        ));
        for preview in [
            "",
            "Remv gnome-shell [1]",
            "Remv barrier [1]\nRemv ubuntu-desktop [1]",
            "Remv barrier [1]\nInst replacement [1]",
            "Remv barrier [1]\nConf another [1]",
        ] {
            assert!(!single_package_removal(preview, "barrier"));
        }
    }

    #[test]
    #[ignore = "Read-only host inventory walkthrough; requires installed package managers"]
    fn inspect_local_inventory() {
        let apps = inventory().unwrap();
        for app in &apps {
            eprintln!("{}: {} — {:?}", app.key, app.name, app.installation_path);
            let id = app.key.split(':').next_back().unwrap();
            assert!(!system_app_id(id));
            assert!(![
                "desktop-security-center",
                "gnome-control-center",
                "gnome-shell",
                "network-manager",
                "snap-store",
                "firmware-updater"
            ]
            .contains(&id));
        }
    }
}
