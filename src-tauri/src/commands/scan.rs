use std::sync::{Mutex, Arc, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter, Manager, State};
use crate::error::AppError;
use crate::models::{ScanOptions, ScanResults, ScanItem, ScanCategory, QuickCleanResult};
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

/// Inner function that runs a scan — callable both from Tauri commands
/// and from menubar handlers (which can't use `State` extractor).
pub async fn run_scan(
    app: &AppHandle,
    options: &ScanOptions,
    cancelled: Arc<AtomicBool>,
) -> Result<ScanResults, AppError> {
    cancelled.store(false, Ordering::SeqCst);

    let orchestrator = ScanOrchestrator::new();
    let results = orchestrator.run(options, app, cancelled).await?;

    // Cache results
    if let Ok(mut lock) = app.state::<ScanState>().results.lock() {
        *lock = Some(results.clone());
    }

    // Signal completion
    let _ = app.emit("scan_complete", ());

    Ok(results)
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
    run_scan(&app, &options, state.cancelled.clone()).await
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

/// Scan SystemJunk + Trash + Privacy, then clean all found items.
/// Shared between menubar handler and the in-app Quick Clean command.
pub async fn run_quick_clean(
    app: &AppHandle,
) -> Result<(ScanResults, usize, u64), AppError> {
    let opts = ScanOptions {
        categories: vec![
            ScanCategory::SystemJunk,
            ScanCategory::Trash,
            ScanCategory::Privacy,
        ],
        ..Default::default()
    };

    let cancelled = app.state::<ScanState>().cancelled.clone();
    let orchestrator = ScanOrchestrator::new();
    let scan_results = orchestrator.run(&opts, app, cancelled).await?;

    let item_ids: Vec<String> = scan_results.items.iter().map(|i| i.id.clone()).collect();
    let total_items = item_ids.len();
    let total_bytes = scan_results.total_bytes;

    if total_items > 0 {
        let _ = app.emit("quick_clean_status", serde_json::json!({
            "phase": "cleaning",
        }));

        let paths = crate::commands::clean::resolve_paths(&scan_results, &item_ids);
        let cleaner = crate::cleaner::FileCleaner::new();
        let _ = cleaner.clean(&paths, false).await?;
    }

    let _ = app.emit("scan_complete", ());

    Ok((scan_results, total_items, total_bytes))
}

/// Tauri command — called from frontend Quick Clean button.
#[tauri::command]
pub async fn quick_clean(app: AppHandle) -> Result<QuickCleanResult, AppError> {
    let (scan_results, items_cleaned, bytes_cleaned) = run_quick_clean(&app).await?;
    Ok(QuickCleanResult {
        items_cleaned,
        bytes_cleaned,
        scan_results,
    })
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
