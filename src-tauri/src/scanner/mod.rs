use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use async_trait::async_trait;
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
        let platform = current_platform();
        let mut all_items: Vec<ScanItem> = Vec::new();

        for scanner in &self.scanners {
            if cancelled.load(Ordering::SeqCst) {
                break;
            }

            let category = scanner.category();

            // Skip if not requested
            if !opts.categories.contains(&category) {
                continue;
            }

            // Emit scanning start event
            let _ = app.emit(
                "scan_progress",
                ScanProgress {
                    category: category.clone(),
                    phase: ScanPhase::Scanning,
                    items_found: 0,
                    bytes_found: 0,
                    current_path: None,
                },
            );

            match scanner.scan(platform.as_ref(), opts, app).await {
                Ok(items) => {
                    let bytes: u64 = items.iter().map(|i| i.size_bytes).sum();
                    // Emit completion for this category
                    let _ = app.emit(
                        "scan_progress",
                        ScanProgress {
                            category: category.clone(),
                            phase: ScanPhase::Complete,
                            items_found: items.len(),
                            bytes_found: bytes,
                            current_path: None,
                        },
                    );
                    all_items.extend(items);
                }
                Err(AppError::Permission(_)) => {
                    // Silently skip permission-denied paths
                    log::warn!("Permission denied scanning {:?}", category);
                }
                Err(e) => {
                    log::error!("Scanner {:?} failed: {}", category, e);
                    // Continue scanning other categories
                }
            }
        }

        // Build per-category summary
        let mut by_category = std::collections::HashMap::new();
        for item in &all_items {
            let key = format!("{:?}", item.category).to_lowercase();
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

/// Walk a directory and collect all files, logging permission errors
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
