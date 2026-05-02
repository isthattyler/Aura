use crate::error::AppError;
use crate::models::{InstalledApp, AppLeftover};
use crate::platform::current_platform;
use crate::cleaner::AppCleaner;
use crate::models::CleanResult;

/// List all installed applications on the current platform
#[tauri::command]
pub async fn list_installed_apps() -> Result<Vec<InstalledApp>, AppError> {
    let platform = current_platform();
    let mut apps = Vec::new();

    for app_dir in platform.app_dirs() {
        if !app_dir.exists() { continue; }
        let Ok(entries) = std::fs::read_dir(&app_dir) else { continue };

        for entry in entries.flatten() {
            let path = entry.path();

            #[cfg(target_os = "macos")]
            if path.extension().and_then(|e| e.to_str()) != Some("app") { continue; }

            #[cfg(not(target_os = "macos"))]
            if !path.is_file() { continue; }

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();

            let size = walkdir::WalkDir::new(&path)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum();

            // macOS: read Info.plist for version + bundle ID
            #[cfg(target_os = "macos")]
            let (version, bundle_id) = read_plist_info(&path);
            #[cfg(not(target_os = "macos"))]
            let (version, bundle_id) = (None, None);

            apps.push(InstalledApp {
                id: uuid::Uuid::new_v4().to_string(),
                name,
                version,
                path: path.to_string_lossy().to_string(),
                size_bytes: size,
                last_used: None, // TODO: read from macOS usage db
                bundle_id,
                publisher: None,
            });
        }
    }

    // Sort by size descending
    apps.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(apps)
}

/// Find leftover files for a named app
#[tauri::command]
pub async fn get_app_leftovers(
    app_name: String,
    bundle_id: Option<String>,
) -> Result<Vec<AppLeftover>, AppError> {
    let app = InstalledApp {
        id: String::new(),
        name: app_name,
        version: None,
        path: String::new(),
        size_bytes: 0,
        last_used: None,
        bundle_id,
        publisher: None,
    };
    let cleaner = AppCleaner::new();
    cleaner.find_leftovers(&app)
}

/// Uninstall an app by path
#[tauri::command]
pub async fn uninstall_app(
    app_path: String,
    app_name: String,
    bundle_id: Option<String>,
    include_leftovers: bool,
    permanent: bool,
) -> Result<CleanResult, AppError> {
    let app = InstalledApp {
        id: String::new(),
        name: app_name,
        version: None,
        path: app_path,
        size_bytes: 0,
        last_used: None,
        bundle_id,
        publisher: None,
    };
    let cleaner = AppCleaner::new();
    cleaner.uninstall(&app, include_leftovers, permanent).await
}

#[cfg(target_os = "macos")]
fn read_plist_info(app_path: &std::path::Path) -> (Option<String>, Option<String>) {
    let plist_path = app_path.join("Contents/Info.plist");
    if !plist_path.exists() {
        return (None, None);
    }
    match plist::Value::from_file(&plist_path) {
        Ok(value) => {
            let dict = match value {
                plist::Value::Dictionary(ref d) => d,
                _ => return (None, None),
            };
            let version = dict
                .get("CFBundleShortVersionString")
                .or_else(|| dict.get("CFBundleVersion"))
                .and_then(|v| match v {
                    plist::Value::String(s) => Some(s.clone()),
                    _ => None,
                });
            let bundle_id = dict
                .get("CFBundleIdentifier")
                .and_then(|v| match v {
                    plist::Value::String(s) => Some(s.clone()),
                    _ => None,
                });
            (version, bundle_id)
        }
        Err(_) => (None, None),
    }
}
