// ─────────────────────────────────────────
// Shared TypeScript Types
// Mirrors structs in src-tauri/src/models/
// ─────────────────────────────────────────

// ── Platform ──────────────────────────────

export type Platform = "macos" | "windows" | "linux";

// ── Scan ──────────────────────────────────

export type ScanCategory =
  | "system_junk"
  | "trash"
  | "large_files"
  | "duplicates"
  | "privacy"
  | "apps"
  | "startup"
  | "maintenance";

export interface ScanOptions {
  categories: ScanCategory[];
  largeFileSizeThresholdMb?: number;
  largeFileAgeThresholdDays?: number;
}

export interface ScanItem {
  id: string;
  category: ScanCategory;
  name: string;
  path: string;
  sizeBytes: number;
  /** ISO 8601 */
  lastModified: string | null;
  /** ISO 8601 */
  lastAccessed: string | null;
  /** For duplicates: hash group ID */
  groupId: string | null;
  /** Whether this item can be safely removed */
  safe: boolean;
  /** Human-readable description of what this item is */
  description: string;
}

export interface ScanProgress {
  category: ScanCategory;
  phase: "scanning" | "complete";
  itemsFound: number;
  bytesFound: number;
  currentPath: string | null;
}

export interface ScanResults {
  completedAt: string;
  items: ScanItem[];
  totalBytes: number;
  byCategory: Record<ScanCategory, CategoryResult>;
}

export interface CategoryResult {
  items: ScanItem[];
  totalBytes: number;
  itemCount: number;
}

// ── Clean ──────────────────────────────────

export interface CleanOptions {
  itemIds: string[];
  permanent: boolean;
}

export interface CleanProgress {
  processedItems: number;
  totalItems: number;
  bytesFreed: number;
  currentPath: string | null;
}

export interface CleanResult {
  success: boolean;
  itemsCleaned: number;
  bytesFreed: number;
  errors: CleanError[];
}

export interface CleanError {
  path: string;
  message: string;
}

// ── System Stats ──────────────────────────

export interface RamCleanResult {
  bytesFreed: number;
  message: string;
}

export interface SystemStats {
  cpuUsagePercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  /** Main volume only */
  diskUsedBytes: number;
  diskTotalBytes: number;
  /** Score 0–100: higher = healthier */
  healthScore: number;
}

// ── Apps ──────────────────────────────────

export interface InstalledApp {
  id: string;
  name: string;
  version: string | null;
  path: string;
  sizeBytes: number;
  lastUsed: string | null;
  bundleId: string | null;
  /** Publisher/developer name */
  publisher: string | null;
}

export interface AppLeftover {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  type: "cache" | "log" | "preference" | "support" | "saved_state" | "other";
}

// ── Startup ───────────────────────────────

export type StartupType =
  | "login_item"       // macOS: Login Items
  | "launchd_agent"    // macOS: LaunchAgents
  | "launchd_daemon"   // macOS: LaunchDaemons
  | "registry_run"     // Windows: HKCU/HKLM Run
  | "scheduled_task"   // Windows: Task Scheduler
  | "systemd_user"     // Linux: systemd user units
  | "xdg_autostart"    // Linux: XDG autostart
  | "btm_app"          // macOS: BTM-registered app
  | "btm_daemon"       // macOS: BTM-registered daemon
  | "btm_developer";   // macOS: BTM-registered developer tool

export interface StartupItem {
  id: string;
  name: string;
  path: string;
  type: StartupType;
  enabled: boolean;
  publisher: string | null;
  description: string | null;
}

// ── Privacy ───────────────────────────────

export type BrowserType = "chrome" | "firefox" | "safari" | "edge" | "brave" | "opera";
export type PrivacyArtifactType = "cache" | "history" | "cookies" | "downloads" | "sessions";

export interface PrivacyArtifact {
  id: string;
  browser: BrowserType;
  artifactType: PrivacyArtifactType;
  path: string;
  sizeBytes: number;
  description: string;
}

// ── Disk ──────────────────────────────────

export interface Volume {
  name: string;
  mountPoint: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  fileSystem: string;
}

export interface DiskNode {
  name: string;
  path: string;
  sizeBytes: number;
  isDirectory: boolean;
  children: DiskNode[] | null;
}

// ── UI State ──────────────────────────────

export type Page =
  | "dashboard"
  | "system_junk"
  | "trash"
  | "large_files"
  | "duplicates"
  | "app_uninstaller"
  | "startup"
  | "privacy"
  | "disk"
  | "maintenance"
  | "settings";

export type ScanStatus = "idle" | "scanning" | "complete" | "error";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

export type ThemeMode = "dark" | "light";

export interface AppSettings {
  deleteMode: "trash" | "permanent";
  largeFileSizeThresholdMb: number;
  largeFileAgeThresholdDays: number;
  scanOnStartup: boolean;
  showHiddenFiles: boolean;
  excludedPaths: string[];
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  deleteMode: "permanent",
  largeFileSizeThresholdMb: 50,
  largeFileAgeThresholdDays: 365,
  scanOnStartup: false,
  showHiddenFiles: false,
  excludedPaths: [],
  theme: "dark",
};

// ── Helpers ───────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0))} ${sizes[i]}`;
}

export function categoryLabel(cat: ScanCategory): string {
  const labels: Record<ScanCategory, string> = {
    system_junk: "System Junk",
    trash: "Trash Bins",
    large_files: "Large & Old Files",
    duplicates: "Duplicates",
    privacy: "Privacy",
    apps: "App Leftovers",
    startup: "Startup Items",
    maintenance: "Maintenance",
  };
  return labels[cat];
}

export const CATEGORY_COLORS: Record<ScanCategory, string> = {
  system_junk: "#F59E0B",
  trash: "#EF4444",
  large_files: "#8B5CF6",
  duplicates: "#6366F1",
  privacy: "#EC4899",
  apps: "#3B82F6",
  startup: "#10B981",
  maintenance: "#F97316",
};
