use crate::error::AppError;
use crate::models::RamCleanResult;
use sysinfo::System;

fn get_used_ram() -> Result<u64, AppError> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    Ok(sys.used_memory())
}

#[tauri::command]
pub fn free_up_ram() -> Result<RamCleanResult, AppError> {
    let before = get_used_ram()?;

    #[cfg(target_os = "macos")]
    let message = free_ram_macos()?;

    #[cfg(target_os = "windows")]
    let message = free_ram_windows()?;

    #[cfg(target_os = "linux")]
    let message = free_ram_linux()?;

    // Allow the system to settle after the purge
    std::thread::sleep(std::time::Duration::from_millis(1500));

    let after = get_used_ram()?;
    let bytes_freed = before.saturating_sub(after);

    Ok(RamCleanResult {
        bytes_freed,
        message,
    })
}

// ── macOS: osascript → /usr/sbin/purge ────────────────────────

#[cfg(target_os = "macos")]
fn free_ram_macos() -> Result<String, AppError> {
    use std::process::Command;

    let output = Command::new("osascript")
        .args([
            "-e",
            "do shell script \"/usr/sbin/purge\" with administrator privileges",
        ])
        .output()
        .map_err(|e| {
            log::error!("Failed to spawn osascript: {}", e);
            AppError::Io(format!("Could not run system purge command: {}", e))
        })?;

    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("purge failed — stdout: {}, stderr: {}", stdout, stderr);

        let detail = stderr.trim().to_string();
        if detail.is_empty() {
            return Err(AppError::Permission("purge command failed with no output".into()));
        }
        // User cancelled the admin dialog — not a real error
        if detail.contains("User canceled") || detail.contains("canceled") {
            return Err(AppError::Permission("User cancelled".into()));
        }
        return Err(AppError::Permission(detail));
    }

    log::info!("Memory purge completed successfully");
    Ok("Inactive memory and disk caches cleared".into())
}

// ── Windows: EmptyWorkingSet on current process ───────────────

#[cfg(target_os = "windows")]
fn free_ram_windows() -> Result<String, AppError> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentProcess() -> isize;
        fn EmptyWorkingSet(hProcess: isize) -> i32;
    }

    unsafe {
        EmptyWorkingSet(GetCurrentProcess());
    }

    Ok("Working set trimmed".into())
}

// ── Linux: pkexec → drop_caches ───────────────────────────────

#[cfg(target_os = "linux")]
fn free_ram_linux() -> Result<String, AppError> {
    use std::process::Command;

    let output = Command::new("pkexec")
        .args([
            "sh",
            "-c",
            "sync && echo 3 > /proc/sys/vm/drop_caches",
        ])
        .output()
        .map_err(|e| AppError::Io(format!("Failed to run drop_caches: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Permission(format!(
            "drop_caches failed: {}",
            stderr
        )));
    }

    Ok("Page cache, dentries and inodes dropped".into())
}
