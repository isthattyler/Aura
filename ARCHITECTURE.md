# Aura — Architecture

> Rust + Tauri 2.0 · React 18 + TypeScript · Cross-platform (macOS, Windows, Linux)

---

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri App Shell                          │
│                                                                  │
│   ┌─────────────────────────┐    ┌───────────────────────────┐  │
│   │    WebView (Frontend)   │    │    Rust Core (Backend)    │  │
│   │                         │    │                           │  │
│   │  React + TypeScript     │    │  Commands (invoke layer)  │  │
│   │  Zustand (state)        │◄──►│  Scanner modules          │  │
│   │  Tailwind CSS           │    │  Cleaner modules          │  │
│   │  Lucide icons           │    │  Platform adapters        │  │
│   │  react-window (virt.)   │    │  System APIs              │  │
│   └─────────────────────────┘    └───────────────────────────┘  │
│                                           │                      │
│                                  ┌────────▼──────────┐          │
│                                  │   OS / Filesystem  │          │
│                                  │   macOS / Win / Lin│          │
│                                  └────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

Communication flows exclusively through **Tauri's IPC bridge** using `invoke()` on the frontend and `#[tauri::command]` on the backend. No direct filesystem access from the webview.

---

## Directory Structure

```
aura/
├── DESIGN.md
├── ARCHITECTURE.md
├── TODO.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── index.html
│
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router + layout shell
│   ├── index.css                 # Global styles, CSS variables
│   │
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   │
│   ├── store/
│   │   └── index.ts              # Zustand global store
│   │
│   ├── hooks/
│   │   ├── useScan.ts            # Scan orchestration hook
│   │   ├── useSystem.ts          # System stats polling hook
│   │   └── usePlatform.ts        # Detect current OS
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # Nav sidebar
│   │   │   ├── TopBar.tsx        # Page header bar
│   │   │   └── TitleBar.tsx      # Custom title bar (Win/Linux)
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── ProgressRing.tsx  # SVG circular progress
│   │       ├── ProgressBar.tsx   # Linear progress
│   │       ├── FileRow.tsx       # Virtualized file list row
│   │       ├── SizeLabel.tsx     # Formatted byte sizes
│   │       ├── Toast.tsx
│   │       ├── ActionSheet.tsx   # Confirmation modal
│   │       └── Spinner.tsx
│   │
│   └── pages/
│       ├── Dashboard.tsx         # SmartScan overview
│       ├── SystemJunk.tsx        # Caches, logs, temp files
│       ├── TrashBins.tsx         # Multi-drive trash
│       ├── LargeFiles.tsx        # Large & old files
│       ├── Duplicates.tsx        # Duplicate finder
│       ├── AppUninstaller.tsx    # App + leftovers removal
│       ├── StartupManager.tsx    # Login items, startup entries
│       ├── Privacy.tsx           # Browser data, recent files
│       ├── DiskSpace.tsx         # Disk usage treemap
│       ├── Maintenance.tsx       # Scripts, indexes, fonts
│       └── Settings.tsx
│
└── src-tauri/                    # Rust backend
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    │
    └── src/
        ├── main.rs               # Tauri app entry
        ├── lib.rs                # Command registration
        ├── error.rs              # AppError type + From impls
        │
        ├── models/
        │   └── mod.rs            # Shared Rust structs (serde)
        │
        ├── commands/             # Tauri invoke handlers
        │   ├── mod.rs
        │   ├── scan.rs           # Run scans, return results
        │   ├── clean.rs          # Execute cleanup
        │   ├── system.rs         # CPU, RAM, disk stats
        │   ├── apps.rs           # Installed app listing + uninstall
        │   ├── startup.rs        # Startup item management
        │   ├── privacy.rs        # Browser cache / history
        │   └── disk.rs           # Disk usage tree
        │
        ├── scanner/
        │   ├── mod.rs            # Scanner trait + orchestrator
        │   ├── junk.rs           # System junk scanner
        │   ├── trash.rs          # Trash bin scanner
        │   ├── large_files.rs    # Large/old file scanner
        │   ├── duplicates.rs     # Duplicate detection (hash-based)
        │   └── privacy.rs        # Browser artifact scanner
        │
        ├── cleaner/
        │   ├── mod.rs            # Cleaner trait + safety checks
        │   ├── file_cleaner.rs   # Safe file deletion with undo log
        │   └── app_cleaner.rs    # App bundle + data removal
        │
        └── platform/
            ├── mod.rs            # Platform detection + trait
            ├── macos.rs          # macOS-specific paths + APIs
            ├── windows.rs        # Windows-specific paths + APIs
            └── linux.rs          # Linux XDG paths + APIs
```

---

## Frontend Architecture

### State Management (Zustand)

Single global store split into slices:

```typescript
AppStore {
  // Navigation
  currentPage: Page
  setCurrentPage: (page: Page) => void

  // Scan state
  scanStatus: 'idle' | 'scanning' | 'complete' | 'error'
  scanResults: ScanResults
  selectedItems: Set<string>
  startScan: () => Promise<void>
  cleanSelected: () => Promise<void>

  // System stats (polled every 2s)
  systemStats: SystemStats

  // Toast queue
  toasts: Toast[]
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}
```

### Routing

