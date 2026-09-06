use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use rusqlite::{params, Connection, OptionalExtension};

use crate::features::scan::model::{CompletedScan, ScanDirectoryRecord, ScanSummary};

const SCHEMA_VERSION: i64 = 1;
const DATABASE_FILE_NAME: &str = "disk-vacuum.sqlite3";

#[derive(Clone, Debug)]
pub struct ScanRepository {
    database_path: PathBuf,
}

impl ScanRepository {
    pub fn open(app_data_dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(app_data_dir)
            .map_err(|error| format!("Could not create the app data directory: {error}"))?;
        let repository = Self {
            database_path: app_data_dir.join(DATABASE_FILE_NAME),
        };
        let connection = repository.connect()?;
        migrate(&connection)?;
        Ok(repository)
    }

    pub fn save_completed_scan(&self, scan: &CompletedScan) -> Result<(), String> {
        let mut connection = self.connect()?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Could not begin saving the scan: {error}"))?;
        let summary_json = serde_json::to_string(&scan.summary)
            .map_err(|error| format!("Could not encode the scan summary: {error}"))?;

        transaction
            .execute("DELETE FROM scan_directories", [])
            .map_err(|error| format!("Could not replace saved scan directories: {error}"))?;
        transaction
            .execute("DELETE FROM completed_scan", [])
            .map_err(|error| format!("Could not replace the saved scan: {error}"))?;
        transaction
            .execute(
                "INSERT INTO completed_scan (id, root_path, summary_json) VALUES (1, ?1, ?2)",
                params![scan.root_path.to_string_lossy(), summary_json],
            )
            .map_err(|error| format!("Could not save the scan summary: {error}"))?;

        {
            let mut statement = transaction
                .prepare_cached("INSERT INTO scan_directories (id, record_json) VALUES (?1, ?2)")
                .map_err(|error| format!("Could not prepare scan item storage: {error}"))?;
            for directory in scan.directories.values() {
                let directory_json = serde_json::to_string(directory)
                    .map_err(|error| format!("Could not encode scanned items: {error}"))?;
                let directory_id = i64::try_from(directory.id)
                    .map_err(|_| "A scanned directory ID exceeded SQLite's range.".to_owned())?;
                statement
                    .execute(params![directory_id, directory_json])
                    .map_err(|error| format!("Could not save scanned items: {error}"))?;
            }
        }

        transaction
            .commit()
            .map_err(|error| format!("Could not commit the completed scan: {error}"))
    }

    pub fn load_completed_scan(&self) -> Result<Option<CompletedScan>, String> {
        let connection = self.connect()?;
        let metadata = connection
            .query_row(
                "SELECT root_path, summary_json FROM completed_scan WHERE id = 1",
                [],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| format!("Could not read the saved scan: {error}"))?;
        let Some((root_path, summary_json)) = metadata else {
            return Ok(None);
        };
        let summary = serde_json::from_str::<ScanSummary>(&summary_json)
            .map_err(|error| format!("Could not decode the saved scan summary: {error}"))?;
        let mut statement = connection
            .prepare("SELECT record_json FROM scan_directories")
            .map_err(|error| format!("Could not prepare saved item loading: {error}"))?;
        let records = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Could not load saved scan items: {error}"))?;
        let mut directories = HashMap::new();
        for record_json in records {
            let record = serde_json::from_str::<ScanDirectoryRecord>(
                &record_json
                    .map_err(|error| format!("Could not read a saved directory: {error}"))?,
            )
            .map_err(|error| format!("Could not decode saved scan items: {error}"))?;
            directories.insert(record.id, record);
        }

        Ok(Some(CompletedScan {
            root_path: PathBuf::from(root_path),
            summary,
            directories,
        }))
    }

    fn connect(&self) -> Result<Connection, String> {
        let connection = Connection::open(&self.database_path)
            .map_err(|error| format!("Could not open DiskVacuum's database: {error}"))?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;",
            )
            .map_err(|error| format!("Could not configure DiskVacuum's database: {error}"))?;
        Ok(connection)
    }
}

fn migrate(connection: &Connection) -> Result<(), String> {
    let version = connection
        .pragma_query_value(None, "user_version", |row| row.get::<_, i64>(0))
        .map_err(|error| format!("Could not read the database schema version: {error}"))?;
    if version > SCHEMA_VERSION {
        return Err(format!(
            "This database schema is newer than this DiskVacuum build ({version} > {SCHEMA_VERSION})."
        ));
    }
    if version < 1 {
        connection
            .execute_batch(
                "BEGIN;
                 CREATE TABLE completed_scan (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    root_path TEXT NOT NULL,
                    summary_json TEXT NOT NULL
                 );
                 CREATE TABLE scan_directories (
                    id INTEGER PRIMARY KEY,
                    record_json TEXT NOT NULL
                 );
                 PRAGMA user_version = 1;
                 COMMIT;",
            )
            .map_err(|error| format!("Could not create the database schema: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{
        collections::HashMap,
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::ScanRepository;
    use crate::features::scan::model::{
        CompletedScan, ScanCategory, ScanDirectoryRecord, ScanNodeKind, ScanNodeSummary,
        ScanSummary,
    };

    #[test]
    fn completed_scan_round_trips() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("disk-vacuum-db-test-{unique}"));
        let repository = ScanRepository::open(&directory).unwrap();
        let child = ScanNodeSummary {
            id: 1,
            name: "file.txt".into(),
            kind: ScanNodeKind::File,
            size_bytes: 42,
            category: ScanCategory::Documents,
            modified_at_unix_seconds: Some(7),
        };
        let scan = CompletedScan {
            root_path: "/tmp/example".into(),
            summary: ScanSummary {
                target_label: "Example".into(),
                completed_at_unix_seconds: 1,
                total_size_bytes: 42,
                capacity: None,
                file_count: 1,
                directory_count: 1,
                permission_denied_count: 0,
                unreadable_entry_count: 0,
                skipped_symlink_count: 0,
                skipped_hard_link_count: 0,
                skipped_mounted_filesystem_count: 0,
                skipped_special_file_count: 0,
                root_directory_id: 0,
                top_level_items: vec![child.clone()],
                categories: vec![],
            },
            directories: HashMap::from([(
                0,
                ScanDirectoryRecord {
                    id: 0,
                    parent_id: None,
                    name: "Example".into(),
                    children: vec![child],
                },
            )]),
        };
        repository.save_completed_scan(&scan).unwrap();
        let restored = repository.load_completed_scan().unwrap().unwrap();
        assert_eq!(restored.root_path, scan.root_path);
        assert_eq!(restored.summary.total_size_bytes, 42);
        assert_eq!(restored.directories[&0].children[0].name, "file.txt");
        fs::remove_dir_all(directory).unwrap();
    }
}
