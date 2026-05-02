use async_trait::async_trait;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;
use sha2::{Sha256, Digest};
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item};

pub struct DuplicateScanner;

#[async_trait]
impl Scanner for DuplicateScanner {
    fn category(&self) -> ScanCategory {
        ScanCategory::Duplicates
    }

    async fn scan(
        &self,
        platform: &dyn PlatformPaths,
        _opts: &ScanOptions,
        _app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let Some(home) = platform.home_dir() else {
            return Err(AppError::NotFound("Home directory not found".into()));
        };

        let protected = platform.protected_paths();
        let min_size: u64 = 64 * 1024; // Ignore files < 64 KB

        // Step 1: Collect all candidate files grouped by size
        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();

        for entry in walkdir::WalkDir::new(&home)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let path = entry.path().to_path_buf();
            if protected.iter().any(|p| path.starts_with(p)) { continue; }

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size < min_size { continue; }

            by_size.entry(size).or_default().push(path);
        }

        // Step 2: For size groups with >1 file, hash them
        let mut by_hash: HashMap<String, Vec<PathBuf>> = HashMap::new();

        for (_, paths) in by_size.into_iter().filter(|(_, v)| v.len() > 1) {
            for path in paths {
                match hash_file(&path) {
                    Ok(hash) => { by_hash.entry(hash).or_default().push(path); }
                    Err(_) => { /* skip unreadable files */ }
                }
            }
        }

        // Step 3: Build ScanItems for all duplicates (keep newest, flag rest)
        let mut items = Vec::new();

        for (hash, mut paths) in by_hash.into_iter().filter(|(_, v)| v.len() > 1) {
            // Sort by modified time — keep the newest, mark rest as duplicates
            paths.sort_by(|a, b| {
                let mt_a = std::fs::metadata(a).and_then(|m| m.modified()).ok();
                let mt_b = std::fs::metadata(b).and_then(|m| m.modified()).ok();
                mt_b.cmp(&mt_a) // newest first
            });

            // First entry is "keep", rest are duplicates to remove
            for (i, path) in paths.iter().enumerate() {
                let mut item = make_item(path, ScanCategory::Duplicates, "duplicate");
                item.group_id = Some(hash.clone());
                item.safe = i > 0; // Only extras are safe to delete
                items.push(item);
            }
        }

        // Sort by group so duplicates appear together
        items.sort_by(|a, b| a.group_id.cmp(&b.group_id));

        Ok(items)
    }
}

fn hash_file(path: &std::path::Path) -> Result<String, std::io::Error> {
    use std::io::Read;

    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536]; // 64 KB chunks

    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }

    Ok(hex::encode(hasher.finalize()))
}
