use sysinfo::System;
use crate::error::AppError;
use crate::models::{Platform, SystemStats};

/// Return current system statistics: CPU, RAM, disk
#[tauri::command]
pub fn get_system_stats() -> Result<SystemStats, AppError> {
    let mut sys = System::new_all();
    sys.refresh_all();

    // CPU usage average across all cores
    let cpu_usage = sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>()
        / sys.cpus().len().max(1) as f32;

    let ram_used = sys.used_memory();
    let ram_total = sys.total_memory();

    // Get the primary disk (first disk returned by sysinfo)
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let (disk_total, disk_used) = disks
        .iter()
        .find(|d| d.mount_point().to_string_lossy() == "/"
            || d.mount_point().to_string_lossy() == "C:\\")
        .map(|d| (d.total_space(), d.total_space() - d.available_space()))
        .unwrap_or_else(|| {
            // Fallback: use largest disk
            disks
                .iter()
                .max_by_key(|d| d.total_space())
                .map(|d| (d.total_space(), d.total_space() - d.available_space()))
                .unwrap_or((1, 0))
        });

    // Health score: weighted average of free disk + free RAM + low CPU
    let disk_free_pct = if disk_total > 0 {
        (disk_total - disk_used) as f32 / disk_total as f32
    } else { 1.0 };

    let ram_free_pct = if ram_total > 0 {
        (ram_total - ram_used) as f32 / ram_total as f32
    } else { 1.0 };

    let cpu_idle_pct = (100.0 - cpu_usage) / 100.0;

    let health = (disk_free_pct * 50.0 + ram_free_pct * 30.0 + cpu_idle_pct * 20.0) as u8;
    let health_score = health.min(100);

    Ok(SystemStats {
        cpu_usage_percent: cpu_usage,
        ram_used_bytes: ram_used,
        ram_total_bytes: ram_total,
        disk_used_bytes: disk_used,
        disk_total_bytes: disk_total,
        health_score,
    })
}

/// Return the current platform name
#[tauri::command]
pub fn get_platform() -> Platform {
    Platform::current()
}
