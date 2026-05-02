use std::sync::{Mutex, Arc, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter, State};
use crate::error::AppError;
use crate::models::{ScanOptions, ScanResults, ScanItem, ScanCategory};
use crate::scanner::ScanOrchestrator;

/// Global scan results cache with cancellation support
pub struct ScanState {
    pub results: Mutex<Option<ScanResults>>,
    pub cancelled: Arc<AtomicBool>,
}

impl ScanState {
    pub fn new() -> Self {
        Self {
            results: Mutex::new(None),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// Start a full scan across requested categories.
/// Emits `scan_progress` events during scanning.
/// Returns the full ScanResults when complete.
#[tauri::command]
pub async fn start_scan(
    app: AppHandle,
    options: ScanOptions,
    state: State<'_, ScanState>,
) -> Result<ScanResults, AppError> {
    // Reset cancellation flag
    state.cancelled.store(false, Ordering::SeqCst);

    let orchestrator = ScanOrchestrator::new();
    let results = orchestrator.run(&options, &app, state.cancelled.clone()).await?;

    // Cache results
    if let Ok(mut lock) = state.results.lock() {
        *lock = Some(results.clone());
    }

    // Signal completion
    let _ = app.emit("scan_complete", ());

    Ok(results)
}

/// Scan a single category (used by individual feature pages)
#[tauri::command]
pub async fn scan_category(
    app: AppHandle,
    category: ScanCategory,
    state: State<'_, ScanState>,
) -> Result<Vec<ScanItem>, AppError> {
    let opts = ScanOptions {
        categories: vec![category],
        ..Default::default()
    };
    let results = start_scan(app, opts, state).await?;
    Ok(results.items)
}

/// Cancel a running scan
#[tauri::command]
pub fn cancel_scan(state: State<'_, ScanState>) {
    state.cancelled.store(true, Ordering::SeqCst);
}

/// Return cached scan results without re-scanning
#[tauri::command]
pub fn get_scan_results(state: State<'_, ScanState>) -> Option<ScanResults> {
    state.results.lock().ok()?.clone()
}

/// Clear the cached scan results
#[tauri::command]
pub fn clear_scan_results(state: State<'_, ScanState>) {
    if let Ok(mut lock) = state.results.lock() {
        *lock = None;
    }
}
