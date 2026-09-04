use serde::Serialize;
use sysinfo::{Disks, System};

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
}
