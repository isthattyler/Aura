use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use async_trait::async_trait;
use futures::future::join_all;
use tauri::{AppHandle, Emitter};
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions, ScanProgress, ScanPhase, ScanResults, CategoryResult};
use crate::platform::{PlatformPaths, current_platform};

pub mod junk;
pub mod trash;
pub mod large_files;
pub mod duplicates;
pub mod privacy;

// ─────────────────────────────────────────
// Scanner Trait
// ─────────────────────────────────────────

#[async_trait]
pub trait Scanner: Send + Sync {
    fn category(&self) -> ScanCategory;

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        opts: &ScanOptions,
        app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError>;
}

// ─────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────

pub struct ScanOrchestrator {
    scanners: Vec<Box<dyn Scanner>>,
}

impl ScanOrchestrator {
    pub fn new() -> Self {
        Self {
            scanners: vec![
                Box::new(junk::JunkScanner),
                Box::new(trash::TrashScanner),
                Box::new(large_files::LargeFileScanner),
                Box::new(duplicates::DuplicateScanner),
                Box::new(privacy::PrivacyScanner),
            ],
        }
    }

    pub async fn run(
        &self,
        opts: &ScanOptions,
        app: &AppHandle,
        cancelled: Arc<AtomicBool>,
    ) -> Result<ScanResults, AppError> {
        let platform: Arc<dyn PlatformPaths> = current_platform().into();
        let categories = opts.categories.clone();
        let mut all_items: Vec<ScanItem> = Vec::new();

        // Emit scanning events for all requested categories
        for scanner in &self.scanners {
            let cat = scanner.category();
            if categories.contains(&cat) {
                let _ = app.emit(
                    "scan_progress",
                    ScanProgress {
                        category: cat.clone(),
                        phase: ScanPhase::Scanning,
                        items_found: 0,
                        bytes_found: 0,
                        current_path: None,
                    },
                );
            }
        }

        // Run all requested scanners concurrently via join_all
        let futures: Vec<_> = self
            .scanners
            .iter()
            .filter(|s| categories.contains(&s.category()))
            .map(|scanner| {
                let cat = scanner.category();
                let scan_opts = opts.clone();
                let platform = Arc::clone(&platform);
                let app = app.clone();
                let cancelled = Arc::clone(&cancelled);
                async move {
                    if cancelled.load(Ordering::Relaxed) {
                        return (cat, Ok(Vec::new()));
                    }
                    let result = scanner.scan(platform.as_ref(), &scan_opts, &app).await;
                    (cat, result)
                }
            })
            .collect();

        for (cat, result) in join_all(futures).await {
            match result {
                Ok(items) => {
                    let bytes: u64 = items.iter().map(|i| i.size_bytes).sum();
                    let _ = app.emit(
                        "scan_progress",
                        ScanProgress {
                            category: cat.clone(),
                            phase: ScanPhase::Complete,
                            items_found: items.len(),
                            bytes_found: bytes,
                            current_path: None,
                        },
                    );
                    all_items.extend(items);
                }
                Err(AppError::Permission(_)) => {
                    log::warn!("Permission denied scanning {:?}", cat);
                    let _ = app.emit(
                        "scan_progress",
                        ScanProgress {
                            category: cat,
                            phase: ScanPhase::Complete,
                            items_found: 0,
                            bytes_found: 0,
                            current_path: None,
                        },
                    );
                }
                Err(e) => {
                    log::error!("Scanner {:?} failed: {}", cat, e);
                    let _ = app.emit(
                        "scan_progress",
                        ScanProgress {
                            category: cat,
                            phase: ScanPhase::Complete,
                            items_found: 0,
                            bytes_found: 0,
                            current_path: None,
                        },
                    );
                }
            }
        }

        // Build per-category summary
        let mut by_category = std::collections::HashMap::new();
        for item in &all_items {
            let key = serde_json::to_string(&item.category)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string();
            let entry = by_category
                .entry(key)
                .or_insert(CategoryResult::default());
            entry.item_count += 1;
            entry.total_bytes += item.size_bytes;
        }

        let total_bytes = all_items.iter().map(|i| i.size_bytes).sum();

        Ok(ScanResults {
            completed_at: chrono::Utc::now().to_rfc3339(),
            total_bytes,
            by_category,
            items: all_items,
        })
    }
}

// ─────────────────────────────────────────
// Shared scan helpers
// ─────────────────────────────────────────

/// Walk a directory and collect all files, logging permission errors.
/// Only returns files (not directories) — use `collect_trash_entries` for trash scanning.
pub fn walk_collect(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut results = Vec::new();
    for entry in walkdir::WalkDir::new(root).follow_links(false) {
        match entry {
            Ok(e) if e.file_type().is_file() => {
                results.push(e.into_path());
            }
            Ok(_) => {}
            Err(err) => {
                log::warn!("walk_collect: skipped {}: {}", err.path().unwrap_or(root).display(), err);
            }
        }
    }
    results
}

/// Get file size, returns 0 on error
pub fn file_size(path: &std::path::Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

/// Calculate the total size of a file or directory.
/// For files, returns the file size. For directories, recursively sums all file sizes.
pub fn total_size(path: &std::path::Path) -> u64 {
    if path.is_dir() {
        walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter_map(|e| e.metadata().ok())
            .map(|m| m.len())
            .sum()
    } else {
        std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
    }
}

/// Collect top-level trash entries (both files and directories) with their total sizes.
/// Returns pairs of (path, total_size_in_bytes).
pub fn collect_trash_entries(root: &std::path::Path) -> Vec<(std::path::PathBuf, u64)> {
    let mut entries = Vec::new();
    let Ok(read) = std::fs::read_dir(root) else { return entries };
    for entry in read.flatten() {
        let path = entry.path();
        let size = total_size(&path);
        entries.push((path, size));
    }
    entries
}

/// Format a path for display, replacing home dir with ~
pub fn display_path(path: &std::path::Path) -> String {
    if let Some(home) = dirs::home_dir() {
        if let Ok(rel) = path.strip_prefix(&home) {
            return format!("~/{}", rel.display());
        }
    }
    path.to_string_lossy().to_string()
}

/// Create a ScanItem from a path and metadata
pub fn make_item(
    path: &std::path::Path,
    category: ScanCategory,
    description: impl Into<String>,
) -> ScanItem {
    let meta = std::fs::metadata(path);
    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);

    let last_modified = meta.as_ref().ok().and_then(|m| {
        m.modified().ok().map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t)
                .to_rfc3339()
        })
    });

    let last_accessed = meta.as_ref().ok().and_then(|m| {
        m.accessed().ok().map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t)
                .to_rfc3339()
        })
    });

    ScanItem {
        id: uuid::Uuid::new_v4().to_string(),
        name: path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string(),
        path: display_path(path),
        category,
        size_bytes: size,
        last_modified,
        last_accessed,
        group_id: None,
        safe: true,
        description: description.into(),
    }
}
