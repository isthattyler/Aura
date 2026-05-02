use std::path::PathBuf;
use crate::error::AppError;
use crate::models::StartupItem;
use super::PlatformPaths;
use super::macos_startup;

pub struct MacOsPlatform;

impl PlatformPaths for MacOsPlatform {
    fn name(&self) -> &'static str { "macOS" }

    fn cache_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Some(home) = dirs::home_dir() {
            // User-level caches
            dirs.push(home.join("Library/Caches"));
            // Derived Data (Xcode)
            dirs.push(home.join("Library/Developer/Xcode/DerivedData"));
            // iOS Device Support (simulators)
            dirs.push(home.join("Library/Developer/Xcode/iOS DeviceSupport"));
            // Simulator caches
            dirs.push(home.join("Library/Developer/CoreSimulator/Caches"));
        }
        dirs
    }

    fn log_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join("Library/Logs"));
        }
        // System-level logs (read-only scan, skip if permission denied)
        dirs.push(PathBuf::from("/var/log"));
        dirs.push(PathBuf::from("/Library/Logs"));
        dirs
    }

    fn temp_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        dirs.push(PathBuf::from("/tmp"));
        dirs.push(PathBuf::from("/var/folders")); // macOS temp folders
        if let Ok(tmp) = std::env::var("TMPDIR") {
            dirs.push(PathBuf::from(tmp));
        }
        dirs
    }

    fn trash_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join(".Trash"));
        }
        // Per-volume .Trashes directories (will be discovered at scan time)
        // /Volumes/<vol>/.Trashes/<uid>/
        paths
    }

    fn app_support_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join("Library/Application Support"));
            dirs.push(home.join("Library/Preferences"));
            dirs.push(home.join("Library/Saved Application State"));
            dirs.push(home.join("Library/Containers"));
            dirs.push(home.join("Library/Group Containers"));
        }
        dirs
    }

    fn app_dirs(&self) -> Vec<PathBuf> {
        vec![
            PathBuf::from("/Applications"),
            dirs::home_dir()
                .map(|h| h.join("Applications"))
                .unwrap_or_default(),
        ]
    }

    fn browser_profile_dirs(&self) -> Vec<(String, PathBuf)> {
        let mut result = Vec::new();
        if let Some(home) = dirs::home_dir() {
            let lib = home.join("Library");
            // Chrome
            let chrome = lib.join("Application Support/Google/Chrome");
            if chrome.exists() { result.push(("chrome".into(), chrome)); }
            // Firefox
            let ff = lib.join("Application Support/Firefox/Profiles");
            if ff.exists() { result.push(("firefox".into(), ff)); }
            // Safari
            let safari = lib.join("Safari");
            if safari.exists() { result.push(("safari".into(), safari)); }
            // Edge
            let edge = lib.join("Application Support/Microsoft Edge");
            if edge.exists() { result.push(("edge".into(), edge)); }
            // Brave
            let brave = lib.join("Application Support/BraveSoftware/Brave-Browser");
            if brave.exists() { result.push(("brave".into(), brave)); }
        }
        result
    }

    fn startup_entries(&self) -> Result<Vec<StartupItem>, AppError> {
        macos_startup::collect_startup_items()
    }

    fn protected_paths(&self) -> Vec<PathBuf> {
        let mut paths = vec![
            PathBuf::from("/System"),
            PathBuf::from("/usr"),
            PathBuf::from("/bin"),
            PathBuf::from("/sbin"),
            PathBuf::from("/etc"),
            PathBuf::from("/Applications/Xcode.app"),
        ];
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Documents"));
            paths.push(home.join("Desktop"));
            paths.push(home.join("Downloads"));
            paths.push(home.join("Pictures"));
            paths.push(home.join("Music"));
            paths.push(home.join("Movies"));
        }
        paths
    }

    fn recent_docs_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Library/Preferences/com.apple.recentitems.plist"));
            paths.push(home.join("Library/Application Support/com.apple.sharedfilelist"));
        }
        paths
    }
}
