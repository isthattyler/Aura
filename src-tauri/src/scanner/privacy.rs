use async_trait::async_trait;
use std::path::PathBuf;
use tauri::AppHandle;
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item, walk_collect};

pub struct PrivacyScanner;

#[async_trait]
impl Scanner for PrivacyScanner {
    fn category(&self) -> ScanCategory {
        ScanCategory::Privacy
    }

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        _opts: &ScanOptions,
        _app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let mut items = Vec::new();

        for (browser, profile_dir) in platform.browser_profile_dirs() {
            items.extend(scan_browser(&browser, &profile_dir));
        }

        for path in platform.recent_docs_paths() {
            items.extend(scan_recent_docs(&path));
        }

        Ok(items)
    }
}

/// Scan a browser's profile directory for privacy artifacts
fn scan_browser(browser: &str, profile_dir: &PathBuf) -> Vec<ScanItem> {
    let mut items = Vec::new();

    // Patterns: (subdirectory/file name fragments, artifact type description)
    let patterns: &[(&str, &str)] = &[
        ("Cache",       "cache"),
        ("cache",       "cache"),
        ("CachedData",  "cache"),
        ("History",     "history"),
        ("Cookies",     "cookies"),
        ("Downloads",   "downloads"),
        ("sessions",    "sessions"),
        ("Session Storage", "sessions"),
    ];

    // Walk up to 4 levels (profiles can be nested in Default/, Profile 1/, etc.)
    for entry in walkdir::WalkDir::new(profile_dir)
        .max_depth(4)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        for (pattern, artifact_type) in patterns {
            if name.contains(pattern) {
                if entry.file_type().is_file() {
                    let mut item = make_item(path, ScanCategory::Privacy, *artifact_type);
                    item.description = format!("{} {}", browser, artifact_type);
                    item.safe = true;
                    if item.size_bytes > 0 {
                        items.push(item);
                        break;
                    }
                } else if entry.file_type().is_dir() && entry.depth() > 0 {
                    // Collect entire directory as one item
                    let size: u64 = walk_collect(path)
                        .iter()
                        .filter_map(|p| std::fs::metadata(p).ok())
                        .map(|m| m.len())
                        .sum();

                    if size > 0 {
                        items.push(ScanItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                            category: ScanCategory::Privacy,
                            size_bytes: size,
                            last_modified: None,
                            last_accessed: None,
                            group_id: None,
                            safe: true,
                            description: format!("{} {}", browser, artifact_type),
                        });
                        break;
                    }
                }
            }
        }
    }

    items
}

fn scan_recent_docs(path: &PathBuf) -> Vec<ScanItem> {
    let mut items = Vec::new();
    if !path.exists() { return items; }

    if path.is_file() {
        let meta = std::fs::metadata(path).ok();
        let size = meta.map(|m| m.len()).unwrap_or(0);
        if size > 0 {
            items.push(ScanItem {
                id: uuid::Uuid::new_v4().to_string(),
                name: path.file_name().and_then(|n| n.to_str()).unwrap_or("recent_docs").to_string(),
                path: path.to_string_lossy().to_string(),
                category: ScanCategory::Privacy,
                size_bytes: size,
                last_modified: None,
                last_accessed: None,
                group_id: None,
                safe: true,
                description: "recent_documents".into(),
            });
        }
    } else if path.is_dir() {
        let size: u64 = walk_collect(path)
            .iter()
            .filter_map(|p| std::fs::metadata(p).ok())
            .map(|m| m.len())
            .sum();
        if size > 0 {
            items.push(ScanItem {
                id: uuid::Uuid::new_v4().to_string(),
                name: path.file_name().and_then(|n| n.to_str()).unwrap_or("recent_docs").to_string(),
                path: path.to_string_lossy().to_string(),
                category: ScanCategory::Privacy,
                size_bytes: size,
                last_modified: None,
                last_accessed: None,
                group_id: None,
                safe: true,
                description: "recent_documents".into(),
            });
        }
    }

    items
}
