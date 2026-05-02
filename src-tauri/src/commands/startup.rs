use crate::error::AppError;
use crate::models::StartupItem;
use crate::platform::current_platform;

/// List all startup / login items
#[tauri::command]
pub fn list_startup_items() -> Result<Vec<StartupItem>, AppError> {
    let platform = current_platform();
    platform.startup_entries()
}

/// Toggle a startup item's enabled state.
/// macOS: uses launchctl bootout / bootstrap for plist items.
/// Linux: renames .desktop ↔ .desktop.disabled.
/// Windows: renames registry values (file-rename fallback).
/// BTM items: cannot be toggled programmatically; return NotSupported.
#[tauri::command]
pub fn toggle_startup_item(_id: String, path: String, enabled: bool) -> Result<(), AppError> {
    // Refuse to modify system-protected items
    if path.starts_with("__system__") {
        return Err(AppError::Permission(
            "System startup items cannot be modified".into(),
        ));
    }

    let file = std::path::PathBuf::from(&path);

    // BTM items don't have a plist file to toggle
    if path.is_empty() || path.starts_with("/Applications/") {
        return Err(AppError::Unsupported(
            "Background Task Management items must be managed in System Settings".into(),
        ));
    }

    if !file.exists() {
        return Err(AppError::NotFound(format!("Startup item not found: {}", path)));
    }

    if enabled {
        #[cfg(target_os = "macos")]
        {
            // Enable: launchctl bootstrap
            let uid = unsafe { libc::getuid() };
            let status = std::process::Command::new("/bin/launchctl")
                .arg("bootstrap")
                .arg(format!("gui/{}", uid))
                .arg(file.to_string_lossy().as_ref())
                .status();
            match status {
                Ok(s) if s.success() => log::info!("Bootstrapped: {}", file.display()),
                _ => log::warn!("launchctl boostrap failed for {}", file.display()),
            }
        }
        // Re-enable: remove .disabled suffix
        if let Some(name) = file.file_name().and_then(|n| n.to_str()) {
            if let Some(original) = name.strip_suffix(".disabled") {
                let new_path = file.with_file_name(original);
                std::fs::rename(&file, &new_path)?;
                log::info!("Enabled startup item: {}", original);
                return Ok(());
            }
        }
        Ok(())
    } else {
        #[cfg(target_os = "macos")]
        {
            // Disable: launchctl bootout
            let uid = unsafe { libc::getuid() };
            let status = std::process::Command::new("/bin/launchctl")
                .arg("bootout")
                .arg(format!("gui/{}", uid))
                .arg(file.to_string_lossy().as_ref())
                .status();
            match status {
                Ok(s) if s.success() => log::info!("Booted out: {}", file.display()),
                _ => log::warn!("launchctl bootout failed for {}", file.display()),
            }
        }
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

/// Permanently remove a startup item.
/// macOS: launches bootout before removal.
/// BTM / protected items: cannot be removed.
#[tauri::command]
pub fn remove_startup_item(_id: String, path: String) -> Result<(), AppError> {
    // Refuse to modify system-protected items
    if path.starts_with("__system__") {
        return Err(AppError::Permission(
            "System startup items cannot be removed".into(),
        ));
    }

    let file = std::path::PathBuf::from(&path);

    // BTM items
    if path.is_empty() || path.starts_with("/Applications/") {
        return Err(AppError::Unsupported(
            "Background Task Management items must be removed in System Settings".into(),
        ));
    }

    #[cfg(target_os = "macos")]
    {
        let uid = unsafe { libc::getuid() };
        let _ = std::process::Command::new("/bin/launchctl")
            .arg("bootout")
            .arg(format!("gui/{}", uid))
            .arg(file.to_string_lossy().as_ref())
            .status();
    }

    if file.exists() {
        std::fs::remove_file(&file)?;
    }
    Ok(())
}
