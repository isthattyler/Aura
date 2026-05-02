use async_trait::async_trait;
use tauri::AppHandle;
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item, walk_collect};

pub struct TrashScanner;

#[async_trait]
impl Scanner for TrashScanner {
    fn category(&self) -> ScanCategory {
        ScanCategory::Trash
    }

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        _opts: &ScanOptions,
        _app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let mut items = Vec::new();

        for trash_path in platform.trash_paths() {
            if !trash_path.exists() {
                log::debug!("Trash path does not exist: {:?}", trash_path);
                continue;
            }

            let files = walk_collect(&trash_path);
            log::debug!("Trash path {:?}: found {} files", trash_path, files.len());

            for file in files {
                let mut item = make_item(&file, ScanCategory::Trash, "trash");
                item.safe = true;
                items.push(item);
            }
        }

        #[cfg(target_os = "macos")]
        {
            items.extend(scan_volume_trash());
        }

        #[cfg(target_os = "linux")]
        {
            items.extend(scan_linux_volume_trash());
        }

        Ok(items)
    }
}

#[cfg(target_os = "macos")]
fn scan_volume_trash() -> Vec<ScanItem> {
    use std::path::PathBuf;
    use super::walk_collect;

    let mut items = Vec::new();
    let volumes_dir = PathBuf::from("/Volumes");
    let Ok(volumes) = std::fs::read_dir(&volumes_dir) else { return items };

    let uid = unsafe { libc::getuid() };

    for vol in volumes.flatten() {
        // .Trashes/<uid>/ on each volume
        let trash = vol.path().join(".Trashes").join(uid.to_string());
        if !trash.exists() { continue; }

        for file in walk_collect(&trash) {
            let mut item = make_item(&file, ScanCategory::Trash, "trash");
            item.safe = true;
            items.push(item);
        }
    }

    items
}

#[cfg(target_os = "linux")]
fn scan_linux_volume_trash() -> Vec<ScanItem> {
    let mut items = Vec::new();
    let uid = unsafe { libc::getuid() };
    let mut seen = std::collections::HashSet::new();

    if let Ok(mounts) = std::fs::read_to_string("/proc/mounts") {
        for line in mounts.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 { continue; }
            let mount_point = parts[1];
            if mount_point == "/" || mount_point.starts_with("/dev") || mount_point == "none" {
                continue;
            }
            let trash = PathBuf::from(mount_point).join(format!(".Trash-{}", uid));
            if trash.exists() && seen.insert(trash.clone()) {
                for file in walk_collect(&trash) {
                    let mut item = make_item(&file, ScanCategory::Trash, "trash");
                    item.safe = true;
                    items.push(item);
                }
            }
        }
    }

    items
}
