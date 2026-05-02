use std::path::PathBuf;
use crate::error::AppError;
use crate::models::StartupItem;
use super::PlatformPaths;

pub struct WindowsPlatform;

impl PlatformPaths for WindowsPlatform {
    fn name(&self) -> &'static str { "Windows" }

    fn cache_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        // %LOCALAPPDATA%\Temp
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            dirs.push(local.join("Temp"));
            dirs.push(local.join("Microsoft\\Windows\\INetCache"));
        }
        // %APPDATA%\Local\Temp (same as LOCALAPPDATA typically)
        if let Ok(tmp) = std::env::var("TEMP") {
            dirs.push(PathBuf::from(tmp));
        }
        dirs
    }

    fn log_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(local).join("CrashDumps"));
        }
        // Windows Event Logs (read only, skip if no perms)
        dirs.push(PathBuf::from(r"C:\Windows\System32\winevt\Logs"));
        dirs
    }

    fn temp_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        dirs.push(PathBuf::from(r"C:\Windows\Temp"));
        if let Ok(tmp) = std::env::var("TEMP") {
            dirs.push(PathBuf::from(tmp));
        }
        dirs
    }

    fn trash_paths(&self) -> Vec<PathBuf> {
        // $Recycle.Bin exists on each drive letter
        // We'll discover available drives at runtime
        let drives = ['C', 'D', 'E', 'F', 'G', 'H'];
        drives
            .iter()
            .map(|d| PathBuf::from(format!("{}:\\$Recycle.Bin", d)))
            .filter(|p| p.exists())
            .collect()
    }

    fn app_support_dirs(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        if let Ok(appdata) = std::env::var("APPDATA") {
            dirs.push(PathBuf::from(appdata));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(local));
        }
        dirs
    }

    fn app_dirs(&self) -> Vec<PathBuf> {
        vec![
            PathBuf::from(r"C:\Program Files"),
            PathBuf::from(r"C:\Program Files (x86)"),
        ]
    }

    fn browser_profile_dirs(&self) -> Vec<(String, PathBuf)> {
        let mut result = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(&local);
            let chrome = local.join("Google\\Chrome\\User Data");
            if chrome.exists() { result.push(("chrome".into(), chrome)); }
            let edge = local.join("Microsoft\\Edge\\User Data");
            if edge.exists() { result.push(("edge".into(), edge)); }
            let brave = local.join("BraveSoftware\\Brave-Browser\\User Data");
            if brave.exists() { result.push(("brave".into(), brave)); }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            let ff = PathBuf::from(appdata).join("Mozilla\\Firefox\\Profiles");
            if ff.exists() { result.push(("firefox".into(), ff)); }
        }
        result
    }

    fn startup_entries(&self) -> Result<Vec<StartupItem>, AppError> {
        let items = Vec::new();

        #[cfg(target_os = "windows")]
        {
            use winreg::enums::*;
            use winreg::RegKey;

            let run_keys = [
                (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run"),
                (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
            ];

            for (hive, subkey) in &run_keys {
                let hkey = RegKey::predef(*hive);
                if let Ok(key) = hkey.open_subkey(subkey) {
                    for (name, val) in key.enum_values().flatten() {
                        if let winreg::RegValue { bytes, vtype: REG_SZ } = &val {
                            let path = String::from_utf8_lossy(bytes).to_string();
                            items.push(StartupItem {
                                id: uuid::Uuid::new_v4().to_string(),
                                name,
                                path,
                                startup_type: "registry_run".into(),
                                enabled: true,
                                publisher: None,
                                description: None,
                            });
                        }
                    }
                }
            }
        }

        Ok(items)
    }

    fn recent_docs_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();
        if let Ok(appdata) = std::env::var("APPDATA") {
            paths.push(PathBuf::from(appdata).join(r"Microsoft\Windows\Recent"));
        }
        paths
    }

    fn protected_paths(&self) -> Vec<PathBuf> {
        let mut paths = vec![
            PathBuf::from(r"C:\Windows"),
            PathBuf::from(r"C:\Program Files"),
            PathBuf::from(r"C:\Program Files (x86)"),
            PathBuf::from(r"C:\Program Files\Common Files"),
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
