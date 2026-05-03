use crate::error::AppError;

/// Check whether the app has adequate filesystem permissions.
/// On macOS, this checks Full Disk Access; on other platforms, always returns true.
#[tauri::command]
pub async fn check_permission() -> Result<bool, AppError> {
    #[cfg(target_os = "macos")]
    {
        Ok(check_full_disk_access())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = check_full_disk_access;
        Ok(true)
    }
}

/// Request the user grant Full Disk Access by opening System Settings.
/// macOS only; no-op on other platforms.
#[tauri::command]
pub async fn request_permission() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn check_full_disk_access() -> bool {
    use std::path::PathBuf;

    // Try reading /System/Library/LaunchDaemons/ — on macOS 14+ this requires FDA.
    // If PermissionDenied, FDA is not granted.
    let system_daemons = PathBuf::from("/System/Library/LaunchDaemons");
    if system_daemons.exists() {
        match std::fs::read_dir(&system_daemons) {
            Ok(entries) => {
                // Verify we can actually read at least one file inside
                for entry in entries.flatten() {
                    if let Ok(meta) = entry.metadata() {
                        return meta.is_file();
                    }
                }
                // Could list dir but can't read files — assume FDA not granted
                false
            }
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => false,
            Err(_) => false,
        }
    } else {
        !cfg!(target_os = "macos")
    }
}
