use serde::Serialize;
use sysinfo::{Disks, System};

#[cfg(target_os = "linux")]
use std::{
    collections::HashSet,
    fs,
    os::unix::fs::MetadataExt,
    path::Path,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    name: String,
    mount_point: String,
    file_system: String,
    total_space_bytes: u64,
    available_space_bytes: u64,
    is_removable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    operating_system: String,
    os_version: Option<String>,
    hostname: Option<String>,
    uptime_seconds: u64,
    total_memory_bytes: u64,
    available_memory_bytes: u64,
    cpu_count: usize,
    volumes: Vec<VolumeInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostic {
    id: String,
    title: String,
    kind: String,
    detected_size_bytes: Option<u64>,
    reclaimable_size_bytes: Option<u64>,
    item_count: Option<u64>,
    safety: String,
    detail: String,
    cleanup_method: String,
    available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDiagnostics {
    platform: String,
    diagnostics: Vec<StorageDiagnostic>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut system = System::new();
    system.refresh_memory();
    system.refresh_cpu_all();

    let disks = Disks::new_with_refreshed_list();
    let volumes = disks
        .list()
        .iter()
        .map(|disk| VolumeInfo {
            name: disk.name().to_string_lossy().into_owned(),
            mount_point: disk.mount_point().to_string_lossy().into_owned(),
            file_system: disk.file_system().to_string_lossy().into_owned(),
            total_space_bytes: disk.total_space(),
            available_space_bytes: disk.available_space(),
            is_removable: disk.is_removable(),
        })
        .collect();

    Ok(SystemInfo {
        operating_system: System::name().unwrap_or_else(|| "Unknown OS".to_owned()),
        os_version: System::long_os_version(),
        hostname: System::host_name(),
        uptime_seconds: System::uptime(),
        total_memory_bytes: system.total_memory(),
        available_memory_bytes: system.available_memory(),
        cpu_count: system.cpus().len(),
        volumes,
    })
}

#[tauri::command]
pub async fn get_storage_diagnostics() -> Result<StorageDiagnostics, String> {
    tauri::async_runtime::spawn_blocking(storage_diagnostics)
        .await
        .map_err(|_| "Storage diagnostics could not finish.".to_owned())
}

#[cfg(target_os = "linux")]
fn storage_diagnostics() -> StorageDiagnostics {
    let mut diagnostics = vec![journal_diagnostic()];
    diagnostics.extend(package_cache_diagnostics());
    diagnostics.push(container_diagnostic("docker", "Docker"));
    diagnostics.push(container_diagnostic("podman", "Podman"));
    diagnostics.push(snap_diagnostic());
    diagnostics.push(flatpak_diagnostic());
    diagnostics.push(deleted_open_files_diagnostic());
    diagnostics.push(snapshot_filesystem_diagnostic());
    StorageDiagnostics {
        platform: "linux".to_owned(),
        diagnostics,
    }
}

#[cfg(not(target_os = "linux"))]
fn storage_diagnostics() -> StorageDiagnostics {
    StorageDiagnostics {
        platform: std::env::consts::OS.to_owned(),
        diagnostics: Vec::new(),
    }
}

#[cfg(target_os = "linux")]
fn journal_diagnostic() -> StorageDiagnostic {
    match run_command("journalctl", &["--disk-usage", "--quiet"], Duration::from_secs(3)) {
        Ok(output) => StorageDiagnostic {
            id: "systemd-journal".into(),
            title: "System journal".into(),
            kind: "logs".into(),
            detected_size_bytes: parse_first_size(&output),
            reclaimable_size_bytes: None,
            item_count: None,
            safety: "review".into(),
            detail: output.trim().to_owned(),
            cleanup_method: "Use journalctl --vacuum-size or --vacuum-time so systemd preserves journal integrity.".into(),
            available: true,
        },
        Err(reason) => unavailable("systemd-journal", "System journal", "logs", &reason),
    }
}

#[cfg(target_os = "linux")]
fn package_cache_diagnostics() -> Vec<StorageDiagnostic> {
    [
        (
            "apt-cache",
            "APT package cache",
            "/var/cache/apt/archives",
            "sudo apt clean",
        ),
        (
            "dnf-cache",
            "DNF package cache",
            "/var/cache/dnf",
            "sudo dnf clean packages",
        ),
        (
            "pacman-cache",
            "Pacman package cache",
            "/var/cache/pacman/pkg",
            "Use paccache so retained package versions are preserved.",
        ),
        (
            "zypp-cache",
            "Zypper package cache",
            "/var/cache/zypp/packages",
            "sudo zypper clean",
        ),
    ]
    .into_iter()
    .filter(|(_, _, path, _)| Path::new(path).exists())
    .map(|(id, title, path, cleanup)| {
        let size = directory_size(path);
        StorageDiagnostic {
            id: id.into(),
            title: title.into(),
            kind: "packageCache".into(),
            detected_size_bytes: size,
            reclaimable_size_bytes: size,
            item_count: None,
            safety: "regeneratable".into(),
            detail: format!(
                "Downloaded packages retained at {path}. Installed packages are not included."
            ),
            cleanup_method: cleanup.into(),
            available: size.is_some(),
        }
    })
    .collect()
}

#[cfg(target_os = "linux")]
fn container_diagnostic(command: &str, title: &str) -> StorageDiagnostic {
    let args = ["system", "df", "--format", "{{json .}}"];
    match run_command(command, &args, Duration::from_secs(4)) {
        Ok(output) => {
            let mut total = 0_u64;
            let mut reclaimable = 0_u64;
            let mut rows = 0_u64;
            let values = serde_json::from_str::<serde_json::Value>(&output)
                .ok()
                .and_then(|value| value.as_array().cloned())
                .unwrap_or_else(|| {
                    output
                        .lines()
                        .filter_map(|line| serde_json::from_str(line).ok())
                        .collect()
                });
            for value in values {
                total = total.saturating_add(json_size(&value, "RawSize", "Size").unwrap_or(0));
                reclaimable = reclaimable.saturating_add(
                    json_size(&value, "RawReclaimable", "Reclaimable").unwrap_or(0),
                );
                rows += 1;
            }
            StorageDiagnostic {
                id: format!("{command}-storage"),
                title: format!("{title} storage"),
                kind: "containers".into(),
                detected_size_bytes: (rows > 0).then_some(total),
                reclaimable_size_bytes: (rows > 0).then_some(reclaimable),
                item_count: Some(rows),
                safety: "review".into(),
                detail: "Images, containers, volumes, and build cache reported by the container engine. Volumes can contain primary data.".into(),
                cleanup_method: format!("Review `{command} system df` and use the engine's targeted prune commands. Never prune volumes automatically."),
                available: rows > 0,
            }
        }
        Err(reason) => unavailable(
            &format!("{command}-storage"),
            &format!("{title} storage"),
            "containers",
            &reason,
        ),
    }
}

#[cfg(target_os = "linux")]
fn snap_diagnostic() -> StorageDiagnostic {
    match run_command("snap", &["list", "--all"], Duration::from_secs(4)) {
        Ok(output) => {
            let mut size = 0_u64;
            let mut count = 0_u64;
            for line in output.lines().skip(1) {
                let columns = line.split_whitespace().collect::<Vec<_>>();
                if columns.len() < 6 || !columns[5..].iter().any(|value| value.contains("disabled"))
                {
                    continue;
                }
                let path = format!("/var/lib/snapd/snaps/{}_{}.snap", columns[0], columns[2]);
                if let Ok(metadata) = fs::metadata(path) {
                    size = size.saturating_add(metadata.len());
                    count += 1;
                }
            }
            StorageDiagnostic {
                id: "snap-disabled".into(),
                title: "Disabled Snap revisions".into(),
                kind: "packageCache".into(),
                detected_size_bytes: Some(size),
                reclaimable_size_bytes: Some(size),
                item_count: Some(count),
                safety: "regeneratable".into(),
                detail: "Old disabled Snap package revisions retained for rollback.".into(),
                cleanup_method: "Remove disabled revisions through `snap remove <name> --revision <rev>` so Snap updates its state.".into(),
                available: true,
            }
        }
        Err(reason) => unavailable(
            "snap-disabled",
            "Disabled Snap revisions",
            "packageCache",
            &reason,
        ),
    }
}

#[cfg(target_os = "linux")]
fn flatpak_diagnostic() -> StorageDiagnostic {
    match run_command(
        "flatpak",
        &["list", "--columns=application,size"],
        Duration::from_secs(4),
    ) {
        Ok(output) => {
            let mut size = 0_u64;
            let mut count = 0_u64;
            for line in output.lines() {
                let mut columns = line.splitn(2, '\t');
                if columns.next().is_some() {
                    if let Some(value) = columns.next().and_then(parse_human_size) {
                        size = size.saturating_add(value);
                        count += 1;
                    }
                }
            }
            StorageDiagnostic {
                id: "flatpak-storage".into(),
                title: "Flatpak applications and runtimes".into(),
                kind: "applications".into(),
                detected_size_bytes: Some(size),
                reclaimable_size_bytes: None,
                item_count: Some(count),
                safety: "review".into(),
                detail: "Installed Flatpak applications and shared runtimes. Reported size is not automatically reclaimable.".into(),
                cleanup_method: "Use `flatpak uninstall --unused` to let Flatpak identify unreferenced runtimes.".into(),
                available: true,
            }
        }
        Err(reason) => unavailable(
            "flatpak-storage",
            "Flatpak applications and runtimes",
            "applications",
            &reason,
        ),
    }
}

#[cfg(target_os = "linux")]
fn deleted_open_files_diagnostic() -> StorageDiagnostic {
    let mut identities = HashSet::new();
    let mut bytes = 0_u64;
    let mut count = 0_u64;
    if let Ok(processes) = fs::read_dir("/proc") {
        for process in processes.flatten().filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .chars()
                .all(|c| c.is_ascii_digit())
        }) {
            let Ok(fds) = fs::read_dir(process.path().join("fd")) else {
                continue;
            };
            for fd in fds.flatten() {
                let Ok(target) = fs::read_link(fd.path()) else {
                    continue;
                };
                if !target.to_string_lossy().ends_with(" (deleted)") {
                    continue;
                }
                let Ok(metadata) = fs::metadata(fd.path()) else {
                    continue;
                };
                if metadata.is_file() && identities.insert((metadata.dev(), metadata.ino())) {
                    bytes = bytes.saturating_add(metadata.blocks().saturating_mul(512));
                    count += 1;
                }
            }
        }
    }
    StorageDiagnostic {
        id: "deleted-open-files".into(),
        title: "Deleted files still held open".into(),
        kind: "hiddenUsage".into(),
        detected_size_bytes: Some(bytes),
        reclaimable_size_bytes: Some(bytes),
        item_count: Some(count),
        safety: "serviceAction".into(),
        detail: "Deleted files continue using disk blocks while a process keeps them open.".into(),
        cleanup_method: "Restart or reload the owning process after reviewing it. DiskVacuum should not terminate services automatically.".into(),
        available: true,
    }
}

