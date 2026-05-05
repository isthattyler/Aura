import { useAppStore } from "@/store";
import { categoryLabel, type Page } from "@/types";
import { X, Minus, Square } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import clsx from "clsx";

const PAGE_TITLES: Record<Page, string> = {
  quick_clean: "Quick Clean",
  dashboard: "Smart Scan",
  system_junk: categoryLabel("system_junk"),
  trash: categoryLabel("trash"),
  large_files: categoryLabel("large_files"),
  duplicates: categoryLabel("duplicates"),
  app_uninstaller: "App Uninstaller",
  startup: "Startup Manager",
  privacy: "Privacy",
  disk: "Disk Space",
  maintenance: "Maintenance",
  settings: "Settings",
};

// ─────────────────────────────────────────
// Custom Window Controls (Win/Linux)
// ─────────────────────────────────────────

function WindowControls() {
  const platform = useAppStore((s) => s.platform);
  if (platform === "macos") return null;

  const win = getCurrentWindow();

  return (
    <div className="flex items-center gap-1 pl-2">
      <button
        onClick={() => win.minimize()}
        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-all duration-150"
        aria-label="Minimize"
      >
        <Minus size={12} />
      </button>
      <button
        onClick={() => win.toggleMaximize()}
        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-all duration-150"
        aria-label="Maximize"
      >
        <Square size={11} />
      </button>
      <button
        onClick={() => win.close()}
        className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-150"
        aria-label="Close"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// TopBar Root
// ─────────────────────────────────────────

export default function TopBar() {
  const { currentPage, scanStatus, platform } = useAppStore();
  const title = PAGE_TITLES[currentPage];

  return (
    <header
      data-tauri-drag-region
      className={clsx(
        "flex items-center justify-between h-[52px] px-6 border-b border-border-subtle bg-bg-base shrink-0",
        platform === "macos" && "macos-traffic-offset"
      )}
    >
      <div className="flex items-center gap-3">
        <h1 className="font-display font-semibold text-[17px] text-text-primary tracking-[-0.01em]">
          {title}
        </h1>
        {scanStatus === "scanning" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-dim border border-accent/20">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] text-accent font-medium font-mono">Scanning</span>
          </div>
        )}
      </div>

      <WindowControls />
    </header>
  );
}
