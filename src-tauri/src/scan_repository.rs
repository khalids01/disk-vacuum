#[cfg(test)]
use crate::features::scan::model::CompletedScan;
use crate::features::scan::model::{
    LargeFileItem, LargeFileSafety, LargeFileSort, LargeFilesPage, LargeFilesQuery, ScanCategory,
    ScanDirectoryPage, ScanNodeDetails, ScanNodeKind, ScanNodeSummary, ScanSearchResponse,
    ScanSearchResult, ScanSummary, ScanTreemapNode, ScanTreemapNodeKind, ScanTreemapSummary,
};
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension, Row};
use std::{
    path::{Path, PathBuf},
    sync::mpsc::{self, Receiver, SyncSender},
    thread::{self, JoinHandle},
    time::Instant,
};

const SCHEMA_VERSION: i64 = 2;
const DATABASE_FILE_NAME: &str = "disk-vacuum.sqlite3";
const MAX_PAGE_SIZE: usize = 200;
const SCAN_WRITE_QUEUE_SIZE: usize = 64;
const NODE_BATCH_SIZE: usize = 512;
const DATABASE_INSERT_BATCH_SIZE: usize = 256;

enum ScanWriteMessage {
    NodeBatch {
        parent_id: u64,
        nodes: Vec<ScanNodeSummary>,
    },
    Complete {
        root_path: PathBuf,
        summary: ScanSummary,
    },
}

pub struct ScanWriteSession {
    sender: Option<SyncSender<ScanWriteMessage>>,
    worker: Option<JoinHandle<Result<(), String>>>,
}

impl ScanWriteSession {
    pub fn write_directory(
        &self,
        directory: crate::features::scan::model::ScanDirectoryRecord,
    ) -> Result<(), String> {
        let sender = self
            .sender
            .as_ref()
            .ok_or_else(|| "The scan index writer has already finished.".to_owned())?;
        let parent_id = directory.id;
        let mut nodes = directory.children.into_iter();
        loop {
            let batch = nodes.by_ref().take(NODE_BATCH_SIZE).collect::<Vec<_>>();
            if batch.is_empty() {
                return Ok(());
            }
            sender
                .send(ScanWriteMessage::NodeBatch {
                    parent_id,
                    nodes: batch,
                })
                .map_err(|_| "The scan index writer stopped unexpectedly.".to_owned())?;
        }
    }