#[cfg(target_os = "linux")]
fn snapshot_filesystem_diagnostic() -> StorageDiagnostic {
    let disks = Disks::new_with_refreshed_list();
    let filesystems = disks
        .list()
        .iter()
        .filter_map(|disk| {
            let fs = disk.file_system().to_string_lossy().to_ascii_lowercase();
            matches!(fs.as_str(), "btrfs" | "zfs").then(|| fs)
        })
        .collect::<HashSet<_>>();
    let available = !filesystems.is_empty();
    StorageDiagnostic {
        id: "filesystem-snapshots".into(),
        title: "Filesystem snapshots".into(),
        kind: "snapshots".into(),
        detected_size_bytes: None,
        reclaimable_size_bytes: None,
        item_count: None,
        safety: "review".into(),
        detail: if available { format!("Snapshot-capable filesystems detected: {}.", filesystems.into_iter().collect::<Vec<_>>().join(", ")) } else { "No mounted Btrfs or ZFS filesystem was reported.".into() },
        cleanup_method: "Inspect snapshots using the filesystem's own tools. Snapshot-exclusive size cannot be derived by ordinary directory traversal.".into(),
        available,
    }
}

#[cfg(target_os = "linux")]
fn directory_size(path: &str) -> Option<u64> {
    run_command("du", &["-sb", "--", path], Duration::from_secs(5))
        .ok()?
        .split_whitespace()
        .next()?
        .parse()
        .ok()
}

