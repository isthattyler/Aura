use async_trait::async_trait;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
use xxhash_rust::xxh3::Xxh3;
use rayon::prelude::*;
use crate::commands::scan::ScanState;
use crate::error::AppError;
use crate::models::{ScanCategory, ScanItem, ScanOptions};
use crate::platform::PlatformPaths;
use super::{Scanner, make_item};

const CANCEL_CHECK_INTERVAL: u64 = 2000;
const MIN_FILE_SIZE: u64 = 64 * 1024; // Skip files smaller than 64 KB

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
        app: &AppHandle,
    ) -> Result<Vec<ScanItem>, AppError> {
        let Some(home) = platform.home_dir() else {
            return Err(AppError::NotFound("Home directory not found".into()));
        };

        let protected = platform.protected_paths();
        let cancelled = app.state::<ScanState>().cancelled.clone();

        // ── Step 1: Walk home directory, group files by size ──
        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        let mut file_count: u64 = 0;

        for entry in walkdir::WalkDir::new(&home)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if file_count % CANCEL_CHECK_INTERVAL == 0
                && cancelled.load(Ordering::Relaxed)
            {
                return Ok(Vec::new());
            }
            file_count += 1;

            let path = entry.path().to_path_buf();
            if protected.iter().any(|p| path.starts_with(p)) {
                continue;
            }

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size < MIN_FILE_SIZE {
                continue;
            }

            by_size.entry(size).or_default().push(path);
        }

        if cancelled.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }

        // ── Step 2: Collect all paths from size groups with more than one entry ──
        let mut to_hash: Vec<PathBuf> = Vec::new();
        for paths in by_size.values() {
            if paths.len() > 1 {
                to_hash.extend(paths.iter().cloned());
            }
        }

        if to_hash.is_empty() || cancelled.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }

        // ── Step 3: Hash all candidates in parallel via rayon + spawn_blocking ──
        let cancelled2 = cancelled.clone();

        let hash_results: Vec<(PathBuf, u64)> =
            tokio::task::spawn_blocking(move || {
                to_hash
                    .par_iter()
                    .filter_map(|path| {
                        if cancelled2.load(Ordering::Relaxed) {
                            return None;
                        }
                        hash_file(path).ok().map(|h| (path.clone(), h))
                    })
                    .collect()
            })
            .await
            .map_err(|e| AppError::Io(format!("Hashing task panicked: {}", e)))?;

        if cancelled.load(Ordering::Relaxed) {
            return Ok(Vec::new());
        }

        // ── Step 4: Group by hash, skip singletons ──
        let mut by_hash: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        for (path, hash) in hash_results {
            by_hash.entry(hash).or_default().push(path);
        }

        // ── Step 5: Build ScanItems — keep newest, flag duplicates as safe to delete ──
        let mut items = Vec::new();

        for (hash, mut paths) in by_hash {
            if paths.len() < 2 {
                continue;
            }

            paths.sort_by(|a, b| {
                let mt_a = std::fs::metadata(a)
                    .and_then(|m| m.modified())
                    .ok();
                let mt_b = std::fs::metadata(b)
                    .and_then(|m| m.modified())
                    .ok();
                mt_b.cmp(&mt_a) // newest first
            });

            let group_id = format!("{:016x}", hash);

            for (i, path) in paths.iter().enumerate() {
                let mut item = make_item(path, ScanCategory::Duplicates, "duplicate");
                item.group_id = Some(group_id.clone());
                item.safe = i > 0; // first (newest) is the keeper
                items.push(item);
            }
        }

        // Sort by group so duplicates appear together in the UI
        items.sort_by(|a, b| a.group_id.cmp(&b.group_id));

        Ok(items)
    }
}

fn hash_file(path: &std::path::Path) -> Result<u64, std::io::Error> {
    use std::io::Read;

    let mut file = std::fs::File::open(path)?;
    let mut hasher = Xxh3::new();
    let mut buffer = [0u8; 65536];

    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(hasher.digest())
}