    pub fn finish(mut self, root_path: PathBuf, summary: ScanSummary) -> Result<(), String> {
        self.sender
            .take()
            .ok_or_else(|| "The scan index writer has already finished.".to_owned())?
            .send(ScanWriteMessage::Complete { root_path, summary })
            .map_err(|_| "The scan index writer stopped unexpectedly.".to_owned())?;
        self.worker
            .take()
            .ok_or_else(|| "The scan index writer has already stopped.".to_owned())?
            .join()
            .map_err(|_| "The scan index writer crashed.".to_owned())?
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

#[derive(Clone, Debug)]
pub struct ScanRepository {
    database_path: PathBuf,
}
impl ScanRepository {
    pub fn open(app_data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Could not create the app data directory: {e}"))?;
        let repository = Self {
            database_path: app_data_dir.join(DATABASE_FILE_NAME),
        };
        let connection = repository.connect()?;
        migrate(&connection)?;
        Ok(repository)
    }
    #[cfg(test)]
    pub fn save_completed_scan(&self, scan: &CompletedScan) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection.transaction().map_err(db_error)?;
        let summary_json = serde_json::to_string(&scan.summary)
            .map_err(|e| format!("Could not encode the scan summary: {e}"))?;
        transaction
            .execute_batch("DROP INDEX IF EXISTS nodes_parent_size; DROP INDEX IF EXISTS nodes_file_size; DROP INDEX IF EXISTS nodes_category_size; DROP INDEX IF EXISTS nodes_modified;")
            .map_err(db_error)?;
        transaction
            .execute("DELETE FROM nodes", [])
            .map_err(db_error)?;
        transaction
            .execute("DELETE FROM completed_scan", [])
            .map_err(db_error)?;
        transaction
            .execute(
                "INSERT INTO completed_scan (id, root_path, summary_json) VALUES (1, ?1, ?2)",
                params![scan.root_path.to_string_lossy(), summary_json],
            )
            .map_err(db_error)?;
        {
            let mut statement = transaction.prepare_cached("INSERT INTO nodes (id,parent_id,name,kind,size_bytes,category,modified_at) VALUES (?1,?2,?3,?4,?5,?6,?7)").map_err(db_error)?;
            statement
                .execute(params![
                    to_i64(scan.summary.root_directory_id),
                    Option::<i64>::None,
                    scan.summary.target_label,
                    1_i64,
                    to_i64(scan.summary.total_size_bytes),
                    category_value(ScanCategory::Other),
                    Option::<i64>::None
                ])
                .map_err(db_error)?;
            for directory in scan.directories.values() {
                for node in &directory.children {
                    statement
                        .execute(params![
                            to_i64(node.id),
                            to_i64(directory.id),
                            node.name,
                            kind_value(node.kind),
                            to_i64(node.size_bytes),
                            category_value(node.category),
                            node.modified_at_unix_seconds.map(to_i64)
                        ])
                        .map_err(db_error)?;
                }
            }
        }
        transaction.execute_batch("CREATE INDEX nodes_parent_size ON nodes(parent_id,size_bytes DESC); CREATE INDEX nodes_file_size ON nodes(size_bytes DESC) WHERE kind=0; CREATE INDEX nodes_category_size ON nodes(category,size_bytes DESC) WHERE kind=0; CREATE INDEX nodes_modified ON nodes(modified_at) WHERE kind=0;").map_err(db_error)?;
        transaction.commit().map_err(db_error)?;
        connection
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA optimize;")
            .map_err(db_error)?;
        Ok(())
    }
    pub fn begin_scan_write(&self) -> Result<ScanWriteSession, String> {
        let (sender, receiver) = mpsc::sync_channel(SCAN_WRITE_QUEUE_SIZE);
        let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
        let database_path = self.database_path.clone();
        let worker = thread::Builder::new()
            .name("disk-vacuum-index-writer".into())
            .spawn(move || stream_scan_to_database(&database_path, receiver, ready_sender))
            .map_err(|e| format!("Could not start the scan index writer: {e}"))?;
        ready_receiver
            .recv()
            .map_err(|_| "The scan index writer stopped during startup.".to_owned())??;
        Ok(ScanWriteSession {
            sender: Some(sender),
            worker: Some(worker),
        })
    }
    pub fn load_scan_summary(&self) -> Result<Option<ScanSummary>, String> {
        let connection = self.connect()?;
        connection
            .query_row(
                "SELECT summary_json FROM completed_scan WHERE id=1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(db_error)?
            .map(|json| {
                serde_json::from_str(&json)
                    .map_err(|e| format!("Could not decode the saved scan summary: {e}"))
            })
            .transpose()
    }
    pub fn directory(
        &self,
        directory_id: u64,
        offset: usize,
        limit: usize,
    ) -> Result<ScanDirectoryPage, String> {
        let connection = self.connect()?;
        let (parent_id, name, kind) = identity(&connection, directory_id)?;
        if kind != ScanNodeKind::Directory {
            return Err("The selected item is not a directory.".into());
        }
        let total_items = count_children(&connection, directory_id)?;
        let offset = offset.min(total_items);
        let mut statement = connection.prepare("SELECT id,name,kind,size_bytes,category,modified_at FROM nodes WHERE parent_id=?1 ORDER BY size_bytes DESC,id LIMIT ?2 OFFSET ?3").map_err(db_error)?;
        let items = statement
            .query_map(
                params![
                    to_i64(directory_id),
                    limit.clamp(1, MAX_PAGE_SIZE) as i64,
                    offset as i64
                ],
                node_from_row,
            )
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        Ok(ScanDirectoryPage {
            directory_id,
            parent_id,
            name,
            total_items,
            offset,
            items,
        })
    }
    pub fn node_details(&self, directory_id: u64, node_id: u64) -> Result<ScanNodeDetails, String> {
        let connection = self.connect()?;
        let node = connection.query_row("SELECT id,name,kind,size_bytes,category,modified_at FROM nodes WHERE id=?1 AND parent_id=?2", params![to_i64(node_id),to_i64(directory_id)], node_from_row).optional().map_err(db_error)?.ok_or_else(|| "The selected scanned item is no longer available.".to_owned())?;
        let child_count = if node.kind == ScanNodeKind::Directory {
            count_children(&connection, node.id)?
        } else {
            0
        };
        let path = build_path(&connection, directory_id, &node.name)?;
        Ok(ScanNodeDetails {
            id: node.id,
            parent_directory_id: directory_id,
            name: node.name,
            kind: node.kind,
            size_bytes: node.size_bytes,
            category: node.category,
            path,
            child_count,
            modified_at_unix_seconds: node.modified_at_unix_seconds,
        })
    }
    pub fn treemap(
        &self,
        directory_id: u64,
        requested_max_nodes: usize,
    ) -> Result<ScanTreemapSummary, String> {
        let connection = self.connect()?;
        let (parent_id, name, kind) = identity(&connection, directory_id)?;
        if kind != ScanNodeKind::Directory {
            return Err("The selected item is not a directory.".into());
        }
        let total_items = count_children(&connection, directory_id)?;
        let max_nodes = requested_max_nodes.clamp(4, 64);
        let visible = if total_items > max_nodes {
            max_nodes - 1
        } else {
            total_items
        };
        let mut statement = connection.prepare("SELECT id,name,kind,size_bytes,category FROM nodes WHERE parent_id=?1 ORDER BY size_bytes DESC,id LIMIT ?2").map_err(db_error)?;
        let mut nodes = statement
            .query_map(params![to_i64(directory_id), visible as i64], |row| {
                let kind = parse_kind(row.get(2)?)?;
                Ok(ScanTreemapNode {
                    id: Some(from_i64(row.get(0)?)),
                    name: row.get(1)?,
                    kind: if kind == ScanNodeKind::Directory {
                        ScanTreemapNodeKind::Directory
                    } else {
                        ScanTreemapNodeKind::File
                    },
                    size_bytes: from_i64(row.get(3)?),
                    category: parse_category(row.get(4)?)?,
                    grouped_item_count: 1,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        if visible < total_items {
            let (size, count) = connection.query_row("SELECT COALESCE(SUM(size_bytes),0),COUNT(*) FROM (SELECT size_bytes FROM nodes WHERE parent_id=?1 ORDER BY size_bytes DESC,id LIMIT -1 OFFSET ?2)", params![to_i64(directory_id), visible as i64], |row| Ok((from_i64(row.get(0)?), row.get::<_, i64>(1)? as usize))).map_err(db_error)?;
            let category = connection.query_row("SELECT category FROM (SELECT size_bytes,category FROM nodes WHERE parent_id=?1 ORDER BY size_bytes DESC,id LIMIT -1 OFFSET ?2) GROUP BY category ORDER BY SUM(size_bytes) DESC LIMIT 1", params![to_i64(directory_id), visible as i64], |row| parse_category(row.get(0)?)).map_err(db_error)?;
            nodes.push(ScanTreemapNode {
                id: None,
                name: "Other items".into(),
                kind: ScanTreemapNodeKind::Group,
                size_bytes: size,
                category,
                grouped_item_count: count,
            });
            nodes.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        }
        Ok(ScanTreemapSummary {
            directory_id,
            parent_id,
            name,
            total_items,
            nodes,
        })
    }
    pub fn search(
        &self,
        query: &str,
        requested_limit: usize,
    ) -> Result<ScanSearchResponse, String> {
        let started = Instant::now();
        let query = query.trim();
        let limit = requested_limit.clamp(1, 100);
        if query.chars().count() < 2 {
            return Ok(search_response(query, vec![], 0, started));
        }
        let connection = self.connect()?;
        let is_path = query.contains(['/', '\\']);
        let needle = query
            .rsplit(['/', '\\'])
            .find(|p| !p.is_empty())
            .unwrap_or(query);
        let pattern = format!("%{}%", escape_like(needle));
        let total=connection.query_row("SELECT COUNT(*) FROM nodes WHERE parent_id IS NOT NULL AND name LIKE ?1 ESCAPE '\\' COLLATE NOCASE",[&pattern],|r|r.get::<_,i64>(0)).map_err(db_error)? as usize;
        let prefix = format!("{}%", escape_like(needle));
        let candidate_limit = if is_path { 5000 } else { limit };
        let mut statement=connection.prepare("SELECT id,parent_id,name,kind,size_bytes,category,modified_at FROM nodes WHERE parent_id IS NOT NULL AND name LIKE ?1 ESCAPE '\\' COLLATE NOCASE ORDER BY CASE WHEN name=?2 COLLATE NOCASE THEN 0 WHEN name LIKE ?3 ESCAPE '\\' COLLATE NOCASE THEN 1 ELSE 2 END,size_bytes DESC LIMIT ?4").map_err(db_error)?;
        let rows = statement
            .query_map(
                params![pattern, needle, prefix, candidate_limit as i64],
                |r| {
                    Ok((
                        from_i64(r.get(0)?),
                        from_i64(r.get(1)?),
                        r.get::<_, String>(2)?,
                        parse_kind(r.get(3)?)?,
                        from_i64(r.get(4)?),
                        parse_category(r.get(5)?)?,
                        r.get::<_, Option<i64>>(6)?.map(from_i64),
                    ))
                },
            )
            .map_err(db_error)?;
        let lowered = query.to_ascii_lowercase();
        let mut results = Vec::with_capacity(limit);
        for row in rows {
            let (id, parent, name, kind, size, category, modified) = row.map_err(db_error)?;
            let path = build_path(&connection, parent, &name)?;
            if is_path && !path.to_ascii_lowercase().contains(&lowered) {
                continue;
            }
            results.push(ScanSearchResult {
                id,
                parent_directory_id: parent,
                name,
                kind,
                size_bytes: size,
                category,
                path,
                modified_at_unix_seconds: modified,
            });
            if results.len() == limit {
                break;
            }
        }
        let matched = if is_path { results.len() } else { total };
        Ok(search_response(query, results, matched, started))
    }
    pub fn large_files(&self, query: &LargeFilesQuery) -> Result<LargeFilesPage, String> {
        let connection = self.connect()?;
        let mut clauses = vec!["kind=0".to_owned(), "size_bytes>=?".to_owned()];
        let mut values = vec![Value::Integer(to_i64(query.minimum_size_bytes))];
        if let Some(category) = query.category {
            clauses.push("category=?".into());
            values.push(Value::Integer(category_value(category)));
        }
        if let Some(ext) = query
            .extension
            .as_deref()
            .map(str::trim)
            .map(|v| v.trim_start_matches('.'))
            .filter(|v| !v.is_empty())
        {
            clauses.push("name LIKE ? ESCAPE '\\' COLLATE NOCASE".into());
            values.push(Value::Text(format!("%.{}", escape_like(ext))));
        }
        if let Some(cutoff) = query.modified_before_unix_seconds {
            clauses.push("modified_at IS NOT NULL AND modified_at<=?".into());
            values.push(Value::Integer(to_i64(cutoff)));
        }
        let where_sql = clauses.join(" AND ");
        let totals_sql =
            format!("SELECT COUNT(*),COALESCE(SUM(size_bytes),0) FROM nodes WHERE {where_sql}");
        let (total_count, total_size_bytes) = connection
            .query_row(&totals_sql, params_from_iter(values.iter()), |r| {
                Ok((r.get::<_, i64>(0)? as usize, from_i64(r.get(1)?)))
            })
            .map_err(db_error)?;
        let offset = query.offset.min(100_000).min(total_count);
        let limit = query.limit.clamp(1, MAX_PAGE_SIZE);
        let order = match query.sort {
            LargeFileSort::SizeDescending => "size_bytes DESC,id",
            LargeFileSort::ModifiedNewest => "modified_at DESC,id",
            LargeFileSort::ModifiedOldest => "modified_at ASC,id",
            LargeFileSort::NameAscending => "name COLLATE NOCASE ASC,id",
        };
        let sql=format!("SELECT id,parent_id,name,size_bytes,category,modified_at FROM nodes WHERE {where_sql} ORDER BY {order} LIMIT ? OFFSET ?");
        let mut page_values = values;
        page_values.push(Value::Integer(limit as i64));
        page_values.push(Value::Integer(offset as i64));
        let mut statement = connection.prepare(&sql).map_err(db_error)?;
        let rows = statement
            .query_map(params_from_iter(page_values.iter()), |r| {
                Ok((
                    from_i64(r.get(0)?),
                    from_i64(r.get(1)?),
                    r.get::<_, String>(2)?,
                    from_i64(r.get(3)?),
                    parse_category(r.get(4)?)?,
                    r.get::<_, Option<i64>>(5)?.map(from_i64),
                ))
            })
            .map_err(db_error)?;
        let mut items = Vec::with_capacity(limit);
        for row in rows {
            let (id, parent, name, size, category, modified) = row.map_err(db_error)?;
            let path = build_path(&connection, parent, &name)?;
            let parent_path = Path::new(&path)
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default();
            let extension = Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .map(str::to_ascii_lowercase);
            items.push(LargeFileItem {
                id,
                parent_directory_id: parent,
                name,
                path,
                parent_path,
                extension,
                size_bytes: size,
                modified_at_unix_seconds: modified,
                category,
                safety: safety(category),
            });
        }
        Ok(LargeFilesPage {
            total_count,
            total_size_bytes,
            offset,
            items,
        })
    }
    fn connect(&self) -> Result<Connection, String> {
        let connection = Connection::open(&self.database_path).map_err(db_error)?;
        connection.execute_batch("PRAGMA journal_mode=WAL;PRAGMA synchronous=NORMAL;PRAGMA temp_store=FILE;PRAGMA cache_size=-32768;").map_err(db_error)?;
        Ok(connection)
    }
}

fn stream_scan_to_database(
    database_path: &Path,
    receiver: Receiver<ScanWriteMessage>,
    ready: SyncSender<Result<(), String>>,
) -> Result<(), String> {
    let mut connection = Connection::open(database_path).map_err(db_error)?;
    connection
        .execute_batch(
            "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA temp_store=FILE;
         PRAGMA cache_size=-32768;
         PRAGMA wal_autocheckpoint=0;
         PRAGMA threads=4;
         DROP TABLE IF EXISTS nodes_staging;
         CREATE TABLE nodes_staging(
             id INTEGER PRIMARY KEY,
             parent_id INTEGER,
             name TEXT NOT NULL,
             kind INTEGER NOT NULL,
             size_bytes INTEGER NOT NULL,
             category INTEGER NOT NULL,
             modified_at INTEGER
         );",
        )
        .map_err(db_error)?;

    let transaction = match connection.transaction().map_err(db_error) {
        Ok(transaction) => transaction,
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    ready
        .send(Ok(()))
        .map_err(|_| "The scanner stopped while the index writer was starting.".to_owned())?;

    let (root_path, summary) = loop {
        match receiver.recv() {
            Ok(ScanWriteMessage::NodeBatch { parent_id, nodes }) => {
                insert_node_batches(&transaction, parent_id, nodes)?;
            }
            Ok(ScanWriteMessage::Complete { root_path, summary }) => break (root_path, summary),
            Err(_) => {
                drop(transaction);
                connection
                    .execute_batch("DROP TABLE IF EXISTS nodes_staging;")
                    .map_err(db_error)?;
                return Err("The scan ended before its index was complete.".to_owned());
            }
        }
    };

    transaction
        .execute(
            "INSERT INTO nodes_staging (id,parent_id,name,kind,size_bytes,category,modified_at) VALUES (?1,NULL,?2,1,?3,?4,NULL)",
            params![
                to_i64(summary.root_directory_id),
                &summary.target_label,
                to_i64(summary.total_size_bytes),
                category_value(ScanCategory::Other)
            ],
        )
        .map_err(db_error)?;
    transaction.commit().map_err(db_error)?;

    let summary_json = serde_json::to_string(&summary)
        .map_err(|e| format!("Could not encode the scan summary: {e}"))?;
    let finalize = connection.transaction().map_err(db_error)?;
    finalize
        .execute_batch(
            "DROP TABLE nodes;
             ALTER TABLE nodes_staging RENAME TO nodes;
             CREATE INDEX nodes_parent_size ON nodes(parent_id,size_bytes DESC);
             CREATE INDEX nodes_file_size ON nodes(size_bytes DESC) WHERE kind=0;",
        )
        .map_err(db_error)?;
    finalize
        .execute("DELETE FROM completed_scan", [])
        .map_err(db_error)?;
    finalize
        .execute(
            "INSERT INTO completed_scan (id,root_path,summary_json) VALUES (1,?1,?2)",
            params![root_path.to_string_lossy(), summary_json],
        )
        .map_err(db_error)?;
    finalize.commit().map_err(db_error)?;

    connection
        .execute_batch("PRAGMA wal_checkpoint(PASSIVE); PRAGMA optimize;")
        .map_err(db_error)?;
    connection
        .execute_batch("DROP TABLE IF EXISTS nodes_staging;")
        .map_err(db_error)?;
    Ok(())
}

fn insert_node_batches(
    transaction: &rusqlite::Transaction<'_>,
    parent_id: u64,
    nodes: Vec<ScanNodeSummary>,
) -> Result<(), String> {
    let mut nodes = nodes.into_iter();
    loop {
        let batch = nodes
            .by_ref()
            .take(DATABASE_INSERT_BATCH_SIZE)
            .collect::<Vec<_>>();
        if batch.is_empty() {
            return Ok(());
        }

        let mut sql = String::from(
            "INSERT INTO nodes_staging (id,parent_id,name,kind,size_bytes,category,modified_at) VALUES ",
        );
        for index in 0..batch.len() {
            if index > 0 {
                sql.push(',');
            }
            sql.push_str("(?,?,?,?,?,?,?)");
        }

        let mut values = Vec::with_capacity(batch.len() * 7);
        for node in batch {
            values.push(Value::Integer(to_i64(node.id)));
            values.push(Value::Integer(to_i64(parent_id)));
            values.push(Value::Text(node.name));
            values.push(Value::Integer(kind_value(node.kind)));
            values.push(Value::Integer(to_i64(node.size_bytes)));
            values.push(Value::Integer(category_value(node.category)));
            values.push(
                node.modified_at_unix_seconds
                    .map(to_i64)
                    .map(Value::Integer)
                    .unwrap_or(Value::Null),
            );
        }
        transaction
            .prepare_cached(&sql)
            .map_err(db_error)?
            .execute(params_from_iter(values.iter()))
            .map_err(db_error)?;
    }
}

fn migrate(connection: &Connection) -> Result<(), String> {
    let version = connection
        .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
        .map_err(db_error)?;
    if version > SCHEMA_VERSION {
        return Err(format!(
            "Database schema {version} is newer than supported {SCHEMA_VERSION}."
        ));
    }
    if version < 2 {
        connection.execute_batch("BEGIN;DROP TABLE IF EXISTS scan_directories;DROP TABLE IF EXISTS nodes;DROP TABLE IF EXISTS completed_scan;CREATE TABLE completed_scan(id INTEGER PRIMARY KEY CHECK(id=1),root_path TEXT NOT NULL,summary_json TEXT NOT NULL);CREATE TABLE nodes(id INTEGER PRIMARY KEY,parent_id INTEGER,name TEXT NOT NULL,kind INTEGER NOT NULL,size_bytes INTEGER NOT NULL,category INTEGER NOT NULL,modified_at INTEGER);CREATE INDEX nodes_parent_size ON nodes(parent_id,size_bytes DESC);CREATE INDEX nodes_file_size ON nodes(size_bytes DESC) WHERE kind=0;CREATE INDEX nodes_category_size ON nodes(category,size_bytes DESC) WHERE kind=0;CREATE INDEX nodes_modified ON nodes(modified_at) WHERE kind=0;PRAGMA user_version=2;COMMIT;PRAGMA wal_checkpoint(TRUNCATE);VACUUM;").map_err(|e|format!("Could not replace the obsolete scan-cache schema: {e}"))?;
    }
    connection
        .execute_batch("DROP TABLE IF EXISTS nodes_staging;")
        .map_err(db_error)?;
    Ok(())
}
fn identity(c: &Connection, id: u64) -> Result<(Option<u64>, String, ScanNodeKind), String> {
    c.query_row(
        "SELECT parent_id,name,kind FROM nodes WHERE id=?1",
        [to_i64(id)],
        |r| {
            Ok((
                r.get::<_, Option<i64>>(0)?.map(from_i64),
                r.get(1)?,
                parse_kind(r.get(2)?)?,
            ))
        },
    )
    .optional()
    .map_err(db_error)?
    .ok_or_else(|| "The scanned directory is no longer available.".into())
}
fn count_children(c: &Connection, id: u64) -> Result<usize, String> {
    c.query_row(
        "SELECT COUNT(*) FROM nodes WHERE parent_id=?1",
        [to_i64(id)],
        |r| r.get::<_, i64>(0),
    )
    .map(|v| v as usize)
    .map_err(db_error)
}
fn build_path(c: &Connection, parent: u64, name: &str) -> Result<String, String> {
    let root: String = c
        .query_row("SELECT root_path FROM completed_scan WHERE id=1", [], |r| {
            r.get(0)
        })
        .map_err(db_error)?;
    let mut parts = vec![name.to_owned()];
    let mut current = parent;
    while current != 0 {
        let (next, name, kind) = identity(c, current)?;
        if kind != ScanNodeKind::Directory {
            return Err("Invalid saved parent path.".into());
        }
        parts.push(name);
        current = next.ok_or_else(|| "Incomplete saved parent path.".to_owned())?;
    }
    let mut path = PathBuf::from(root);
    for part in parts.into_iter().rev() {
        path.push(part);
    }
    Ok(path.to_string_lossy().into_owned())
}
fn node_from_row(r: &Row<'_>) -> rusqlite::Result<ScanNodeSummary> {
    Ok(ScanNodeSummary {
        id: from_i64(r.get(0)?),
        name: r.get(1)?,
        kind: parse_kind(r.get(2)?)?,
        size_bytes: from_i64(r.get(3)?),
        category: parse_category(r.get(4)?)?,
        modified_at_unix_seconds: r.get::<_, Option<i64>>(5)?.map(from_i64),
    })
}
fn kind_value(v: ScanNodeKind) -> i64 {
    if v == ScanNodeKind::File {
        0
    } else {
        1
    }
}
fn parse_kind(v: i64) -> rusqlite::Result<ScanNodeKind> {
    match v {
        0 => Ok(ScanNodeKind::File),
        1 => Ok(ScanNodeKind::Directory),
        _ => Err(rusqlite::Error::IntegralValueOutOfRange(0, v)),
    }
}
fn category_value(v: ScanCategory) -> i64 {
    v.index() as i64
}
fn parse_category(v: i64) -> rusqlite::Result<ScanCategory> {
    ScanCategory::ALL
        .get(v as usize)
        .copied()
        .ok_or(rusqlite::Error::IntegralValueOutOfRange(0, v))
}
fn to_i64(v: u64) -> i64 {
    v.min(i64::MAX as u64) as i64
}
fn from_i64(v: i64) -> u64 {
    v.max(0) as u64
}
fn escape_like(v: &str) -> String {
    v.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}
fn db_error(e: rusqlite::Error) -> String {
    format!("DiskVacuum database error: {e}")
}
fn safety(c: ScanCategory) -> LargeFileSafety {
    match c {
        ScanCategory::System | ScanCategory::Applications => LargeFileSafety::Protected,
        ScanCategory::Caches => LargeFileSafety::LikelySafe,
        _ => LargeFileSafety::Review,
    }
}
fn search_response(
    q: &str,
    r: Vec<ScanSearchResult>,
    count: usize,
    s: Instant,
) -> ScanSearchResponse {
    ScanSearchResponse {
        query: q.into(),
        matched_count: count,
        results: r,
        superseded: false,
        elapsed_milliseconds: s.elapsed().as_millis() as u64,
    }
}

#[cfg(test)]
mod tests {
    use super::ScanRepository;
    use crate::features::scan::model::{
        CompletedScan, LargeFileSort, LargeFilesQuery, ScanCategory, ScanDirectoryRecord,
        ScanNodeKind, ScanNodeSummary, ScanSummary,
    };
    use rusqlite::Connection;
    use std::{
        collections::HashMap,
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_path(label: &str) -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("disk-vacuum-{label}-{id}"))
    }
    fn fixture() -> CompletedScan {
        let directory = ScanNodeSummary {
            id: 1,
            name: "Documents".into(),
            kind: ScanNodeKind::Directory,
            size_bytes: 900,
            category: ScanCategory::Documents,
            modified_at_unix_seconds: None,
        };
        let children = vec![
            ScanNodeSummary {
                id: 2,
                name: "Movie.MKV".into(),
                kind: ScanNodeKind::File,
                size_bytes: 700,
                category: ScanCategory::Video,
                modified_at_unix_seconds: Some(10),
            },
            ScanNodeSummary {
                id: 3,
                name: "cache.bin".into(),
                kind: ScanNodeKind::File,
                size_bytes: 200,
                category: ScanCategory::Caches,
                modified_at_unix_seconds: Some(5),
            },
        ];
        CompletedScan {
            root_path: "/home/tester".into(),
            summary: ScanSummary {
                target_label: "Home".into(),
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
                top_level_items: vec![directory.clone()],
                categories: vec![],
            },
            directories: HashMap::from([
                (
                    0,
                    ScanDirectoryRecord {
                        id: 0,
                        parent_id: None,
                        name: "Home".into(),
                        children: vec![directory],
                    },
                ),
                (
                    1,
                    ScanDirectoryRecord {
                        id: 1,
                        parent_id: Some(0),
                        name: "Documents".into(),
                        children,
                    },
                ),
            ]),
        }
    }
    #[test]
    fn normalized_scan_supports_lazy_feature_queries() {
        let path = temp_path("queries");
        let repository = ScanRepository::open(&path).unwrap();
        repository.save_completed_scan(&fixture()).unwrap();
        assert_eq!(
            repository.load_scan_summary().unwrap().unwrap().file_count,
            2
        );
        assert_eq!(repository.directory(1, 0, 100).unwrap().items.len(), 2);
        assert_eq!(repository.treemap(1, 4).unwrap().total_items, 2);
        assert_eq!(
            repository.node_details(1, 2).unwrap().path,
            "/home/tester/Documents/Movie.MKV"
        );
        assert_eq!(repository.search("movie", 50).unwrap().results.len(), 1);
        let result = repository
            .large_files(&LargeFilesQuery {
                minimum_size_bytes: 100,
                category: None,
                extension: Some("mkv".into()),
                modified_before_unix_seconds: None,
                sort: LargeFileSort::SizeDescending,
                offset: 0,
                limit: 100,
            })
            .unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.items[0].path, "/home/tester/Documents/Movie.MKV");
        fs::remove_dir_all(path).unwrap();
    }
    #[test]
    fn completed_stream_atomically_replaces_the_index_with_two_query_indexes() {
        let path = temp_path("stream-complete");
        let repository = ScanRepository::open(&path).unwrap();
        repository.save_completed_scan(&fixture()).unwrap();

        let replacement = fixture();
        let session = repository.begin_scan_write().unwrap();
        for directory in replacement.directories.into_values() {
            session.write_directory(directory).unwrap();
        }
        session
            .finish(replacement.root_path, replacement.summary)
            .unwrap();

        assert_eq!(
            repository
                .load_scan_summary()
                .unwrap()
                .unwrap()
                .target_label,
            "Home"
        );
        let connection = Connection::open(path.join("disk-vacuum.sqlite3")).unwrap();
        let staging_exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='nodes_staging')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!staging_exists);
        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='nodes' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .unwrap();
        let indexes = statement
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(indexes, vec!["nodes_file_size", "nodes_parent_size"]);
        drop(statement);
        drop(connection);
        fs::remove_dir_all(path).unwrap();
    }

    #[test]
    fn abandoned_stream_keeps_the_previous_completed_scan() {
        let path = temp_path("rollback");
        let repository = ScanRepository::open(&path).unwrap();
        repository.save_completed_scan(&fixture()).unwrap();

        let session = repository.begin_scan_write().unwrap();
        session
            .write_directory(ScanDirectoryRecord {
                id: 0,
                parent_id: None,
                name: "Incomplete".into(),
                children: vec![ScanNodeSummary {
                    id: 99,
                    name: "partial.bin".into(),
                    kind: ScanNodeKind::File,
                    size_bytes: 1,
                    category: ScanCategory::Other,
                    modified_at_unix_seconds: None,
                }],
            })
            .unwrap();
        drop(session);

        assert_eq!(
            repository
                .load_scan_summary()
                .unwrap()
                .unwrap()
                .target_label,
            "Home"
        );
        assert!(repository.node_details(0, 99).is_err());
        assert_eq!(repository.directory(1, 0, 100).unwrap().items.len(), 2);
        fs::remove_dir_all(path).unwrap();
    }

    #[test]
    fn version_one_json_cache_is_invalidated_by_schema_migration() {
        let path = temp_path("migration");
        fs::create_dir_all(&path).unwrap();
        let database_path = path.join("disk-vacuum.sqlite3");
        let connection = Connection::open(&database_path).unwrap();
        connection.execute_batch("CREATE TABLE completed_scan(id INTEGER PRIMARY KEY,root_path TEXT,summary_json TEXT);CREATE TABLE scan_directories(id INTEGER PRIMARY KEY,record_json TEXT);INSERT INTO completed_scan VALUES(1,'/','{}');PRAGMA user_version=1;").unwrap();
        drop(connection);
        let repository = ScanRepository::open(&path).unwrap();
        assert!(repository.load_scan_summary().unwrap().is_none());
        let connection = Connection::open(database_path).unwrap();
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);
        fs::remove_dir_all(path).unwrap();
    }
}
