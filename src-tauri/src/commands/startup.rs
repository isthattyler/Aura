use crate::error::AppError;
use crate::models::StartupItem;
use crate::platform::current_platform;

/// List all startup / login items
#[tauri::command]
pub fn list_startup_items() -> Result<Vec<StartupItem>, AppError> {
    let platform = current_platform();
    platform.startup_entries()
}

/// Toggle a startup item's enabled state
/// macOS: rename .plist ↔ .plist.disabled
/// Windows: add/remove from HKCU\Software\Microsoft\Windows\CurrentVersion\Run
/// Linux: rename .desktop ↔ .desktop.disabled
#[tauri::command]
pub fn toggle_startup_item(_id: String, path: String, enabled: bool) -> Result<(), AppError> {
    let file = std::path::PathBuf::from(&path);
    if !file.exists() {
        return Err(AppError::NotFound(format!("Startup item not found: {}", path)));
    }

    if enabled {
        // Re-enable: remove .disabled suffix
        if let Some(name) = file.file_name().and_then(|n| n.to_str()) {
            if let Some(original) = name.strip_suffix(".disabled") {
                let new_path = file.with_file_name(original);
                std::fs::rename(&file, &new_path)?;
                log::info!("Enabled startup item: {}", original);
                return Ok(());
            }
        }
        // Already enabled
        Ok(())
    } else {
        // Disable: append .disabled suffix
        let mut new_name = file
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        new_name.push_str(".disabled");
        let new_path = file.with_file_name(&new_name);
        std::fs::rename(&file, &new_path)?;
        log::info!("Disabled startup item: {}", file.display());
        Ok(())
    }
}

/// Permanently remove a startup item
#[tauri::command]
pub fn remove_startup_item(_id: String, path: String) -> Result<(), AppError> {
    let file = std::path::PathBuf::from(&path);
    if file.exists() {
        std::fs::remove_file(&file)?;
    }
    Ok(())
}
