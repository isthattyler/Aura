# Aura — Agent Guide

## Commands

| Action | Command |
|--------|---------|
| Dev server | `pnpm tauri:dev` |
| Frontend-only dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint (zero warnings) | `pnpm lint` |
| Build both | `pnpm build` (tsc && vite build) |
| Tauri build | `pnpm tauri build` |
| Tauri CLI passthrough | `pnpm tauri <args>` |

## Key facts

- **Package manager**: pnpm (NOT npm). Lockfile is `pnpm-lock.yaml`.
- **Path alias**: `@/` → `./src/` (configured in both `vite.config.ts` and `tsconfig.json`)
- **Frontend framework**: React 18 + TypeScript + Tailwind CSS v3
- **State management**: Zustand — single store in `src/store/index.ts` with slices for nav, scan, clean, system stats, toasts, settings
- **Routing**: Client-side only, no URL router — navigation lives in Zustand (`currentPage`), pages are `React.lazy()` + `Suspense`
- **IPC**: Typed wrappers via `@tauri-apps/api/core` (`invoke`) and `@tauri-apps/api/event` (`listen`). All Rust commands registered in `src-tauri/src/lib.rs`
- **Dev server port**: `1420` (fixed, strict)
- **Vite ignores `src-tauri/`** during watch
- **No tests configured** yet (no test runner in dependencies, no test files)
- **Lint is strict**: `--max-warnings 0`

## Architecture

- **Frontend** (`src/`): `main.tsx` → `App.tsx` (layout shell + lazy page routing) → pages use hooks/`invoke` for data
- **Backend** (`src-tauri/src/`): `main.rs` calls `aura_lib::run()` in `lib.rs`. Commands in `commands/`, scanners in `scanner/`, cleaners in `cleaner/`, platform adapters in `platform/`, shared structs in `models/`
- Scan results stream via Tauri events (`scan_progress`, `scan_complete`, `scan_error`) — not polling
- Safety: undo log at `~/.aura/undo_log.json`, protected-path deny list, trash-by-default

## Rust backend structure

- Crate name: `aura_lib` (staticlib + cdylib + rlib)
- Platform dispatch via cfg: `macos.rs`, `windows.rs`, `linux.rs` implement `PlatformPaths` trait
- Debug builds auto-open DevTools in `lib.rs:setup()`
- `#[tauri::command]` fns all return `Result<T, AppError>` (serialized as `{ kind, message }`)`
- Models must use `serde::Serialize/Deserialize` for IPC

## CI

- Only on `v*` tag pushes or `workflow_dispatch`
- Matrix: macOS (aarch64 + x86_64), Ubuntu 22.04, Windows
- Requires `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets for release

## Design system

- Custom Tailwind colors: `bg-{base,surface,elevated,overlay}`, `border-{subtle,default,strong}`, `text-{primary,secondary,muted}`, `accent-{DEFAULT,dim,hover}`, semantic `success/warning/danger/info`
- Category colors: `junk/trash/files/apps/privacy/startup/disk/maintenance`
- Fonts: `Bricolage Grotesque` (display), `DM Sans` (body), `DM Mono` (mono) — loaded from Google Fonts in `index.html`
- Spacing: 4px base grid
- Animations: `fade-up`, `fade-in`, `slide-in-right` (defined in Tailwind config and `index.css`)
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables all transitions

## Generated artifacts (don't commit)

- `src-tauri/target/`, `src-tauri/gen/`, `dist/`
- `*.dmg`, `*.deb`, `*.AppImage`, `*.msi`, `*.exe`
