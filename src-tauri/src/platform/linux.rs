use std::path::PathBuf;
use crate::error::AppError;
use crate::models::StartupItem;
use super::PlatformPaths;

pub struct LinuxPlatform;

impl PlatformPaths for LinuxPlatform {
    fn name(&self) -> &'static str { "Linux" }

    fn cache_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        // XDG_CACHE_HOME (default: ~/.cache)
        let cache = std::env::var("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().map(|h| h.join(".cache")).unwrap_or_default());
        if cache.exists() { dirs.push(cache); }
        dirs
    }

    fn log_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join(".local/share/xorg")); // X.Org logs
        }
        dirs.push(PathBuf::from("/var/log"));
        dirs
    }

    fn temp_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        dirs.push(PathBuf::from("/tmp"));
        dirs.push(PathBuf::from("/var/tmp"));
        // Per-user runtime dir
        if let Ok(uid) = std::env::var("UID") {
            dirs.push(PathBuf::from(format!("/run/user/{}", uid)));
        }
        dirs
    }

    fn trash_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        // XDG trash
        let xdg_data = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().map(|h| h.join(".local/share")).unwrap_or_default());
        paths.push(xdg_data.join("Trash"));
        // Per-mount .Trash-UID directories resolved at scan time
        paths
    }

    fn app_support_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        let data_home = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().map(|h| h.join(".local/share")).unwrap_or_default());
        dirs.push(data_home);
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join(".config"));
        }
        dirs
    }

    fn app_dirs(&self) -> Vec<PathBuf> {
        vec![
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/opt"),
        ]
    }

    fn browser_profile_dirs(&self) -> Vec<(String, PathBuf)> {
        let mut result = Vec::new();
        let cache = std::env::var("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().map(|h| h.join(".cache")).unwrap_or_default());
        let config = std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().map(|h| h.join(".config")).unwrap_or_default());

        let chrome = cache.join("google-chrome");
        if chrome.exists() { result.push(("chrome".into(), chrome)); }
        let chromium = cache.join("chromium");
        if chromium.exists() { result.push(("chromium".into(), chromium)); }
        let firefox = dirs::home_dir().map(|h| h.join(".mozilla/firefox")).unwrap_or_default();
        if firefox.exists() { result.push(("firefox".into(), firefox)); }
        let brave = config.join("BraveSoftware/Brave-Browser");
        if brave.exists() { result.push(("brave".into(), brave)); }
        let edge = config.join("microsoft-edge");
        if edge.exists() { result.push(("edge".into(), edge)); }

        result
    }

    fn startup_entries(&self) -> Result<Vec<StartupItem>, AppError> {
        let mut items = Vec::new();

        // XDG autostart
        let autostart_dirs = vec![
            dirs::home_dir().map(|h| h.join(".config/autostart")).unwrap_or_default(),
            PathBuf::from("/etc/xdg/autostart"),
        ];

        for dir in autostart_dirs {
            if !dir.exists() { continue; }
            let Ok(read) = std::fs::read_dir(&dir) else { continue };
            for entry in read.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("desktop") {
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    // TODO: parse .desktop file for Name=, Hidden=, Exec= keys
                    items.push(StartupItem {
                        id: uuid::Uuid::new_v4().to_string(),
                        name,
                        path: path.to_string_lossy().to_string(),
                        startup_type: "xdg_autostart".into(),
                        enabled: true,
                        publisher: None,
                        description: None,
                    });
                }
            }
        }

        // systemd user units
        if let Some(home) = dirs::home_dir() {
            let systemd_user = home.join(".config/systemd/user");
            if systemd_user.exists() {
                let Ok(read) = std::fs::read_dir(&systemd_user) else { return Ok(items) };
                for entry in read.flatten() {
                    let path = entry.path();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext == "service" || ext == "timer" {
                        let name = path
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("Unknown")
                            .to_string();
                        items.push(StartupItem {
                            id: uuid::Uuid::new_v4().to_string(),
                            name,
                            path: path.to_string_lossy().to_string(),
                            startup_type: "systemd_user".into(),
                            enabled: true,
                            publisher: None,
                            description: None,
                        });
                    }
                }
            }
        }

        Ok(items)
    }

    fn recent_docs_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join(".local/share/recently-used.xbel"));
        }
        paths
    }

    fn protected_paths(&self) -> Vec<PathBuf> {
        let mut paths = vec![
            PathBuf::from("/bin"),
            PathBuf::from("/sbin"),
            PathBuf::from("/usr"),
            PathBuf::from("/etc"),
            PathBuf::from("/boot"),
            PathBuf::from("/sys"),
            PathBuf::from("/proc"),
            PathBuf::from("/dev"),
        ];
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Documents"));
            paths.push(home.join("Desktop"));
            paths.push(home.join("Downloads"));
            paths.push(home.join("Pictures"));
            paths.push(home.join("Music"));
            paths.push(home.join("Videos"));
        }
        paths
    }
}
