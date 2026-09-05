use std::fs::Metadata;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct FileIdentity {
    device: u64,
    inode: u64,
}

#[cfg(unix)]
pub fn filesystem_id(metadata: &Metadata) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;

    Some(metadata.dev())
}

#[cfg(not(unix))]
pub fn filesystem_id(_metadata: &Metadata) -> Option<u64> {
    None
}

#[cfg(unix)]
pub fn allocated_size(metadata: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;

    let allocated_bytes = metadata.blocks().saturating_mul(512);
    if allocated_bytes == 0 {
        metadata.len()
    } else {
        allocated_bytes
    }
}

#[cfg(not(unix))]
pub fn allocated_size(metadata: &Metadata) -> u64 {
    metadata.len()
}

#[cfg(unix)]
pub fn hard_link_identity(metadata: &Metadata) -> Option<FileIdentity> {
    use std::os::unix::fs::MetadataExt;

    (metadata.nlink() > 1).then_some(FileIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
    })
}

#[cfg(not(unix))]
pub fn hard_link_identity(_metadata: &Metadata) -> Option<FileIdentity> {
    None
}
