use crate::features::scan::model::{
    LargeFileItem, LargeFileSafety, LargeFileSort, LargeFilesPage, LargeFilesQuery, ScanCategory,
    ScanDirectoryPage, ScanDirectoryRecord, ScanNodeDetails, ScanNodeKind, ScanNodeSummary,
    ScanSearchResponse, ScanSearchResult, ScanSummary, ScanTreemapNode, ScanTreemapNodeKind,
    ScanTreemapSummary,
};
use serde::{Deserialize, Serialize};
use std::{
    cmp::Ordering,
    fs::{self, File},
    io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{
        mpsc::{self, SyncSender},
        Arc, RwLock,
    },
    thread::{self, JoinHandle},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

const ROOT: &str = "scan-index-v1";
const BLOCKS: &str = "blocks.bin";
const LOOKUP: &str = "directories.bin";
const META: &str = "metadata.json";
const PARENT_NONE: u64 = u64::MAX;
const QUEUE: usize = 1;
const MAX_PAGE: usize = 200;

#[derive(Serialize, Deserialize)]
struct Metadata {
    version: u32,
    root_path: PathBuf,
    summary: ScanSummary,
}
enum Message {
    Directory(ScanDirectoryRecord),
    Complete {
        root_path: PathBuf,
        summary: ScanSummary,
    },
}

#[derive(Clone, Debug)]
pub struct ScanRepository {
    root: PathBuf,
    active: Arc<RwLock<Option<PathBuf>>>,
}
pub struct ScanWriteSession {
    sender: Option<SyncSender<Message>>,
    worker: Option<JoinHandle<Result<PathBuf, String>>>,
    active: Arc<RwLock<Option<PathBuf>>>,
}
impl ScanWriteSession {
    pub fn write_directory(&self, mut directory: ScanDirectoryRecord) -> Result<(), String> {
        directory
            .children
            .sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes).then(a.id.cmp(&b.id)));
        self.sender
            .as_ref()
            .ok_or("Index writer finished.")?
            .send(Message::Directory(directory))
            .map_err(|_| "The binary index writer stopped unexpectedly.".into())
    }
    pub fn finish(mut self, root_path: PathBuf, summary: ScanSummary) -> Result<(), String> {
        self.sender
            .take()
            .ok_or("Index writer finished.")?
            .send(Message::Complete { root_path, summary })
            .map_err(|_| "The binary index writer stopped unexpectedly.".to_owned())?;
        let path = self
            .worker
            .take()
            .ok_or("Index writer stopped.")?
            .join()
            .map_err(|_| "The binary index writer crashed.".to_owned())??;
        *self
            .active
            .write()
            .map_err(|_| "Index state unavailable.")? = Some(path);
        Ok(())
    }
}
impl Drop for ScanWriteSession {
    fn drop(&mut self) {
        self.sender.take();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl ScanRepository {
    pub fn open(app_data_dir: &Path) -> Result<Self, String> {
        let root = app_data_dir.join(ROOT);
        fs::create_dir_all(&root).map_err(ioe)?;
        for e in fs::read_dir(&root).map_err(ioe)?.flatten() {
            if e.file_name().to_string_lossy().starts_with(".building-") {
                let _ = fs::remove_dir_all(e.path());
            }
        }
        let active = generations(&root)?.pop();
        Ok(Self {
            root,
            active: Arc::new(RwLock::new(active)),
        })
    }
    pub fn begin_scan_write(&self) -> Result<ScanWriteSession, String> {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let building = self.root.join(format!(".building-{id}"));
        let completed = self.root.join(format!("generation-{id}"));
        fs::create_dir(&building).map_err(ioe)?;
        let (sender, receiver) = mpsc::sync_channel(QUEUE);
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        let worker = thread::Builder::new()
            .name("disk-vacuum-binary-writer".into())
            .spawn(move || {
                let result = write_generation(&building, &completed, receiver, ready_tx);
                if result.is_err() {
                    let _ = fs::remove_dir_all(&building);
                }
                result
            })
            .map_err(|e| e.to_string())?;
        ready_rx
            .recv()
            .map_err(|_| "Binary writer failed to start.".to_owned())??;
        Ok(ScanWriteSession {
            sender: Some(sender),
            worker: Some(worker),
            active: self.active.clone(),
        })
    }
    fn generation(&self) -> Result<PathBuf, String> {
        self.active
            .read()
            .map_err(|_| "Index state unavailable.".to_owned())?
            .clone()
            .ok_or_else(|| "No completed scan is available.".into())
    }
    fn metadata(&self) -> Result<Metadata, String> {
        let bytes = fs::read(self.generation()?.join(META)).map_err(ioe)?;
        serde_json::from_slice(&bytes).map_err(|e| format!("Invalid scan metadata: {e}"))
    }
    pub fn load_scan_summary(&self) -> Result<Option<ScanSummary>, String> {
        match self.metadata() {
            Ok(m) => Ok(Some(m.summary)),
            Err(e) if e == "No completed scan is available." => Ok(None),
            Err(e) => Err(e),
        }
    }
    fn block(&self, id: u64) -> Result<Directory, String> {
        let gen = self.generation()?;
        let mut idx = File::open(gen.join(LOOKUP)).map_err(ioe)?;
        let count = idx.metadata().map_err(ioe)?.len() / 16;
        let mut lo = 0;
        let mut hi = count;
        while lo < hi {
            let mid = (lo + hi) / 2;
            idx.seek(SeekFrom::Start(mid * 16)).map_err(ioe)?;
            let found = read_u64(&mut idx)?;
            let off = read_u64(&mut idx)?;
            match found.cmp(&id) {
                Ordering::Less => lo = mid + 1,
                Ordering::Greater => hi = mid,
                Ordering::Equal => {
                    let mut f = BufReader::new(File::open(gen.join(BLOCKS)).map_err(ioe)?);
                    f.seek(SeekFrom::Start(off)).map_err(ioe)?;
                    return read_directory(&mut f);
                }
            }
        }
        Err("The scanned directory is no longer available.".into())
    }
    pub fn directory(
        &self,
        id: u64,
        offset: usize,
        limit: usize,
    ) -> Result<ScanDirectoryPage, String> {
        let d = self.block(id)?;
        let total = d.children.len();
        let offset = offset.min(total);
        Ok(ScanDirectoryPage {
            directory_id: id,
            parent_id: d.parent_id,
            name: d.name,
            total_items: total,
            offset,
            items: d
                .children
                .into_iter()
                .skip(offset)
                .take(limit.clamp(1, MAX_PAGE))
                .collect(),
        })
    }
    pub fn treemap(&self, id: u64, max: usize) -> Result<ScanTreemapSummary, String> {
        let d = self.block(id)?;
        let total = d.children.len();
        let max = max.clamp(4, 64);
        let visible = if total > max { max - 1 } else { total };
        let mut nodes = d.children[..visible]
            .iter()
            .map(map_tree)
            .collect::<Vec<_>>();
        if visible < total {
            let rest = &d.children[visible..];
            let size = rest.iter().map(|n| n.size_bytes).sum();
            nodes.push(ScanTreemapNode {
                id: None,
                name: "Other items".into(),
                kind: ScanTreemapNodeKind::Group,
                size_bytes: size,
                category: dominant(rest),
                grouped_item_count: rest.len(),
            });
        }
        Ok(ScanTreemapSummary {
            directory_id: id,
            parent_id: d.parent_id,
            name: d.name,
            total_items: total,
            nodes,
        })
    }
    pub fn node_details(&self, dir: u64, node: u64) -> Result<ScanNodeDetails, String> {
        let n = self
            .block(dir)?
            .children
            .into_iter()
            .find(|n| n.id == node)
            .ok_or("Item unavailable.")?;
        let path = self.path(dir, &n.name)?;
        let count = if n.kind == ScanNodeKind::Directory {
            self.block(n.id)?.children.len()
        } else {
            0
        };
        Ok(ScanNodeDetails {
            id: n.id,
            parent_directory_id: dir,
            name: n.name,
            kind: n.kind,
            size_bytes: n.size_bytes,
            category: n.category,
            path,
            child_count: count,
            modified_at_unix_seconds: n.modified_at_unix_seconds,
        })
    }
    fn path(&self, parent: u64, name: &str) -> Result<String, String> {
        let meta = self.metadata()?;
        let mut parts = vec![name.to_owned()];
        let mut id = parent;
        while id != meta.summary.root_directory_id {
            let d = self.block(id)?;
            parts.push(d.name);
            id = d.parent_id.ok_or("Broken parent index.")?;
        }
        let mut p = meta.root_path;
        for v in parts.into_iter().rev() {
            p.push(v)
        }
        Ok(p.to_string_lossy().into())
    }
    fn for_each_node(
        &self,
        mut visit: impl FnMut(u64, ScanNodeSummary) -> Result<(), String>,
    ) -> Result<(), String> {
        let gen = self.generation()?;
        let mut reader = BufReader::new(File::open(gen.join(BLOCKS)).map_err(ioe)?);
        loop {
            match read_directory(&mut reader) {
                Ok(directory) => {
                    for node in directory.children {
                        visit(directory.id, node)?;
                    }
                }
                Err(error) if error == "eof" => return Ok(()),
                Err(error) => return Err(error),
            }
        }
    }
    pub fn search(&self, q: &str, requested: usize) -> Result<ScanSearchResponse, String> {
        let started = Instant::now();
        let q = q.trim();
        let limit = requested.clamp(1, 100);
        if q.chars().count() < 2 {
            return Ok(response(q, vec![], 0, started));
        }
        let lower = q.to_lowercase();
        let pathq = q.contains(['/', '\\']);
        let needle = lower
            .rsplit(['/', '\\'])
            .find(|x| !x.is_empty())
            .unwrap_or(&lower);
        let mut total = 0;
        let mut hits = Vec::new();
        self.for_each_node(|parent, n| {
            if !n.name.to_lowercase().contains(needle) {
                return Ok(());
            }
            let path = self.path(parent, &n.name)?;
            if pathq && !path.to_lowercase().contains(&lower) {
                return Ok(());
            }
            total += 1;
            hits.push(ScanSearchResult {
                id: n.id,
                parent_directory_id: parent,
                name: n.name,
                kind: n.kind,
                size_bytes: n.size_bytes,
                category: n.category,
                path,
                modified_at_unix_seconds: n.modified_at_unix_seconds,
            });
            hits.sort_by(|a, b| {
                rank(a, needle)
                    .cmp(&rank(b, needle))
                    .then(b.size_bytes.cmp(&a.size_bytes))
            });
            if hits.len() > limit {
                hits.pop();
            }
            Ok(())
        })?;
        Ok(response(q, hits, total, started))
    }
    pub fn large_files(&self, q: &LargeFilesQuery) -> Result<LargeFilesPage, String> {
        let keep = q.offset.min(100_000) + q.limit.clamp(1, MAX_PAGE);
        let ext = q
            .extension
            .as_deref()
            .map(|x| x.trim_start_matches('.').to_lowercase());
        let mut total = 0;
        let mut bytes = 0;
        let mut hits = Vec::new();
        self.for_each_node(|parent, n| {
            if n.kind != ScanNodeKind::File || n.size_bytes < q.minimum_size_bytes {
                return Ok(());
            }
            if q.category.is_some_and(|c| c != n.category)
                || q.modified_before_unix_seconds
                    .is_some_and(|v| n.modified_at_unix_seconds.is_none_or(|m| m > v))
            {
                return Ok(());
            }
            if ext.as_ref().is_some_and(|e| {
                Path::new(&n.name)
                    .extension()
                    .and_then(|x| x.to_str())
                    .is_none_or(|x| !x.eq_ignore_ascii_case(e))
            }) {
                return Ok(());
            }
            total += 1;
            bytes += n.size_bytes;
            hits.push((parent, n));
            if hits.len() > keep.saturating_mul(2).max(2) {
                sort_large(&mut hits, q.sort);
                hits.truncate(keep)
            }
            Ok(())
        })?;
        sort_large(&mut hits, q.sort);
        hits.truncate(keep);
        let mut items = Vec::new();
        for (parent, n) in hits.into_iter().skip(q.offset.min(total)) {
            let path = self.path(parent, &n.name)?;
            let parent_path = Path::new(&path)
                .parent()
                .map(|p| p.to_string_lossy().into())
                .unwrap_or_default();
            let extension = Path::new(&n.name)
                .extension()
                .and_then(|x| x.to_str())
                .map(str::to_lowercase);
            items.push(LargeFileItem {
                id: n.id,
                parent_directory_id: parent,
                name: n.name,
                path,
                parent_path,
                extension,
                size_bytes: n.size_bytes,
                modified_at_unix_seconds: n.modified_at_unix_seconds,
                category: n.category,
                safety: safety(n.category),
            });
        }
        Ok(LargeFilesPage {
            total_count: total,
            total_size_bytes: bytes,
            offset: q.offset.min(total),
            items,
        })
    }
}

struct Directory {
    id: u64,
    parent_id: Option<u64>,
    name: String,
    children: Vec<ScanNodeSummary>,
}
fn write_generation(
    build: &Path,
    done: &Path,
    rx: mpsc::Receiver<Message>,
    ready: SyncSender<Result<(), String>>,
) -> Result<PathBuf, String> {
    let file = File::create(build.join(BLOCKS)).map_err(ioe);
    if let Err(e) = file {
        let _ = ready.send(Err(e.clone()));
        return Err(e);
    }
    let mut blocks = BufWriter::new(file.unwrap());
    let mut lookup = Vec::new();
    let _ = ready.send(Ok(()));
    let meta = loop {
        match rx.recv() {
            Ok(Message::Directory(d)) => {
                let off = blocks.stream_position().map_err(ioe)?;
                lookup.push((d.id, off));
                write_directory(&mut blocks, d)?
            }
            Ok(Message::Complete { root_path, summary }) => {
                break Metadata {
                    version: 1,
                    root_path,
                    summary,
                }
            }
            Err(_) => return Err("Scan cancelled.".into()),
        }
    };
    blocks.flush().map_err(ioe)?;
    blocks.get_ref().sync_all().map_err(ioe)?;
    lookup.sort_unstable_by_key(|x| x.0);
    let mut w = BufWriter::new(File::create(build.join(LOOKUP)).map_err(ioe)?);
    for (id, off) in lookup {
        write_u64(&mut w, id)?;
        write_u64(&mut w, off)?
    }
    w.flush().map_err(ioe)?;
    w.get_ref().sync_all().map_err(ioe)?;
    let mut m = File::create(build.join(META)).map_err(ioe)?;
    m.write_all(&serde_json::to_vec(&meta).map_err(|e| e.to_string())?)
        .map_err(ioe)?;
    m.sync_all().map_err(ioe)?;
    fs::rename(build, done).map_err(ioe)?;
    Ok(done.to_path_buf())
}
fn write_directory<W: Write>(w: &mut W, d: ScanDirectoryRecord) -> Result<(), String> {
    write_u64(w, d.id)?;
    write_u64(w, d.parent_id.unwrap_or(PARENT_NONE))?;
    write_string(w, &d.name)?;
    write_u32(w, d.children.len() as u32)?;
    for n in d.children {
        write_node(w, n)?
    }
    Ok(())
}
fn read_directory<R: Read>(r: &mut R) -> Result<Directory, String> {
    let id = match read_u64(r) {
        Ok(v) => v,
        Err(e) if e.contains("failed to fill") => return Err("eof".into()),
        Err(e) => return Err(e),
    };
    let p = read_u64(r)?;
    let name = read_string(r)?;
    let count = read_u32(r)?;
    let mut children = Vec::with_capacity(count as usize);
    for _ in 0..count {
        children.push(read_node(r)?)
    }
    Ok(Directory {
        id,
        parent_id: (p != PARENT_NONE).then_some(p),
        name,
        children,
    })
}
fn write_node<W: Write>(w: &mut W, n: ScanNodeSummary) -> Result<(), String> {
    write_u64(w, n.id)?;
    w.write_all(&[
        if n.kind == ScanNodeKind::File { 0 } else { 1 },
        n.category.index() as u8,
    ])
    .map_err(ioe)?;
    write_u64(w, n.size_bytes)?;
    write_u64(w, n.modified_at_unix_seconds.unwrap_or(PARENT_NONE))?;
    write_string(w, &n.name)
}
fn read_node<R: Read>(r: &mut R) -> Result<ScanNodeSummary, String> {
    let id = read_u64(r)?;
    let mut t = [0; 2];
    r.read_exact(&mut t).map_err(ioe)?;
    let category = *ScanCategory::ALL
        .get(t[1] as usize)
        .ok_or("Invalid category.")?;
    let size_bytes = read_u64(r)?;
    let m = read_u64(r)?;
    Ok(ScanNodeSummary {
        id,
        name: read_string(r)?,
        kind: if t[0] == 0 {
            ScanNodeKind::File
        } else {
            ScanNodeKind::Directory
        },
        size_bytes,
        category,
        modified_at_unix_seconds: (m != PARENT_NONE).then_some(m),
    })
}
fn write_string<W: Write>(w: &mut W, s: &str) -> Result<(), String> {
    write_u32(w, s.len() as u32)?;
    w.write_all(s.as_bytes()).map_err(ioe)
}
fn read_string<R: Read>(r: &mut R) -> Result<String, String> {
    let n = read_u32(r)? as usize;
    if n > 1_048_576 {
        return Err("Invalid name length.".into());
    }
    let mut b = vec![0; n];
    r.read_exact(&mut b).map_err(ioe)?;
    String::from_utf8(b).map_err(|_| "Invalid UTF-8 name.".into())
}
fn write_u64<W: Write>(w: &mut W, v: u64) -> Result<(), String> {
    w.write_all(&v.to_le_bytes()).map_err(ioe)
}
fn write_u32<W: Write>(w: &mut W, v: u32) -> Result<(), String> {
    w.write_all(&v.to_le_bytes()).map_err(ioe)
}
fn read_u64<R: Read>(r: &mut R) -> Result<u64, String> {
    let mut b = [0; 8];
    r.read_exact(&mut b).map_err(ioe)?;
    Ok(u64::from_le_bytes(b))
}
fn read_u32<R: Read>(r: &mut R) -> Result<u32, String> {
    let mut b = [0; 4];
    r.read_exact(&mut b).map_err(ioe)?;
    Ok(u32::from_le_bytes(b))
}
fn generations(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut v = fs::read_dir(root)
        .map_err(ioe)?
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .is_some_and(|n| n.to_string_lossy().starts_with("generation-"))
                && valid_generation(p)
        })
        .collect::<Vec<_>>();
    v.sort();
    Ok(v)
}
fn valid_generation(path: &Path) -> bool {
    let Ok(bytes) = fs::read(path.join(META)) else {
        return false;
    };
    let Ok(meta) = serde_json::from_slice::<Metadata>(&bytes) else {
        return false;
    };
    meta.version == 1 && path.join(BLOCKS).is_file() && path.join(LOOKUP).is_file()
}
fn ioe(e: std::io::Error) -> String {
    format!("Binary scan index error: {e}")
}
fn map_tree(n: &ScanNodeSummary) -> ScanTreemapNode {
    ScanTreemapNode {
        id: Some(n.id),
        name: n.name.clone(),
        kind: if n.kind == ScanNodeKind::Directory {
            ScanTreemapNodeKind::Directory
        } else {
            ScanTreemapNodeKind::File
        },
        size_bytes: n.size_bytes,
        category: n.category,
        grouped_item_count: 1,
    }
}
fn dominant(nodes: &[ScanNodeSummary]) -> ScanCategory {
    let mut a = [0u64; 12];
    for n in nodes {
        a[n.category.index()] += n.size_bytes
    }
    ScanCategory::ALL
        .into_iter()
        .max_by_key(|c| a[c.index()])
        .unwrap_or(ScanCategory::Other)
}
fn rank(r: &ScanSearchResult, q: &str) -> u8 {
    let n = r.name.to_lowercase();
    if n == q {
        0
    } else if n.starts_with(q) {
        1
    } else {
        2
    }
}
fn response(
    q: &str,
    results: Vec<ScanSearchResult>,
    matched: usize,
    s: Instant,
) -> ScanSearchResponse {
    ScanSearchResponse {
        query: q.into(),
        matched_count: matched,
        results,
        superseded: false,
        elapsed_milliseconds: s.elapsed().as_millis() as u64,
    }
}
fn sort_large(v: &mut [(u64, ScanNodeSummary)], s: LargeFileSort) {
    v.sort_by(|a, b| {
        match s {
            LargeFileSort::SizeDescending => b.1.size_bytes.cmp(&a.1.size_bytes),
            LargeFileSort::ModifiedNewest => {
                b.1.modified_at_unix_seconds
                    .cmp(&a.1.modified_at_unix_seconds)
            }
            LargeFileSort::ModifiedOldest => {
                a.1.modified_at_unix_seconds
                    .cmp(&b.1.modified_at_unix_seconds)
            }
            LargeFileSort::NameAscending => a.1.name.to_lowercase().cmp(&b.1.name.to_lowercase()),
        }
        .then(a.1.id.cmp(&b.1.id))
    })
}
fn safety(c: ScanCategory) -> LargeFileSafety {
    match c {
        ScanCategory::System | ScanCategory::Applications => LargeFileSafety::Protected,
        ScanCategory::Caches => LargeFileSafety::LikelySafe,
        _ => LargeFileSafety::Review,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::scan::model::ScanCategorySummary;

    fn temp(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "disk-vacuum-binary-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }
    fn summary(label: &str) -> ScanSummary {
        ScanSummary {
            target_label: label.into(),
            completed_at_unix_seconds: 1,
            total_size_bytes: 900,
            capacity: None,
            file_count: 2,
            directory_count: 2,
            permission_denied_count: 0,
            unreadable_entry_count: 0,
            skipped_symlink_count: 0,
            skipped_hard_link_count: 0,
            skipped_mounted_filesystem_count: 0,
            skipped_special_file_count: 0,
            root_directory_id: 0,
            top_level_items: vec![],
            categories: vec![ScanCategorySummary {
                category: ScanCategory::Documents,
                size_bytes: 900,
                file_count: 2,
            }],
        }
    }
    fn populate(repo: &ScanRepository, label: &str) {
        let writer = repo.begin_scan_write().unwrap();
        writer
            .write_directory(ScanDirectoryRecord {
                id: 1,
                parent_id: Some(0),
                name: "Documents".into(),
                children: vec![
                    ScanNodeSummary {
                        id: 2,
                        name: "movie.mkv".into(),
                        kind: ScanNodeKind::File,
                        size_bytes: 700,
                        category: ScanCategory::Video,
                        modified_at_unix_seconds: Some(10),
                    },
                    ScanNodeSummary {
                        id: 3,
                        name: "notes.txt".into(),
                        kind: ScanNodeKind::File,
                        size_bytes: 200,
                        category: ScanCategory::Documents,
                        modified_at_unix_seconds: Some(5),
                    },
                ],
            })
            .unwrap();
        writer
            .write_directory(ScanDirectoryRecord {
                id: 0,
                parent_id: None,
                name: label.into(),
                children: vec![ScanNodeSummary {
                    id: 1,
                    name: "Documents".into(),
                    kind: ScanNodeKind::Directory,
                    size_bytes: 900,
                    category: ScanCategory::Documents,
                    modified_at_unix_seconds: None,
                }],
            })
            .unwrap();
        writer
            .finish("/home/tester".into(), summary(label))
            .unwrap();
    }

    #[test]
    fn binary_generation_survives_restart_and_supports_queries() {
        let path = temp("restart");
        let repo = ScanRepository::open(&path).unwrap();
        populate(&repo, "Home");
        drop(repo);
        let repo = ScanRepository::open(&path).unwrap();
        assert_eq!(
            repo.load_scan_summary().unwrap().unwrap().target_label,
            "Home"
        );
        assert_eq!(repo.directory(1, 0, 100).unwrap().items.len(), 2);
        assert_eq!(
            repo.node_details(1, 2).unwrap().path,
            "/home/tester/Documents/movie.mkv"
        );
        assert_eq!(repo.search("movie", 50).unwrap().results.len(), 1);
        let large = repo
            .large_files(&LargeFilesQuery {
                minimum_size_bytes: 500,
                category: None,
                extension: Some("mkv".into()),
                modified_before_unix_seconds: None,
                sort: LargeFileSort::SizeDescending,
                offset: 0,
                limit: 50,
            })
            .unwrap();
        assert_eq!(large.total_count, 1);
        assert_eq!(large.items[0].name, "movie.mkv");
        fs::remove_dir_all(path).unwrap();
    }

    #[test]
    fn cancelled_generation_preserves_previous_scan() {
        let path = temp("cancel");
        let repo = ScanRepository::open(&path).unwrap();
        populate(&repo, "Previous");
        let writer = repo.begin_scan_write().unwrap();
        writer
            .write_directory(ScanDirectoryRecord {
                id: 0,
                parent_id: None,
                name: "Partial".into(),
                children: vec![],
            })
            .unwrap();
        drop(writer);
        assert_eq!(
            repo.load_scan_summary().unwrap().unwrap().target_label,
            "Previous"
        );
        drop(repo);
        assert_eq!(
            ScanRepository::open(&path)
                .unwrap()
                .load_scan_summary()
                .unwrap()
                .unwrap()
                .target_label,
            "Previous"
        );
        fs::remove_dir_all(path).unwrap();
    }

    #[test]
    fn corrupt_newer_generation_is_ignored() {
        let path = temp("corrupt");
        let repo = ScanRepository::open(&path).unwrap();
        populate(&repo, "Valid");
        let corrupt = path
            .join(ROOT)
            .join("generation-99999999999999999999999999999999999999");
        fs::create_dir_all(&corrupt).unwrap();
        fs::write(corrupt.join(META), b"not json").unwrap();
        drop(repo);
        assert_eq!(
            ScanRepository::open(&path)
                .unwrap()
                .load_scan_summary()
                .unwrap()
                .unwrap()
                .target_label,
            "Valid"
        );
        fs::remove_dir_all(path).unwrap();
    }
}
