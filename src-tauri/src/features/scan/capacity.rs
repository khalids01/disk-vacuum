use std::path::Path;

use super::model::ScanCapacity;

#[cfg(target_os = "linux")]
pub fn scan_capacity(
    mount_point: &Path,
    _fallback_total: u64,
    _fallback_available: u64,
) -> Result<ScanCapacity, &'static str> {
    use std::{ffi::CString, mem::MaybeUninit, os::unix::ffi::OsStrExt};

    let mount_point = CString::new(mount_point.as_os_str().as_bytes())
        .map_err(|_| "The system storage path is invalid.")?;
    let mut statistics = MaybeUninit::<libc::statvfs>::uninit();
    let result = unsafe { libc::statvfs(mount_point.as_ptr(), statistics.as_mut_ptr()) };
    if result != 0 {
        return Err("The system storage capacity could not be read.");
    }

    let statistics = unsafe { statistics.assume_init() };
    let block_size = statistics.f_frsize;
    let total_blocks = statistics.f_blocks;
    let free_blocks = statistics.f_bfree;
    let available_blocks = statistics.f_bavail;

    Ok(capacity_from_blocks(
        block_size,
        total_blocks,
        free_blocks,
        available_blocks,
    ))
}

#[cfg(not(target_os = "linux"))]
pub fn scan_capacity(
    _mount_point: &Path,
    total_space_bytes: u64,
    available_space_bytes: u64,
) -> Result<ScanCapacity, &'static str> {
    Ok(ScanCapacity {
        total_space_bytes,
        used_space_bytes: total_space_bytes.saturating_sub(available_space_bytes),
        free_space_bytes: available_space_bytes,
        available_space_bytes,
        reserved_space_bytes: 0,
    })
}

#[cfg(target_os = "linux")]
fn capacity_from_blocks(
    block_size: u64,
    total_blocks: u64,
    free_blocks: u64,
    available_blocks: u64,
) -> ScanCapacity {
    let total_space_bytes = block_size.saturating_mul(total_blocks);
    let free_space_bytes = block_size.saturating_mul(free_blocks);
    let available_space_bytes = block_size.saturating_mul(available_blocks);

    ScanCapacity {
        total_space_bytes,
        used_space_bytes: total_space_bytes.saturating_sub(free_space_bytes),
        free_space_bytes,
        available_space_bytes,
        reserved_space_bytes: free_space_bytes.saturating_sub(available_space_bytes),
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::capacity_from_blocks;

    #[test]
    fn separates_used_free_available_and_reserved_blocks() {
        let capacity = capacity_from_blocks(4_096, 100, 20, 5);

        assert_eq!(capacity.total_space_bytes, 409_600);
        assert_eq!(capacity.used_space_bytes, 327_680);
        assert_eq!(capacity.free_space_bytes, 81_920);
        assert_eq!(capacity.available_space_bytes, 20_480);
        assert_eq!(capacity.reserved_space_bytes, 61_440);
    }
}
