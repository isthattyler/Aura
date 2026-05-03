# Aura — TODO

Priority levels: 🔴 Critical · 🟡 High · 🟢 Medium · ⚪ Low / Nice-to-have

---

## Phase 1 — Project Foundation

- [x] 🔴 Create DESIGN.md
- [x] 🔴 Create ARCHITECTURE.md
- [x] 🔴 Scaffold directory structure
- [x] 🔴 Initialize `package.json` with all frontend dependencies
- [x] 🔴 Configure `vite.config.ts` for Tauri
- [x] 🔴 Configure `tailwind.config.js` with design tokens
- [x] 🔴 Set up `tsconfig.json`
- [x] 🔴 Initialize `src-tauri/Cargo.toml` with all crate dependencies
- [x] 🔴 Configure `src-tauri/tauri.conf.json` (window, CSP, permissions)
- [x] 🔴 Set up GitHub Actions CI matrix (macOS, Windows, Linux)

---

## Phase 2 — Rust Backend: Core Infrastructure

- [x] 🔴 `src/error.rs` — AppError enum + thiserror + serde
- [x] 🔴 `src/models/mod.rs` — All shared structs (ScanItem, ScanResults, SystemStats, etc.)
- [x] 🔴 `src/platform/mod.rs` — PlatformPaths trait + factory fn
- [x] 🔴 `src/platform/macos.rs` — macOS path resolution (NSCachesDirectory, etc.)
- [x] 🔴 `src/platform/windows.rs` — Windows path resolution (%TEMP%, %LOCALAPPDATA%, etc.)
- [x] 🔴 `src/platform/linux.rs` — Linux XDG paths (~/.cache, ~/.local/share, etc.)
- [x] 🔴 `src/scanner/mod.rs` — Scanner trait + ScanOrchestrator
- [x] 🔴 `src/cleaner/mod.rs` — Cleaner trait + safety validator + undo log writer
- [x] 🔴 `src/lib.rs` — Register all Tauri commands

---

## Phase 3 — Rust Backend: Scanner Modules

- [x] 🔴 `src/scanner/junk.rs`
  - [x] User cache directories
  - [x] Application log files
  - [x] Temp files (OS + app-specific)
  - [x] Broken preference files (macOS .plist)
  - [x] Language/locale packs (unused languages)
  - [x] iOS/device backups (macOS)
  - [x] Xcode derived data + simulator caches (macOS)
- [x] 🔴 `src/scanner/trash.rs`
  - [x] macOS: ~/.Trash + per-volume .Trashes
  - [ ] Windows: $Recycle.Bin $I metadata parsing (binary format, low priority)
  - [x] Linux: ~/.local/share/Trash + per-mount .Trash-UID
- [x] 🟡 `src/scanner/large_files.rs`
  - [x] Walk home directory + common dirs
  - [x] Filter by size threshold (default: >50MB)
  - [x] Filter by last-accessed age (default: >1 year)
  - [x] Exclude system dirs (walks only home dir + protected_paths filter)
- [x] 🟡 `src/scanner/duplicates.rs`
  - [x] Size-bucketing pre-filter (skip files with unique sizes)
  - [x] xxHash3 hash comparison (via rayon for parallel hashing)
  - [x] Group duplicates, keep newest/oldest (configurable)
  - [x] Report space recoverable per group
- [x] 🟡 `src/scanner/privacy.rs`
  - [x] Chrome: cache, history, cookies, downloads list
  - [x] Firefox: cache, history, cookies
  - [x] Safari (macOS only): cache, history, cookies
  - [x] Edge: cache, history (macOS, Windows, Linux)
  - [x] Recent documents list (macOS NSRecentDocumentList, Windows Recent, Linux recently-used.xbel)
  - [ ] Clipboard history (platform-specific, limited value — ⚪)

---

## Phase 4 — Rust Backend: Commands

- [x] 🔴 `src/commands/scan.rs`
  - [x] `start_scan(categories)` — async, emits progress events
  - [x] `cancel_scan()` — cancellation token
  - [x] `get_scan_results()` — return cached results
- [x] 🔴 `src/commands/clean.rs`
  - [x] `clean_items(item_ids)` — safe delete with undo log
  - [x] `undo_last_clean()` — restore from undo log
  - [x] `empty_trash()` — permanent trash emptying
- [x] 🔴 `src/commands/system.rs`
  - [x] `get_system_stats()` — CPU%, RAM used/total, disk used/total
  - [x] `get_platform()` — "macos" | "windows" | "linux"
- [x] 🟡 `src/commands/apps.rs`
  - [x] `list_installed_apps()` — name, version, size, last used
  - [x] `get_app_leftovers(app_name)` — find support files, caches, prefs
  - [x] `uninstall_app(app_name, include_leftovers)` — full removal
- [x] 🟡 `src/commands/startup.rs`
  - [x] `list_startup_items()` — name, path, enabled, type
  - [x] `toggle_startup_item(id, enabled)` — enable/disable
  - [x] `remove_startup_item(id)` — permanent removal
