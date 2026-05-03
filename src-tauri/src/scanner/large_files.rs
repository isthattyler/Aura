use async_trait::async_trait;
use std::sync::atomic::Ordering;
use std::time::{SystemTime, Duration};
use tauri::{AppHandle, Manager};
use crate::commands::scan::ScanState;
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
        app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let Some(home) = platform.home_dir() else {
            return Err(AppError::NotFound("Home directory not found".into()));
        };

        let size_threshold = opts.large_file_size_threshold_mb.unwrap_or(50) * 1024 * 1024;
        let age_threshold_days = opts.large_file_age_threshold_days.unwrap_or(365);
        let protected = platform.protected_paths();
        let cancelled = app.state::<ScanState>().cancelled.clone();

        tokio::task::spawn_blocking(move || {
            let age_threshold = Duration::from_secs(age_threshold_days * 86400);
            let now = SystemTime::now();
            let mut items = Vec::new();
            let mut file_count: u64 = 0;

            let walker = walkdir::WalkDir::new(&home)
                .follow_links(false)
                .into_iter();

            for entry in walker.filter_map(|e| e.ok()) {
                if file_count % 2000 == 0 && cancelled.load(Ordering::Relaxed) {
                    break;
                }
                file_count += 1;

                let path = entry.path();

                if protected.iter().any(|p| path.starts_with(p)) {
                    continue;
                }

                if !entry.file_type().is_file() {
                    continue;
                }

                let Ok(meta) = entry.metadata() else { continue };
                let size = meta.len();

                if size < size_threshold {
                    continue;
                }

                let last_accessed = meta.accessed().ok();
                let is_old = last_accessed
                    .map(|t| {
                        now.duration_since(t)
                            .map(|d| d >= age_threshold)
                            .unwrap_or(false)
                    })
                    .unwrap_or(false);

                let desc = if is_old { "large_old" } else { "large" };
                let mut item = make_item(path, ScanCategory::LargeFiles, desc);
                item.safe = is_old;

                items.push(item);
            }

            // Sort by size descending, cap at 500
            items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
            items.truncate(500);

            Ok(items)
        })
        .await
        .map_err(|e| AppError::Io(format!("Large file scan panicked: {}", e)))?
    }
}
