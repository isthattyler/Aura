use tauri::{AppHandle, Emitter};
use crate::error::AppError;
use crate::models::{ScanCategory, ScanOptions, ScanPhase, ScanProgress, ScanItem};
use crate::platform::current_platform;
use crate::scanner::Scanner;
use crate::scanner::privacy::PrivacyScanner;
use crate::cleaner::FileCleaner;

/// Scan for privacy artifacts (browser caches, history, cookies, sessions)
#[tauri::command]
pub async fn scan_privacy(app: AppHandle) -> Result<Vec<ScanItem>, AppError> {
    let platform = current_platform();
    let scanner = PrivacyScanner;

    let _ = app.emit(
        "scan_progress",
        ScanProgress {
            category: ScanCategory::Privacy,
            phase: ScanPhase::Scanning,
            items_found: 0,
            bytes_found: 0,
            current_path: None,
        },
    );

    let opts = ScanOptions::default();
    let items = scanner.scan(platform.as_ref(), &opts, &app).await?;

    let bytes: u64 = items.iter().map(|i| i.size_bytes).sum();

    let _ = app.emit(
        "scan_progress",
        ScanProgress {
            category: ScanCategory::Privacy,
            phase: ScanPhase::Complete,
            items_found: items.len(),
            bytes_found: bytes,
            current_path: None,
        },
    );

    Ok(items)
}

/// Remove selected privacy artifacts by their paths
#[tauri::command]
pub async fn clean_privacy(artifact_ids: Vec<String>, permanent: bool) -> Result<serde_json::Value, AppError> {
    if artifact_ids.is_empty() {
        return Ok(serde_json::json!({ "success": true, "itemsCleaned": 0, "bytesFreed": 0 }));
    }

    let cleaner = FileCleaner::new();
    let paths: Vec<std::path::PathBuf> = artifact_ids.iter().map(std::path::PathBuf::from).collect();

    let result = cleaner.clean(&paths, permanent).await?;

    Ok(serde_json::json!({
        "success": result.success,
        "itemsCleaned": result.items_cleaned,
        "bytesFreed": result.bytes_freed,
        "errors": result.errors,
    }))
}