Client-side only — no URL routing. Navigation state held in Zustand. Page components are lazy-loaded via `React.lazy()` + `Suspense`.

### IPC Layer

All Tauri calls go through a typed wrapper in `src/lib/tauri.ts`:

```typescript
// Typed invoke wrapper
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>

// Event listener wrapper
export function listen<T>(event: string, cb: (payload: T) => void): UnlistenFn
```

Scan progress is streamed via **Tauri events** (`emit` from Rust, `listen` in React) rather than polling.

---

## Backend Architecture

### Error Handling

```rust
// src/error.rs
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Permission denied: {0}")]
    Permission(String),
    #[error("Platform not supported: {0}")]
    Unsupported(String),
    #[error("Scan failed: {0}")]
    ScanFailed(String),
}

// All commands return Result<T, AppError>
```

### Scanner Trait

```rust
// src/scanner/mod.rs
#[async_trait]
pub trait Scanner: Send + Sync {
    fn name(&self) -> &'static str;
    fn category(&self) -> ScanCategory;
    async fn scan(&self, opts: &ScanOptions) -> Result<Vec<ScanItem>, AppError>;
}
```

Each scanner implementation (junk, trash, large files, etc.) implements this trait and is registered in the orchestrator.

### Platform Abstraction

```rust
// src/platform/mod.rs
pub trait PlatformPaths: Send + Sync {
    fn cache_dirs(&self) -> Vec<PathBuf>;
    fn log_dirs(&self) -> Vec<PathBuf>;
    fn temp_dirs(&self) -> Vec<PathBuf>;
    fn trash_paths(&self) -> Vec<PathBuf>;
    fn app_support_dirs(&self) -> Vec<PathBuf>;
    fn startup_entries(&self) -> Result<Vec<StartupEntry>, AppError>;
}

pub fn current_platform() -> Box<dyn PlatformPaths> {
    #[cfg(target_os = "macos")]   { Box::new(macos::MacOsPlatform) }
    #[cfg(target_os = "windows")] { Box::new(windows::WindowsPlatform) }
    #[cfg(target_os = "linux")]   { Box::new(linux::LinuxPlatform) }
}
```

### Scan Flow

```
Frontend: invoke("start_scan", { categories: [...] })
         │
         ▼
Rust: commands::scan::start_scan()
      │  Creates ScanOrchestrator
      │  Spawns tokio::spawn for each Scanner
      │  Each scanner emits progress events:
      │    app.emit("scan_progress", ScanProgressEvent { ... })
      │
      ▼
Frontend: listen("scan_progress", handler)
          Updates Zustand store → re-renders progress UI
         │
         ▼
Rust: All scanners complete → returns ScanResults
Frontend: Updates store.scanResults → shows results page
```

### Clean Flow

```
Frontend: invoke("clean_items", { item_ids: [...] })
         │
         ▼
Rust: commands::clean::clean_items()
      │  Safety check: no system-critical paths
      │  For each item:
      │    - Write to undo log (path + metadata)
      │    - Move to OS trash OR permanently delete (per settings)
      │    - Emit progress event
      │
      ▼
Frontend: listen("clean_progress", handler) → shows progress
          On complete: shows space freed + toast
```

---

## Key Dependencies

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3 | UI framework |
| `typescript` | ^5.4 | Type safety |
| `@tauri-apps/api` | ^2.0 | Tauri IPC |
| `zustand` | ^4.5 | State management |
| `tailwindcss` | ^3.4 | Utility CSS |
| `lucide-react` | ^0.400 | Icons |
| `react-window` | ^1.8 | Virtualized lists |
| `recharts` | ^2.12 | Disk usage charts |
| `framer-motion` | ^11 | Animations |
| `clsx` | ^2 | Conditional classnames |

### Backend (Cargo.toml)

| Crate | Purpose |
|-------|---------|
| `tauri` (2.x) | App framework |
| `tokio` | Async runtime |
| `serde` / `serde_json` | Serialization |
| `thiserror` | Error types |
| `walkdir` | Recursive directory traversal |
| `sha2` | File hashing (duplicate detection) |
| `sysinfo` | CPU/RAM/disk stats |
| `chrono` | File timestamps |
| `regex` | Pattern matching for junk detection |
| `async-trait` | Async traits |
| `rayon` | Parallel scanning |

---

## Security Model

- **No eval, no external URLs** in webview (`csp` strictly set in `tauri.conf.json`)
- **Allowlist** of Tauri APIs: only `invoke`, `event`, `window` used
- **Path validation** in all Rust commands — rejects paths outside user home or known system dirs
- **Undo log** written before every deletion to `~/.aura/undo_log.json`
- **Dry-run mode** available in settings — scans but never deletes

---

## Build & Distribution

```bash
# Development
pnpm tauri dev

# Production build
pnpm tauri build

# Output artifacts:
#   macOS:   aura_x.x.x_aarch64.dmg, aura_x.x.x_x64.dmg
#   Windows: aura_x.x.x_x64-setup.exe, aura_x.x.x_x64.msi
#   Linux:   aura_x.x.x_amd64.deb, aura_x.x.x_amd64.AppImage
```

CI/CD: GitHub Actions with `tauri-action` for matrix builds across all three platforms.
