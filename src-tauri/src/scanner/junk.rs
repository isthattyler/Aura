use async_trait::async_trait;
use tauri::AppHandle;
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
        _app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let mut items = Vec::new();

        items.extend(scan_caches(platform));
        items.extend(scan_logs(platform));
        items.extend(scan_temp(platform));

        #[cfg(target_os = "macos")]
        {
            items.extend(scan_language_packs());
            items.extend(scan_broken_plists());
            items.extend(scan_ios_backups());
            items.extend(scan_xcode_data());
        }

        Ok(items)
    }
}

fn scan_caches(platform: &dyn PlatformPaths) -> Vec<ScanItem> {
    let mut items = Vec::new();
    for dir in platform.cache_dirs() {
        if !dir.exists() { continue; }
        for file in walk_collect(&dir) {
            let item = make_item(&file, ScanCategory::SystemJunk, "caches");
            if item.size_bytes > 0 {
                items.push(item);
            }
        }
    }
    items
}

fn scan_logs(platform: &dyn PlatformPaths) -> Vec<ScanItem> {
    let mut items = Vec::new();
    for dir in platform.log_dirs() {
        if !dir.exists() { continue; }
        for file in walk_collect(&dir) {
            let ext = file.extension().and_then(|e| e.to_str()).unwrap_or("");
            if matches!(ext, "log" | "crash" | "asl" | "gz" | "bz2" | "txt") {
                let item = make_item(&file, ScanCategory::SystemJunk, "logs");
                if item.size_bytes > 0 {
                    items.push(item);
                }
            }
        }
    }
    items
}

fn scan_temp(platform: &dyn PlatformPaths) -> Vec<ScanItem> {
    let mut items = Vec::new();
    for dir in platform.temp_dirs() {
        if !dir.exists() { continue; }
        for entry in walkdir::WalkDir::new(&dir)
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
    items
}

#[cfg(target_os = "macos")]
fn scan_broken_plists() -> Vec<ScanItem> {
    let mut items = Vec::new();
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
    items
}

#[cfg(target_os = "macos")]
fn scan_ios_backups() -> Vec<ScanItem> {
    let mut items = Vec::new();
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
    items
}

#[cfg(target_os = "macos")]
fn scan_xcode_data() -> Vec<ScanItem> {
    let mut items = Vec::new();
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
    items
}

#[cfg(target_os = "macos")]
fn scan_language_packs() -> Vec<ScanItem> {
    use std::path::PathBuf;

    let mut items = Vec::new();
    // Get system language (simplified: assume English)
    let keep_langs = ["en", "en_US", "en_GB", "Base"];

    let app_dirs = vec![
        PathBuf::from("/Applications"),
        dirs::home_dir().map(|h| h.join("Applications")).unwrap_or_default(),
    ];

    for app_dir in app_dirs {
        if !app_dir.exists() { continue; }
        let Ok(apps) = std::fs::read_dir(&app_dir) else { continue };

        for app_entry in apps.flatten().take(50) { // limit to 50 apps
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
                        // Count size of this lproj dir
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

    items
}
