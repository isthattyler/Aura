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

    // Try accessing paths that require Full Disk Access on macOS
    // If all attempts return PermissionDenied, FDA is likely not granted.

    // 1. Try user Trash
    if let Some(home) = dirs::home_dir() {
        let trash = home.join(".Trash");
        if trash.exists() {
            match std::fs::read_dir(&trash) {
                Ok(_) => return true,
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                    // Need FDA
                    return false;
                }
                Err(_) => {
                    // Some other error — assume OK
                    return true;
                }
            }
        }
    }

    // 2. Try /Volumes — if it exists, we may need FDA to list it
    let volumes = PathBuf::from("/Volumes");
    if volumes.exists() {
        match std::fs::read_dir(&volumes) {
            Ok(_) => return true,
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => return false,
            Err(_) => return true,
        }
    }

    // No test path existed or errors were non-permission — assume OK
    true
}
