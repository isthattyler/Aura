pub mod file_cleaner;
pub mod app_cleaner;

pub use file_cleaner::FileCleaner;
pub use app_cleaner::AppCleaner;

use std::path::{Path, PathBuf};
use crate::error::AppError;
use crate::platform::current_platform;

/// Validate that a path is safe to delete.
/// Returns Err if the path is protected or outside allowed zones.
pub fn safety_check(path: &Path) -> Result<(), AppError> {
    let platform = current_platform();
    let protected = platform.protected_paths();

    // Reject protected system paths
    if protected.iter().any(|p| path.starts_with(p)) {
        return Err(AppError::Permission(format!(
            "Path '{}' is protected and cannot be deleted",
            path.display()
        )));
    }

    // Reject absolute system paths
    let forbidden_prefixes = ["/System", "/usr/bin", "/sbin", "/bin", "C:\\Windows"];
    for prefix in &forbidden_prefixes {
        if path.to_string_lossy().starts_with(prefix) {
            return Err(AppError::Permission(format!(
                "Refusing to delete system path: {}",
                path.display()
            )));
        }
    }

    Ok(())
}

/// Write a record to the undo log before any deletion.
pub async fn write_undo_log(paths: &[PathBuf]) -> Result<(), AppError> {
    let undo_dir = undo_log_dir()?;
    std::fs::create_dir_all(&undo_dir)?;

    let log_path = undo_dir.join("undo_log.json");

    // Append to existing log
    let existing: Vec<UndoRecord> = if log_path.exists() {
        let data = std::fs::read_to_string(&log_path)?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    };

    let now = chrono::Utc::now().to_rfc3339();
    let new_records: Vec<UndoRecord> = paths
        .iter()
        .map(|p| UndoRecord {
            path: p.to_string_lossy().to_string(),
            deleted_at: now.clone(),
            size_bytes: std::fs::metadata(p).map(|m| m.len()).unwrap_or(0),
        })
        .collect();

    let mut all = existing;
    all.extend(new_records);

    // Keep last 1000 records
    if all.len() > 1000 {
        let drain_count = all.len() - 1000;
        all.drain(..drain_count);
    }

    let json = serde_json::to_string_pretty(&all)
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(&log_path, json)?;

    Ok(())
}

fn undo_log_dir() -> Result<PathBuf, AppError> {
    dirs::home_dir()
        .map(|h| h.join(".aura"))
        .ok_or_else(|| AppError::NotFound("Home directory not found".into()))
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct UndoRecord {
    pub path: String,
    pub deleted_at: String,
    pub size_bytes: u64,
}
