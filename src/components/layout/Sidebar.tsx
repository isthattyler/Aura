import {
  Zap, Sparkles,
  Trash2,
  FileX,
  Files,
  Copy,
  AppWindow,
  Rocket,
  ShieldOff,
  HardDrive,
  Wrench,
  Settings,
  Cpu,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { Page } from "@/types";
import { formatBytes } from "@/types";
import clsx from "clsx";

// ─────────────────────────────────────────
// Nav Definitions
// ─────────────────────────────────────────

interface NavItem {
  page: Page;
  label: string;
  icon: React.ElementType;
  color?: string;
}

const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "",
    items: [
      { page: "quick_clean", label: "Quick Clean", icon: Sparkles, color: "#F59E0B" },
      { page: "dashboard", label: "Smart Scan", icon: Zap, color: "#00D4AA" },
    ],
  },
  {
    heading: "Cleaner",
    items: [
      { page: "system_junk", label: "System Junk", icon: FileX, color: "#F59E0B" },
      { page: "trash", label: "Trash Bins", icon: Trash2, color: "#EF4444" },
      { page: "large_files", label: "Large & Old Files", icon: Files, color: "#8B5CF6" },
      { page: "duplicates", label: "Duplicates", icon: Copy, color: "#6366F1" },
    ],
  },
  {
    heading: "Manager",
    items: [
      { page: "app_uninstaller", label: "App Uninstaller", icon: AppWindow, color: "#3B82F6" },
      { page: "startup", label: "Startup Manager", icon: Rocket, color: "#10B981" },
    ],
  },
  {
    heading: "System",
    items: [
      { page: "privacy", label: "Privacy", icon: ShieldOff, color: "#EC4899" },
      { page: "disk", label: "Disk Space", icon: HardDrive, color: "#06B6D4" },
      { page: "maintenance", label: "Maintenance", icon: Wrench, color: "#F97316" },
    ],
  },
];

// ─────────────────────────────────────────
// Nav Item Component
// ─────────────────────────────────────────

function NavLink({ item }: { item: NavItem }) {
  const { currentPage, setCurrentPage } = useAppStore();
  const isActive = currentPage === item.page;
  const Icon = item.icon;

  return (
    <button
      onClick={() => setCurrentPage(item.page)}
      className={clsx(
        "flex items-center gap-2.5 w-full px-3 py-[7px] rounded-md text-left transition-all duration-150",
        isActive
          ? "bg-bg-overlay text-text-primary"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
      )}
    >
      <Icon
        size={15}
        strokeWidth={1.8}
        style={{ color: isActive ? (item.color ?? "var(--color-accent)") : undefined }}
        className={clsx(!isActive && "text-text-muted group-hover:text-text-secondary")}
      />
      <span className="text-[12.5px] font-medium tracking-[0.01em]">{item.label}</span>
      {isActive && (
        <span
          className="ml-auto w-1 h-1 rounded-full"
          style={{ backgroundColor: item.color ?? "var(--color-accent)" }}
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────
// System Stats Mini Display
// ─────────────────────────────────────────

function SystemMini() {
  const stats = useAppStore((s) => s.systemStats);
  if (!stats) return null;

  const diskPct = Math.round((stats.diskUsedBytes / stats.diskTotalBytes) * 100);
  const ramPct  = Math.round((stats.ramUsedBytes / stats.ramTotalBytes) * 100);

  return (
    <div className="px-3 py-3 border-t border-border-subtle">
      <div className="space-y-2">
        <StatBar label="Disk" pct={diskPct} value={formatBytes(stats.diskTotalBytes - stats.diskUsedBytes) + " free"} color="#06B6D4" />
        <StatBar label="RAM" pct={ramPct} value={formatBytes(stats.ramUsedBytes)} color="#8B5CF6" />
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <Cpu size={11} className="text-text-muted" />
            <span className="text-[11px] text-text-muted font-mono">CPU</span>
          </div>
          <span
            className="text-[11px] font-mono font-medium"
            style={{ color: stats.cpuUsagePercent > 80 ? "#EF4444" : "#8A97AA" }}
          >
            {Math.round(stats.cpuUsagePercent)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, pct, value, color }: { label: string; pct: number; value: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted font-mono">{label}</span>
        <span className="text-[11px] text-text-muted font-mono">{value}</span>
      </div>
      <div className="h-[3px] rounded-full bg-bg-overlay overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: pct > 85 ? "#EF4444" : color }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Sidebar Root
// ─────────────────────────────────────────

export default function Sidebar() {
  const platform = useAppStore((s) => s.platform);

  return (
    <aside
      className="flex flex-col w-[220px] shrink-0 bg-bg-surface border-r border-border-subtle overflow-hidden"
    >
      {/* Logo / App Name */}
      <div
        data-tauri-drag-region
        className={clsx(
          "flex items-center h-[52px] px-4 border-b border-border-subtle shrink-0",
          platform === "macos" && "macos-traffic-offset"
        )}
      >
        <div className="flex items-center gap-2.5">
          <img src="/app-icon.png" alt="" className="w-6 h-6 rounded-md" />
          <span className="font-display font-700 text-[15px] tracking-tight text-text-primary">
            Aura
          </span>
          <span className="text-[10px] font-mono text-text-muted ml-0.5 mt-0.5">v0.1</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mb-1">
            {section.heading && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {section.heading}
                </span>
              </div>
            )}
            {section.items.map((item) => (
              <NavLink key={item.page} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* System Stats */}
      <SystemMini />

      {/* Settings */}
      <div className="px-2 py-2 border-t border-border-subtle">
        <button
          onClick={() => useAppStore.getState().setCurrentPage("settings")}
          className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all duration-150"
        >
          <Settings size={14} strokeWidth={1.8} />
          <span className="text-[12.5px] font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
