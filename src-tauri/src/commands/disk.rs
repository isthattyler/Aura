use std::collections::HashMap;
use std::path::PathBuf;
use sysinfo::Disks;
use crate::error::AppError;
use crate::models::{Volume, DiskNode};

/// Return all mounted volumes with usage info
#[tauri::command]
pub fn get_volumes() -> Result<Vec<Volume>, AppError> {
    let disks = Disks::new_with_refreshed_list();
    let volumes = disks
        .iter()
        .map(|d| {
            let total = d.total_space();
            let free = d.available_space();
            Volume {
                name: d.name().to_string_lossy().to_string(),
                mount_point: d.mount_point().to_string_lossy().to_string(),
                total_bytes: total,
                used_bytes: total - free,
                free_bytes: free,
                file_system: d.file_system().to_string_lossy().to_string(),
            }
        })
        .collect();
    Ok(volumes)
}

/// Return a recursive disk usage tree starting at `path`.
/// `depth` controls how deep to recurse (default: 2, max: 5).
/// Uses a single-pass O(n) walk to avoid hangs on large volumes.
#[tauri::command]
pub async fn get_disk_usage(path: String, depth: Option<u32>) -> Result<DiskNode, AppError> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", path)));
    }
    let max_depth = depth.unwrap_or(2).min(5);

    let result = tokio::task::spawn_blocking(move || build_tree_fast(root, max_depth))
        .await
        .map_err(|e| AppError::Io(format!("Disk walk failed: {}", e)))?;

    result
}

/// Build a disk usage tree using a single walkdir pass.
/// Accumulates directory sizes bottom-up via HashMap, then builds the tree to max_depth.
fn build_tree_fast(root: PathBuf, max_depth: u32) -> Result<DiskNode, AppError> {
    let mut dir_sizes: HashMap<PathBuf, u64> = HashMap::new();
    let mut file_children: HashMap<PathBuf, Vec<DiskNode>> = HashMap::new();
    let mut dir_children: HashMap<PathBuf, Vec<PathBuf>> = HashMap::new();
    let mut all_dirs: Vec<(PathBuf, usize)> = Vec::new();

    let walk_depth = (max_depth as usize).max(3) + 3;

    for entry in walkdir::WalkDir::new(&root)
        .follow_links(false)
        .max_depth(walk_depth)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path().to_path_buf();
        let is_dir = entry.file_type().is_dir();
        let size = if is_dir {
            0u64
        } else {
            entry.metadata().ok().map(|m| m.len()).unwrap_or(0)
        };
        let name = entry.file_name().to_string_lossy().to_string();

        if let Some(parent) = path.parent() {
            let parent_key = parent.to_path_buf();
            if is_dir {
                dir_children
                    .entry(parent_key)
                    .or_default()
                    .push(path.clone());
                all_dirs.push((path, entry.depth()));
            } else {
                let pk = parent_key.clone();
                file_children
                    .entry(parent_key)
                    .or_default()
                    .push(DiskNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        size_bytes: size,
                        is_directory: false,
                        children: None,
                    });
                *dir_sizes.entry(pk).or_default() += size;
            }
        }
    }

    all_dirs.sort_by(|a, b| b.1.cmp(&a.1));

    for (dir_path, _) in &all_dirs {
        let child_total: u64 = dir_children
            .get(dir_path)
            .map(|children| {
                children
                    .iter()
                    .filter_map(|c| dir_sizes.get(c))
                    .sum()
            })
            .unwrap_or(0);
        *dir_sizes.entry(dir_path.clone()).or_default() += child_total;
    }

    Ok(build_disk_node(
        &root, max_depth, 0, &dir_sizes, &dir_children, &file_children,
    ))
}

fn build_disk_node(
    path: &PathBuf,
    max_depth: u32,
    depth: u32,
    dir_sizes: &HashMap<PathBuf, u64>,
    dir_children: &HashMap<PathBuf, Vec<PathBuf>>,
    file_children: &HashMap<PathBuf, Vec<DiskNode>>,
) -> DiskNode {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("/")
        .to_string();
    let total_size = dir_sizes.get(path).copied().unwrap_or(0);

    if depth >= max_depth {
        return DiskNode {
            name,
            path: path.to_string_lossy().to_string(),
            size_bytes: total_size,
            is_directory: true,
            children: None,
        };
    }

    let mut children: Vec<DiskNode> = Vec::new();

    if let Some(files) = file_children.get(path) {
        children.extend(files.iter().cloned());
    }

    if let Some(subdirs) = dir_children.get(path) {
        for subdir in subdirs {
            children.push(build_disk_node(
                subdir, max_depth, depth + 1, dir_sizes, dir_children, file_children,
            ));
        }
    }

    children.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    children.truncate(50);

    DiskNode {
        name,
        path: path.to_string_lossy().to_string(),
        size_bytes: total_size,
        is_directory: true,
        children: Some(children),
    }
}