- [x] 🟢 `src/commands/disk.rs`
  - [x] `get_disk_usage(path)` — recursive tree with size rollups
  - [x] `get_volumes()` — mounted drives + free/used space
- [x] 🟢 `src/commands/privacy.rs`
  - [x] `scan_privacy()` — returns browser artifacts found
  - [x] `clean_privacy(artifact_ids)` — removes selected artifacts

---

## Phase 5 — Frontend: Core Shell

- [x] 🔴 `src/index.css` — CSS variables, resets, global font imports
- [x] 🔴 `src/types/index.ts` — All TypeScript types mirroring Rust models
- [x] 🔴 `src/store/index.ts` — Zustand store setup
- [x] 🔴 `src/main.tsx` — React entry point
- [x] 🔴 `src/App.tsx` — Layout shell + router
- [x] 🔴 `src/components/layout/Sidebar.tsx`
- [x] 🔴 `src/components/layout/TopBar.tsx`
- [x] 🟡 `src/components/layout/TitleBar.tsx` — Custom drag region (Win/Linux)

---

## Phase 6 — Frontend: UI Components

- [x] 🔴 `src/components/ui/Button.tsx` — variants: primary, secondary, ghost, danger
- [x] 🔴 `src/components/ui/Card.tsx` — surface card with optional left-border accent
- [x] 🔴 `src/components/ui/Badge.tsx` — size display + status badges (in Card.tsx)
- [x] 🔴 `src/components/ui/ProgressRing.tsx` — SVG circular progress (in Card.tsx)
- [x] 🔴 `src/components/ui/ProgressBar.tsx` — linear progress (in Card.tsx)
- [x] 🔴 `src/components/ui/SizeLabel.tsx` — bytes → human-readable (in Card.tsx)
- [x] 🔴 `src/components/ui/Toast.tsx` + ToastContainer
- [x] 🔴 `src/components/ui/ActionSheet.tsx` — confirmation before delete
- [x] 🟡 `src/components/ui/FileRow.tsx` — virtualized list row
- [x] 🟡 `src/components/ui/Spinner.tsx`
- [x] 🟡 `src/components/ui/Checkbox.tsx` — custom styled

---

## Phase 7 — Frontend: Pages

- [x] 🔴 `src/pages/Dashboard.tsx`
  - [x] SmartScan button with animated ring
  - [x] Category result cards (8 categories)
  - [x] Total space freed counter
  - [x] System health mini-stats (CPU, RAM, Disk)
- [x] 🔴 `src/pages/SystemJunk.tsx`
- [x] 🔴 `src/pages/TrashBins.tsx`
- [x] 🟡 `src/pages/LargeFiles.tsx`
- [x] 🟡 `src/pages/Duplicates.tsx`
- [x] 🟡 `src/pages/AppUninstaller.tsx`
- [x] 🟡 `src/pages/StartupManager.tsx`
- [x] 🟢 `src/pages/Privacy.tsx`
- [x] 🟢 `src/pages/DiskSpace.tsx`
- [x] 🟢 `src/pages/Maintenance.tsx`
- [x] ⚪ `src/pages/Settings.tsx`

---

## Phase 8 — Polish & QA

- [x] 🟡 Keyboard shortcuts (⌘, for settings; key handler infrastructure in App.tsx)
- [x] 🟡 Onboarding flow (first launch overlay with 4-step walkthrough)
- [x] 🟡 Empty states for all pages (no results) — icon + text pattern across all pages
- [x] 🟡 Error states + retry UI — ErrorState component (title, message, retry button)
- [x] 🟡 Loading skeletons — SkeletonLine, SkeletonCard, SkeletonList, SkeletonPage components
- [x] 🟢 `@media (prefers-reduced-motion)` compliance
- [x] 🟢 Window min-size enforcement (900×600)
- [x] 🟢 Auto-updater config (tauri-plugin-updater in Cargo.toml + lib.rs + tauri.conf.json)
- [x] ⚪ Dark/light theme toggle (Settings page with theme select; CSS variables for light mode)
- [x] ⚪ Settings persistence (localStorage read/write in Zustand store)
- [x] 🟡 Select All / Uncheck All per category (selectAllInCategory in store)
- [ ] ⚪ Tray icon + background scan mode
- [ ] ⚪ Scheduled scans (cron-like)
- [ ] ⚪ Export scan report as PDF/CSV

---

## Phase 9 — Release Prep

- [ ] ⚪ Code signing (macOS notarization, Windows EV cert)
- [ ] ⚪ App icons (all required sizes via Tauri icon gen)
- [ ] ⚪ Splash screen
- [ ] ⚪ Privacy policy + telemetry opt-in (opt-out by default)
- [ ] ⚪ GitHub Releases automation
- [ ] ⚪ Homebrew cask (macOS)
- [ ] ⚪ winget manifest (Windows)
- [ ] ⚪ AUR package (Linux)
