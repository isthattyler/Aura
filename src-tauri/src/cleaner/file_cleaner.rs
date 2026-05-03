use std::path::PathBuf;
use crate::error::AppError;
use crate::models::{CleanError, CleanResult};
use super::{safety_check, write_undo_log};

pub struct FileCleaner;

impl FileCleaner {
    pub fn new() -> Self { Self }

    /// Remove a list of paths. Writes undo log before deletion.
    /// If `permanent` is false, moves to OS trash; if true, hard-deletes.
    pub async fn clean(
        &self,
        paths: &[PathBuf],
        permanent: bool,
    ) -> Result<CleanResult, AppError> {
        // Safety check all paths first
        for path in paths {
            safety_check(path)?;
        }

        // Write undo log before any deletions
        write_undo_log(paths).await?;

        let mut bytes_freed = 0u64;
        let mut items_cleaned = 0usize;
        let mut errors = Vec::new();

        for path in paths {
            if !path.exists() {
                // Already gone — count as success
                items_cleaned += 1;
                continue;
            }

            let size = if path.is_dir() {
                crate::scanner::total_size(path)
            } else {
                std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
            };

            let result = if permanent {
                remove_permanently(path)
            } else {
                move_to_trash(path)
            };

            match result {
                Ok(()) => {
                    bytes_freed += size;
                    items_cleaned += 1;
                }
                Err(e) => {
                    errors.push(CleanError {
                        path: path.to_string_lossy().to_string(),
                        message: e.to_string(),
                    });
                }
            }
        }

        Ok(CleanResult {
            success: errors.is_empty(),
            items_cleaned,
            bytes_freed,
            errors,
        })
    }
}

fn remove_permanently(path: &PathBuf) -> Result<(), AppError> {
    if path.is_dir() {
        std::fs::remove_dir_all(path)?;
    } else {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

fn move_to_trash(path: &PathBuf) -> Result<(), AppError> {
    // Use OS-level trash
    #[cfg(target_os = "macos")]
    {
        trash_macos(path)?;
    }
    #[cfg(target_os = "windows")]
    {
        trash_windows(path)
    }
    #[cfg(target_os = "linux")]
    {
        trash_linux(path)
    }
    #[allow(unreachable_code)]
    Err(AppError::Unsupported("Trash not supported on this platform".into()))
}

#[cfg(target_os = "macos")]
fn trash_macos(path: &PathBuf) -> Result<(), AppError> {
    // macOS: use `mv` to ~/.Trash (avoids AppleScript dependency)
    let trash = dirs::home_dir()
        .ok_or_else(|| AppError::NotFound("Home dir not found".into()))?
        .join(".Trash");

    let dest = trash.join(
        path.file_name()
            .ok_or_else(|| AppError::InvalidArg("Invalid file name".into()))?,
    );

    // If destination exists, append timestamp
    let dest = if dest.exists() {
        let ts = chrono::Utc::now().timestamp();
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let new_name = if ext.is_empty() {
            format!("{} {}", stem, ts)
        } else {
            format!("{} {}.{}", stem, ts, ext)
        };
        trash.join(new_name)
    } else {
        dest
    };

    std::fs::rename(path, &dest).map_err(AppError::from)
}

#[cfg(target_os = "windows")]
fn trash_windows(path: &PathBuf) -> Result<(), AppError> {
    // Windows: use SHFileOperation via winapi, or just delete for now
    // TODO: integrate windows-sys for proper RecycleBin support
    std::fs::remove_file(path).map_err(AppError::from)
}

#[cfg(target_os = "linux")]
fn trash_linux(path: &PathBuf) -> Result<(), AppError> {
    // XDG Trash spec
    let trash_dir = dirs::home_dir()
        .ok_or_else(|| AppError::NotFound("Home dir not found".into()))?
        .join(".local/share/Trash");

    let files_dir = trash_dir.join("files");
    let info_dir = trash_dir.join("info");
    std::fs::create_dir_all(&files_dir)?;
    std::fs::create_dir_all(&info_dir)?;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");
    let dest = files_dir.join(file_name);
    let info_file = info_dir.join(format!("{}.trashinfo", file_name));

    // Write .trashinfo
    let info_content = format!(
        "[Trash Info]\nPath={}\nDeletionDate={}\n",
        path.to_string_lossy(),
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S")
    );
    std::fs::write(&info_file, info_content)?;

    std::fs::rename(path, &dest).map_err(AppError::from)
}
