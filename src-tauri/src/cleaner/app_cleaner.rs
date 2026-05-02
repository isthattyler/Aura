use std::path::PathBuf;
use crate::error::AppError;
use crate::models::{CleanResult, InstalledApp, AppLeftover};
use crate::platform::current_platform;
use super::file_cleaner::FileCleaner;

pub struct AppCleaner;

impl AppCleaner {
    pub fn new() -> Self { Self }

    /// Uninstall an app and optionally its leftover files
    pub async fn uninstall(
        &self,
        app: &InstalledApp,
        include_leftovers: bool,
        permanent: bool,
    ) -> Result<CleanResult, AppError> {
        let mut paths = vec![PathBuf::from(&app.path)];

        if include_leftovers {
            let leftovers = self.find_leftovers(app)?;
            paths.extend(leftovers.into_iter().map(|l| PathBuf::from(l.path)));
        }

        let cleaner = FileCleaner::new();
        cleaner.clean(&paths, permanent).await
    }

    /// Find leftover files associated with an app
    pub fn find_leftovers(&self, app: &InstalledApp) -> Result<Vec<AppLeftover>, AppError> {
        let mut leftovers = Vec::new();
        let platform = current_platform();
        let app_name = &app.name;
        let bundle_id = app.bundle_id.as_deref().unwrap_or("");

        let search_dirs = platform.app_support_dirs();

        for dir in search_dirs {
            if !dir.exists() { continue; }
            let Ok(entries) = std::fs::read_dir(&dir) else { continue };

            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                // Match by app name or bundle ID
                let matches = name.contains(app_name.as_str())
                    || (!bundle_id.is_empty() && name.contains(bundle_id));

                if matches {
                    let size = dir_size(&path);
                    let leftover_type = classify_leftover(&path);

                    leftovers.push(AppLeftover {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: name.to_string(),
                        path: path.to_string_lossy().to_string(),
                        size_bytes: size,
                        leftover_type,
                    });
                }
            }
        }

        Ok(leftovers)
    }
}

fn dir_size(path: &PathBuf) -> u64 {
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

fn classify_leftover(path: &PathBuf) -> String {
    let path_str = path.to_string_lossy().to_lowercase();
    if path_str.contains("cache") { "cache" }
    else if path_str.contains("log") { "log" }
    else if path_str.contains("preference") || path_str.contains("plist") { "preference" }
    else if path_str.contains("support") { "support" }
    else if path_str.contains("saved application state") { "saved_state" }
    else { "other" }
    .to_string()
}
