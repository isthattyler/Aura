use std::path::PathBuf;
use crate::error::AppError;
use crate::models::StartupItem;

pub mod macos;
pub mod windows;
pub mod linux;

// ─────────────────────────────────────────
// Platform Trait
// ─────────────────────────────────────────

pub trait PlatformPaths: Send + Sync {
    /// User-level cache directories to scan
    fn cache_dirs(&self) -> Vec<PathBuf>;

    /// Application log directories
    fn log_dirs(&self) -> Vec<PathBuf>;

    /// Temporary file directories
    fn temp_dirs(&self) -> Vec<PathBuf>;

    /// Trash / Recycle Bin paths (may include per-volume paths)
    fn trash_paths(&self) -> Vec<PathBuf>;

    /// App support / application data directories
    fn app_support_dirs(&self) -> Vec<PathBuf>;

    /// Application installation directories to enumerate
    fn app_dirs(&self) -> Vec<PathBuf>;

    /// Browser profile root directories by browser name
    fn browser_profile_dirs(&self) -> Vec<(String, PathBuf)>;

    /// Login/startup items
    fn startup_entries(&self) -> Result<Vec<StartupItem>, AppError>;

    /// Return the user home directory
    fn home_dir(&self) -> Option<PathBuf> {
        dirs::home_dir()
    }

    /// Paths that should NEVER be deleted — safety deny-list
    fn protected_paths(&self) -> Vec<PathBuf>;

    /// Platform display name
    fn name(&self) -> &'static str;

    /// Recent documents paths to scan
    fn recent_docs_paths(&self) -> Vec<PathBuf> {
        Vec::new()
    }
}

// ─────────────────────────────────────────
// Factory — returns boxed platform impl
// ─────────────────────────────────────────

pub fn current_platform() -> Box<dyn PlatformPaths> {
    #[cfg(target_os = "macos")]
    return Box::new(macos::MacOsPlatform);

    #[cfg(target_os = "windows")]
    return Box::new(windows::WindowsPlatform);

    #[cfg(target_os = "linux")]
    return Box::new(linux::LinuxPlatform);

    #[allow(unreachable_code)]
    Box::new(linux::LinuxPlatform)
}

// ─────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────

/// Returns true if `path` is under any of the given `roots`
pub fn is_under_any(path: &std::path::Path, roots: &[PathBuf]) -> bool {
    roots.iter().any(|root| path.starts_with(root))
}

/// Expand a glob-style pattern (simple {A,B} only, no regex)
pub fn expand_home(path: &str) -> Option<PathBuf> {
    if path.starts_with('~') {
        dirs::home_dir().map(|h| h.join(&path[2..]))
    } else {
        Some(PathBuf::from(path))
    }
}
