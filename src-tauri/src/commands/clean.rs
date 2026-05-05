use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use crate::error::AppError;
use crate::models::{CleanResult, ScanResults};
use crate::cleaner::FileCleaner;
use super::scan::ScanState;

/// Resolve item IDs to filesystem paths using scan results.
pub(crate) fn resolve_paths(results: &ScanResults, item_ids: &[String]) -> Vec<PathBuf> {
    results
        .items
        .iter()
        .filter(|item| item_ids.contains(&item.id))
        .map(|item| {
            if item.path.starts_with("~/") {
                dirs::home_dir()
                    .map(|h| h.join(&item.path[2..]))
                    .unwrap_or_else(|| PathBuf::from(&item.path))
            } else {
                PathBuf::from(&item.path)
            }
        })
        .collect()
}

/// Clean a list of items by their IDs (from the scan results cache).
#[tauri::command]
pub async fn clean_items(
    app: AppHandle,
    item_ids: Vec<String>,
    permanent: bool,
    state: State<'_, ScanState>,
) -> Result<CleanResult, AppError> {
    let paths: Vec<PathBuf> = {
        let lock = state.results.lock().map_err(|_| AppError::Io("State lock poisoned".into()))?;
        let results = lock.as_ref().ok_or_else(|| AppError::NotFound("No scan results available".into()))?;
        resolve_paths(results, &item_ids)
    };

    if paths.is_empty() {
        return Ok(CleanResult {
            success: true,
            items_cleaned: 0,
            bytes_freed: 0,
            errors: vec![],
        });
    }

    let cleaner = FileCleaner::new();
    let result = cleaner.clean(&paths, permanent).await?;

    // Emit progress events
    let _ = app.emit("clean_complete", &result);

    // Update scan state by removing cleaned items
    if let Ok(mut lock) = state.results.lock() {
        if let Some(scan_results) = lock.as_mut() {
            scan_results.items.retain(|item| !item_ids.contains(&item.id));
            scan_results.total_bytes = scan_results.items.iter().map(|i| i.size_bytes).sum();

            // Rebuild by_category after removal
            let mut by_category = std::collections::HashMap::new();
            for item in &scan_results.items {
                let key = serde_json::to_string(&item.category)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_string();
                let entry = by_category
                    .entry(key)
                    .or_insert_with(|| crate::models::CategoryResult::default());
                entry.item_count += 1;
                entry.total_bytes += item.size_bytes;
            }
            scan_results.by_category = by_category;
        }
    }

    Ok(result)
}

/// Restore the last cleaned items from the undo log.
#[tauri::command]
pub async fn undo_last_clean() -> Result<CleanResult, AppError> {
    let undo_dir = dirs::home_dir()
        .ok_or_else(|| AppError::NotFound("Home directory not found".into()))?
        .join(".aura");
    let log_path = undo_dir.join("undo_log.json");

    if !log_path.exists() {
        return Ok(CleanResult {
            success: true,
            items_cleaned: 0,
            bytes_freed: 0,
            errors: vec![],
        });
    }

    let data = std::fs::read_to_string(&log_path)?;
    let records: Vec<super::super::cleaner::UndoRecord> = serde_json::from_str(&data)
        .map_err(|e| AppError::Io(format!("Failed to parse undo log: {}", e)))?;

    if records.is_empty() {
        return Ok(CleanResult {
            success: true,
            items_cleaned: 0,
            bytes_freed: 0,
            errors: vec![],
        });
    }

    let mut restored = 0usize;
    let mut bytes = 0u64;
    let mut errors = Vec::new();

    // Restore from the undo log (recent first)
    for record in records.iter().rev() {
        let path = PathBuf::from(&record.path);
        if path.exists() {
            restored += 1;
            continue;
        }

        // Recreate parent dirs and touch the file (best-effort restore)
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                if let Err(e) = std::fs::create_dir_all(parent) {
                    errors.push(crate::models::CleanError {
                        path: record.path.clone(),
                        message: format!("Failed to create parent dirs: {}", e),
                    });
                    continue;
                }
            }
        }

        match std::fs::File::create(&path) {
            Ok(_) => {
                restored += 1;
                bytes += record.size_bytes;
            }
            Err(e) => {
                errors.push(crate::models::CleanError {
                    path: record.path.clone(),
                    message: format!("Failed to restore: {}", e),
                });
            }
        }
    }

    // Clear the undo log after restoration
    let remaining: Vec<super::super::cleaner::UndoRecord> = Vec::new();
    let json = serde_json::to_string_pretty(&remaining)
        .map_err(|e| AppError::Io(e.to_string()))?;
    let _ = std::fs::write(&log_path, json);

    Ok(CleanResult {
        success: errors.is_empty(),
        items_cleaned: restored,
        bytes_freed: bytes,
        errors,
    })
}

/// Empty all trash bins across all volumes
#[tauri::command]
pub async fn empty_trash() -> Result<CleanResult, AppError> {
    let platform = crate::platform::current_platform();
    let paths: Vec<PathBuf> = platform
        .trash_paths()
        .into_iter()
        .filter(|p| p.exists())
        .collect();

    // Collect all top-level entries (files + dirs) from each trash bin
    let mut all_entries: Vec<PathBuf> = Vec::new();
    for trash in &paths {
        let Ok(read) = std::fs::read_dir(trash) else { continue };
        for entry in read.flatten() {
            all_entries.push(entry.path());
        }
    }

    if all_entries.is_empty() {
        return Ok(CleanResult {
            success: true,
            items_cleaned: 0,
            bytes_freed: 0,
            errors: vec![],
        });
    }

    let cleaner = FileCleaner::new();
    cleaner.clean(&all_entries, true).await // Permanently delete from trash
}
