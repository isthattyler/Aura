use async_trait::async_trait;
use std::time::{SystemTime, Duration};
use tauri::AppHandle;
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item};

pub struct LargeFileScanner;

#[async_trait]
impl Scanner for LargeFileScanner {
    fn category(&self) -> ScanCategory {
        ScanCategory::LargeFiles
    }

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        opts: &ScanOptions,
        _app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let size_threshold = opts.large_file_size_threshold_mb.unwrap_or(50) * 1024 * 1024;
        let age_threshold_days = opts.large_file_age_threshold_days.unwrap_or(365);
        let age_threshold = Duration::from_secs(age_threshold_days * 86400);
        let now = SystemTime::now();

        let Some(home) = platform.home_dir() else {
            return Err(AppError::NotFound("Home directory not found".into()));
        };

        let protected = platform.protected_paths();
        let mut items = Vec::new();

        // Walk home directory
        let walker = walkdir::WalkDir::new(&home)
            .follow_links(false)
            .into_iter();

        for entry in walker.filter_map(|e| e.ok()) {
            let path = entry.path();

            // Skip protected paths
            if protected.iter().any(|p| path.starts_with(p)) {
                continue;
            }

            if !entry.file_type().is_file() { continue; }

            let Ok(meta) = entry.metadata() else { continue };
            let size = meta.len();

            // Must exceed size threshold
            if size < size_threshold { continue; }

            // Optionally filter by last access time
            let last_accessed = meta.accessed().ok();
            let is_old = last_accessed.map(|t| {
                now.duration_since(t)
                    .map(|d| d >= age_threshold)
                    .unwrap_or(false)
            }).unwrap_or(false);

            // Include if large OR (large AND old) — use "large" tag for all, "old" for aged ones
            let desc = if is_old { "large_old" } else { "large" };
            let mut item = make_item(path, ScanCategory::LargeFiles, desc);
            item.safe = is_old; // Mark old files as safe, recently-used ones as unsafe

            items.push(item);
        }

        // Sort by size descending
        items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

        // Cap at 500 results
        items.truncate(500);

        Ok(items)
    }
}
