import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState } from "react";
import {
  Zap, FileX, Trash2, Files, Copy, AppWindow,
  Rocket, ShieldOff, Wrench, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/store";
import {
  type ScanCategory, type ScanResults, type ScanProgress,
  categoryLabel, CATEGORY_COLORS, formatBytes,
} from "@/types";
import { ProgressRing, Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import clsx from "clsx";

const CATEGORY_ICONS: Record<ScanCategory, React.ElementType> = {
  system_junk: FileX,
  trash: Trash2,
  large_files: Files,
  duplicates: Copy,
  privacy: ShieldOff,
  apps: AppWindow,
  startup: Rocket,
  maintenance: Wrench,
};

const ALL_CATEGORIES: ScanCategory[] = [
  "system_junk", "trash", "large_files", "duplicates",
  "privacy", "apps", "startup", "maintenance",
];

// ─────────────────────────────────────────
// Scan Ring
// ─────────────────────────────────────────

function ScanRing({
  status,
  progress,
  progressPct,
  results,
  onScan,
}: {
  status: string;
  progress: ScanProgress | null;
  progressPct: number;
  results: ScanResults | null;
  onScan: () => void;
}) {
  const totalBytes = results?.totalBytes ?? 0;
  const hasResults = status === "complete" && results;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {/* Outer glow ring when scanning */}
        {status === "scanning" && (
          <div
            className="absolute inset-0 rounded-full animate-pulse-slow"
            style={{ boxShadow: "0 0 40px rgba(0,212,170,0.2)" }}
          />
        )}

        <ProgressRing
          value={status === "scanning" ? progressPct : hasResults ? 100 : 0}
          size={180}
          strokeWidth={7}
          glow={hasResults !== false}
        >
          <div className="flex flex-col items-center">
            {status === "idle" && (
              <>
                <Zap size={28} className="text-accent mb-1" strokeWidth={1.5} />
                <span className="text-[11px] text-text-muted">Ready to scan</span>
              </>
            )}
            {status === "scanning" && (
              <>
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse mb-2" />
                <span className="text-[11px] text-accent font-mono">
                  {progress?.category ? categoryLabel(progress.category) : "Scanning…"}
                </span>
                {progress && (
                  <span className="text-[10px] text-text-muted font-mono mt-0.5">
                    {formatBytes(progress.bytesFound)} found
                  </span>
                )}
              </>
            )}
            {status === "complete" && (
              <>
                <span className="font-mono font-medium text-[22px] text-text-primary">
                  {formatBytes(totalBytes)}
                </span>
                <span className="text-[10px] text-text-muted mt-0.5">to clean</span>
              </>
            )}
            {status === "error" && (
              <span className="text-[11px] text-danger">Scan failed</span>
            )}
          </div>
        </ProgressRing>
      </div>

      <Button
        variant="primary"
        size="lg"
        icon={Zap}
        loading={status === "scanning"}
        onClick={onScan}
        className="w-44 shadow-glow"
      >
        {status === "complete" ? "Re-scan" : "Smart Scan"}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────
// Category Card
// ─────────────────────────────────────────

function CategoryCard({
  category,
  results,
  scanStatus,
  currentCategory,
  completedCategories,
}: {
  category: ScanCategory;
  results: ScanResults | null;
  scanStatus: string;
  currentCategory: ScanCategory | null;
  completedCategories: Set<ScanCategory>;
}) {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_COLORS[category];
  const catResult = results?.byCategory[category];
  const hasResults = catResult && catResult.itemCount > 0;

  const isScanning = scanStatus === "scanning" && currentCategory === category;
  const isCompleted = scanStatus === "scanning" && completedCategories.has(category);
  const isPending = scanStatus === "scanning" && !isScanning && !isCompleted;

  const pageMap: Record<ScanCategory, string> = {
    system_junk: "system_junk",
    trash: "trash",
    large_files: "large_files",
    duplicates: "duplicates",
    privacy: "privacy",
    apps: "app_uninstaller",
    startup: "startup",
    maintenance: "maintenance",
  };

  return (
    <Card
      accentColor={
        (hasResults || isCompleted || isScanning) ? color : undefined
      }
      interactive
      onClick={() => setCurrentPage(pageMap[category] as never)}
      className={clsx(
        "group",
        isScanning && "animate-scan-pulse",
        isPending && "opacity-50",
      )}
      style={
        isScanning
          ? { borderLeft: `2px solid ${color}`, ["--scan-pulse-color" as string]: `${color}40` }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isScanning && "animate-pulse",
          )}
          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
        >
          {isCompleted && !isScanning ? (
            <span style={{ color, fontSize: 13, fontWeight: 700 }}>&#10003;</span>
          ) : (
            <Icon size={15} style={{ color }} strokeWidth={1.8} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-text-primary">{categoryLabel(category)}</div>
          <div className="text-[11px] font-mono text-text-muted mt-0.5">
            {isScanning && (
              <span className="text-accent">Scanning…</span>
            )}
            {isCompleted && !results && (
              <span style={{ color }}>Done</span>
            )}
            {!isScanning && !isCompleted && !results && "—"}
            {!isScanning && results && !hasResults && "Nothing found"}
            {!isScanning && hasResults && (
              <span style={{ color }}>
                {formatBytes(catResult.totalBytes)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          size={13}
          className="text-text-muted group-hover:text-text-secondary transition-colors"
        />
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────
// Dashboard Root
// ─────────────────────────────────────────

export default function Dashboard() {
  const {
    scanStatus,
    scanProgress,
    scanResults,
    setScanStatus,
    setScanProgress,
    setScanResults,
    addToast,
    systemStats,
    settings,
  } = useAppStore();
  const [cleaning, setCleaning] = useState(false);
  const [completedCategories, setCompletedCategories] = useState<Set<ScanCategory>>(new Set());

  const progressPct = Math.round((completedCategories.size / ALL_CATEGORIES.length) * 100);

  async function handleScan() {
    setScanStatus("scanning");
    setScanProgress(null);
    setScanResults(null);
    setCompletedCategories(new Set());

    const unlisten = await listen<ScanProgress>("scan_progress", (e) => {
      setScanProgress(e.payload);
      if (e.payload.phase === "complete") {
        setCompletedCategories((prev) => new Set(prev).add(e.payload.category));
      }
    });

    try {
      const results = await invoke<ScanResults>("start_scan", {
        options: { categories: ALL_CATEGORIES },
      });
      setScanResults(results);
      setScanStatus("complete");
      addToast({
        type: "success",
        title: "Scan complete",
        description: `${formatBytes(results.totalBytes)} found across ${results.items.length} items`,
      });
    } catch (e) {
      setScanStatus("error");
      addToast({ type: "error", title: "Scan failed", description: String(e) });
    } finally {
      unlisten();
    }
  }

  async function handleCleanAll() {
    if (!scanResults) return;
    const allIds = scanResults.items.map((i) => i.id);
    if (allIds.length === 0) return;

    setCleaning(true);
    try {
      const result = await invoke<{ itemsCleaned: number; bytesFreed: number }>("clean_items", {
        itemIds: allIds,
        permanent: settings.deleteMode === "permanent",
      });
      addToast({
        type: "success",
        title: "Clean complete",
        description: `Removed ${result.itemsCleaned} items (${formatBytes(result.bytesFreed)})`,
      });
      // Backend removes cleaned items from scan state cache; pull the updated state
      const cached = await invoke<ScanResults | null>("get_scan_results");
      if (cached && cached.items.length > 0) {
        setScanResults(cached);
      } else {
        setScanResults(null);
        setScanStatus("idle");
      }
    } catch (e) {
      addToast({ type: "error", title: "Clean failed", description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  const healthScore = systemStats?.healthScore ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Hero section */}
      <div className="flex flex-col items-center pt-10 pb-8 px-8 border-b border-border-subtle">
        <ScanRing
          status={scanStatus}
          progress={scanProgress}
          progressPct={progressPct}
          results={scanResults}
          onScan={handleScan}
        />

        {/* Health score */}
        {systemStats && (
          <div className="flex items-center gap-2 mt-4">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: healthScore > 70 ? "#22C987" : healthScore > 40 ? "#F59E0B" : "#EF4444" }}
            />
            <span className="text-[11px] text-text-muted font-mono">
              System health:{" "}
              <span
                className="font-medium"
                style={{ color: healthScore > 70 ? "#22C987" : healthScore > 40 ? "#F59E0B" : "#EF4444" }}
              >
                {healthScore}/100
              </span>
            </span>
          </div>
        )}

        {/* Clean All button after scan completes */}
        {scanStatus === "complete" && scanResults && scanResults.items.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            loading={cleaning}
            onClick={handleCleanAll}
            className="mt-4"
          >
            Clean All ({formatBytes(scanResults.totalBytes)})
          </Button>
        )}
      </div>

      {/* Category grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className={clsx(
            "text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-3",
            !scanResults && "opacity-50"
          )}
        >
          Scan Results
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              results={scanResults}
              scanStatus={scanStatus}
              currentCategory={scanProgress?.category ?? null}
              completedCategories={completedCategories}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
