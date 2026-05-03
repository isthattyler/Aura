use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────
// Platform
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Macos,
    Windows,
    Linux,
}

impl Platform {
    pub fn current() -> Self {
        #[cfg(target_os = "macos")]
        return Platform::Macos;
        #[cfg(target_os = "windows")]
        return Platform::Windows;
        #[cfg(target_os = "linux")]
        return Platform::Linux;
    }
}

// ─────────────────────────────────────────
// Scan
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ScanCategory {
    SystemJunk,
    Trash,
    LargeFiles,
    Duplicates,
    Privacy,
    Apps,
    Startup,
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub categories: Vec<ScanCategory>,
    pub large_file_size_threshold_mb: Option<u64>,
    pub large_file_age_threshold_days: Option<u64>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            categories: vec![
                ScanCategory::SystemJunk,
                ScanCategory::Trash,
                ScanCategory::LargeFiles,
                ScanCategory::Duplicates,
                ScanCategory::Privacy,
            ],
            large_file_size_threshold_mb: Some(50),
            large_file_age_threshold_days: Some(365),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanItem {
    pub id: String,
    pub category: ScanCategory,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub last_modified: Option<String>,
    pub last_accessed: Option<String>,
    pub group_id: Option<String>,
    pub safe: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub category: ScanCategory,
    pub phase: ScanPhase,
    pub items_found: usize,
    pub bytes_found: u64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanPhase {
    Scanning,
    Complete,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanResults {
    pub completed_at: String,
    pub items: Vec<ScanItem>,
    pub total_bytes: u64,
    pub by_category: std::collections::HashMap<String, CategoryResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CategoryResult {
    pub item_count: usize,
    pub total_bytes: u64,
}

// ─────────────────────────────────────────
// Clean
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanOptions {
    pub item_ids: Vec<String>,
    pub permanent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanProgress {
    pub processed_items: usize,
    pub total_items: usize,
    pub bytes_freed: u64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanResult {
    pub success: bool,
    pub items_cleaned: usize,
    pub bytes_freed: u64,
    pub errors: Vec<CleanError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanError {
    pub path: String,
    pub message: String,
}

// ─────────────────────────────────────────
// System Stats
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu_usage_percent: f32,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub health_score: u8,
}

// ─────────────────────────────────────────
// Apps
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub path: String,
    pub size_bytes: u64,
    pub last_used: Option<String>,
    pub bundle_id: Option<String>,
    pub publisher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLeftover {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub leftover_type: String,
}

// ─────────────────────────────────────────
// Startup
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub startup_type: String,
    pub enabled: bool,
    pub publisher: Option<String>,
    pub description: Option<String>,
}

// ─────────────────────────────────────────
// Maintenance
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RamCleanResult {
    pub bytes_freed: u64,
    pub message: String,
}

// ─────────────────────────────────────────
// Disk
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskNode {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub is_directory: bool,
    pub children: Option<Vec<DiskNode>>,
}
