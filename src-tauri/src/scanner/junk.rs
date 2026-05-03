use async_trait::async_trait;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
use crate::commands::scan::ScanState;
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item, walk_collect};

pub struct JunkScanner;

#[async_trait]
impl Scanner for JunkScanner {
    fn category(&self) -> ScanCategory {
        ScanCategory::SystemJunk
    }

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        _opts: &ScanOptions,
        app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        // Pre-fetch owned data from platform (needed before spawn_blocking)
        let cache_dirs: Vec<PathBuf> = platform.cache_dirs();
        let log_dirs: Vec<PathBuf> = platform.log_dirs();
        let temp_dirs: Vec<PathBuf> = platform.temp_dirs();
        let cancelled = app.state::<ScanState>().cancelled.clone();

        tokio::task::spawn_blocking(move || {
            if cancelled.load(Ordering::Relaxed) {
                return Ok(Vec::new());
            }

            let mut items = Vec::new();

            scan_caches(&cache_dirs, &mut items);
            if cancelled.load(Ordering::Relaxed) { return Ok(items); }

            scan_logs(&log_dirs, &mut items);
            if cancelled.load(Ordering::Relaxed) { return Ok(items); }

            scan_temp(&temp_dirs, &mut items);

            #[cfg(target_os = "macos")]
            {
                if cancelled.load(Ordering::Relaxed) { return Ok(items); }
                scan_language_packs(&mut items);
                if cancelled.load(Ordering::Relaxed) { return Ok(items); }
                scan_broken_plists(&mut items);
                if cancelled.load(Ordering::Relaxed) { return Ok(items); }
                scan_ios_backups(&mut items);
                if cancelled.load(Ordering::Relaxed) { return Ok(items); }
                scan_xcode_data(&mut items);
            }

            Ok(items)
        })
        .await
        .map_err(|e| AppError::Io(format!("Junk scan panicked: {}", e)))?
    }
}

fn scan_caches(dirs: &[PathBuf], items: &mut Vec<ScanItem>) {
    for dir in dirs {
        if !dir.exists() { continue; }
        for file in walk_collect(dir) {
            let item = make_item(&file, ScanCategory::SystemJunk, "caches");
            if item.size_bytes > 0 {
                items.push(item);
            }
        }
    }
}

fn scan_logs(dirs: &[PathBuf], items: &mut Vec<ScanItem>) {
    for dir in dirs {
        if !dir.exists() { continue; }
        for file in walk_collect(dir) {
            let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("");
            if matches!(ext, "log" | "crash" | "asl" | "gz" | "bz2" | "txt") {
                let item = make_item(&file, ScanCategory::SystemJunk, "logs");
                if item.size_bytes > 0 {
                    items.push(item);
                }
            }
        }
    }
}

fn scan_temp(dirs: &[PathBuf], items: &mut Vec<ScanItem>) {
    for dir in dirs {
        if !dir.exists() { continue; }
        for entry in walkdir::WalkDir::new(dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let item = make_item(entry.path(), ScanCategory::SystemJunk, "temp");
            if item.size_bytes > 0 {
                items.push(item);
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn scan_broken_plists(items: &mut Vec<ScanItem>) {
    let plist_dirs = vec![
        dirs::home_dir().map(|h| h.join("Library/Preferences")),
        dirs::home_dir().map(|h| h.join("Library/Containers")),
    ];
    for dir in plist_dirs.into_iter().flatten() {
        if !dir.exists() { continue; }
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("plist") { continue; }
            let data = match std::fs::read(&path) {
                Ok(d) => d,
                Err(_) => continue,
            };
            if plist::from_bytes::<plist::Dictionary>(&data).is_err() {
                let meta = std::fs::metadata(&path).ok();
                let size = meta.map(|m| m.len()).unwrap_or(0);
                if size > 0 {
                    items.push(ScanItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string(),
                        path: path.to_string_lossy().to_string(),
                        category: ScanCategory::SystemJunk,
                        size_bytes: size,
                        last_modified: None,
                        last_accessed: None,
                        group_id: None,
                        safe: true,
                        description: "broken_plist".into(),
                    });
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn scan_ios_backups(items: &mut Vec<ScanItem>) {
    if let Some(home) = dirs::home_dir() {
        let backup_dir = home.join("Library/Application Support/MobileSync/Backup");
        if backup_dir.exists() {
            let size: u64 = walkdir::WalkDir::new(&backup_dir)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum();
            if size > 0 {
                items.push(ScanItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "iOS Backups".into(),
                    path: backup_dir.to_string_lossy().to_string(),
                    category: ScanCategory::SystemJunk,
                    size_bytes: size,
                    last_modified: None,
                    last_accessed: None,
                    group_id: None,
                    safe: true,
                    description: "ios_backups".into(),
                });
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn scan_xcode_data(items: &mut Vec<ScanItem>) {
    if let Some(home) = dirs::home_dir() {
        // DerivedData
        let derived = home.join("Library/Developer/Xcode/DerivedData");
        if derived.exists() {
            let size: u64 = walkdir::WalkDir::new(&derived)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum();
            if size > 0 {
                items.push(ScanItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "Xcode DerivedData".into(),
                    path: derived.to_string_lossy().to_string(),
                    category: ScanCategory::SystemJunk,
                    size_bytes: size,
                    last_modified: None,
                    last_accessed: None,
                    group_id: None,
                    safe: true,
                    description: "xcode_derived_data".into(),
                });
            }
        }
        // Simulator caches
        let sim_caches = home.join("Library/Developer/CoreSimulator/Caches");
        if sim_caches.exists() {
            let size: u64 = walkdir::WalkDir::new(&sim_caches)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum();
            if size > 0 {
                items.push(ScanItem {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: "Simulator Caches".into(),
                    path: sim_caches.to_string_lossy().to_string(),
                    category: ScanCategory::SystemJunk,
                    size_bytes: size,
                    last_modified: None,
                    last_accessed: None,
                    group_id: None,
                    safe: true,
                    description: "xcode_simulator_caches".into(),
                });
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn scan_language_packs(items: &mut Vec<ScanItem>) {
    use std::path::PathBuf;

    let keep_langs = ["en", "en_US", "en_GB", "Base"];

    let app_dirs = vec![
        PathBuf::from("/Applications"),
        dirs::home_dir().map(|h| h.join("Applications")).unwrap_or_default(),
    ];

    for app_dir in app_dirs {
        if !app_dir.exists() { continue; }
        let Ok(apps) = std::fs::read_dir(&app_dir) else { continue };

        for app_entry in apps.flatten().take(50) {
            let resources = app_entry.path().join("Contents/Resources");
            if !resources.exists() { continue; }
            let Ok(res_entries) = std::fs::read_dir(&resources) else { continue };

            for entry in res_entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("lproj") {
                    let lang = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    if !keep_langs.iter().any(|&k| lang.starts_with(k)) {
                        let size: u64 = walkdir::WalkDir::new(&path)
                            .into_iter()
                            .filter_map(|e| e.ok())
                            .filter(|e| e.file_type().is_file())
                            .filter_map(|e| e.metadata().ok())
                            .map(|m| m.len())
                            .sum();

                        if size > 0 {
                            items.push(ScanItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                name: path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("unknown")
                                    .to_string(),
                                path: path.to_string_lossy().to_string(),
                                category: ScanCategory::SystemJunk,
                                size_bytes: size,
                                last_modified: None,
                                last_accessed: None,
                                group_id: None,
                                safe: true,
                                description: "lang_packs".into(),
                            });
                        }
                    }
                }
            }
        }
    }
}