#[cfg(target_os = "linux")]
fn run_command(program: &str, args: &[&str], timeout: Duration) -> Result<String, String> {
    let mut child = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child
                    .wait_with_output()
                    .map_err(|error| error.to_string())?;
                if !output.status.success() {
                    let reason = String::from_utf8_lossy(&output.stderr).trim().to_owned();
                    return Err(if reason.is_empty() {
                        "Command was unavailable or returned no data.".into()
                    } else {
                        reason
                    });
                }
                return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
            }
            Ok(None) if started.elapsed() < timeout => thread::sleep(Duration::from_millis(25)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Timed out while reading this service.".into());
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

#[cfg(target_os = "linux")]
fn json_size(value: &serde_json::Value, raw_key: &str, display_key: &str) -> Option<u64> {
    value.get(raw_key).and_then(|raw| raw.as_u64()).or_else(|| {
        value
            .get(display_key)
            .and_then(|raw| raw.as_str())
            .and_then(parse_human_size)
    })
}

#[cfg(target_os = "linux")]
fn parse_first_size(value: &str) -> Option<u64> {
    value.split_whitespace().find_map(parse_human_size)
}

#[cfg(target_os = "linux")]
fn parse_human_size(value: &str) -> Option<u64> {
    let cleaned = value.trim().replace(['\u{a0}', ','], "");
    let token = cleaned.split_whitespace().next()?.split('(').next()?;
    let split = token.find(|c: char| !c.is_ascii_digit() && c != '.')?;
    let number = token[..split].parse::<f64>().ok()?;
    let unit = token[split..].to_ascii_lowercase();
    let multiplier = match unit.as_str() {
        "b" => 1_f64,
        "kb" | "kib" | "k" => 1024_f64,
        "mb" | "mib" | "m" => 1024_f64.powi(2),
        "gb" | "gib" | "g" => 1024_f64.powi(3),
        "tb" | "tib" | "t" => 1024_f64.powi(4),
        _ => return None,
    };
    Some((number * multiplier) as u64)
}

#[cfg(target_os = "linux")]
fn unavailable(id: &str, title: &str, kind: &str, reason: &str) -> StorageDiagnostic {
    StorageDiagnostic {
        id: id.into(),
        title: title.into(),
        kind: kind.into(),
        detected_size_bytes: None,
        reclaimable_size_bytes: None,
        item_count: None,
        safety: "unavailable".into(),
        detail: reason.into(),
        cleanup_method: "No action is available from this device context.".into(),
        available: false,
    }
}

#[cfg(test)]
mod tests {
    use super::{SystemInfo, VolumeInfo};

    #[test]
    fn serializes_frontend_contract_in_camel_case() {
        let info = SystemInfo {
            operating_system: "Test OS".to_owned(),
            os_version: None,
            hostname: None,
            uptime_seconds: 0,
            total_memory_bytes: 0,
            available_memory_bytes: 0,
            cpu_count: 1,
            volumes: vec![VolumeInfo {
                name: "Test volume".to_owned(),
                mount_point: "/".to_owned(),
                file_system: "testfs".to_owned(),
                total_space_bytes: 0,
                available_space_bytes: 0,
                is_removable: false,
            }],
        };

        let value = serde_json::to_value(info).expect("system info should serialize");
        assert!(value.get("totalMemoryBytes").is_some());
        assert!(value.get("total_memory_bytes").is_none());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn parses_service_reported_sizes() {
        assert_eq!(super::parse_human_size("672.3M"), Some(704_957_644));
        assert_eq!(
            super::parse_human_size("3.043GB (87%)"),
            Some(3_267_396_370)
        );
        assert_eq!(
            super::parse_first_size("take up 672.3M in the file system"),
            Some(704_957_644)
        );
    }
}
