import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useRef } from "react";
import {
  Zap, FileX, Trash2, Files, Copy, AppWindow,
  Rocket, ShieldOff, Wrench, ChevronRight, Square,
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
  accumulatedBytes,
  onScan,
  onStop,
}: {
  status: string;
  progress: ScanProgress | null;
  progressPct: number;
  results: ScanResults | null;
  accumulatedBytes: number;
  onScan: () => void;
  onStop: () => void;
}) {
  const totalBytes = results?.totalBytes ?? 0;
  const hasResults = status === "complete" && results;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
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
                <span className="text-[10px] text-text-muted font-mono mt-0.5">
                  {formatBytes(accumulatedBytes)} found
                </span>
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

      {status === "scanning" ? (
        <Button
          variant="secondary"
          size="lg"
          icon={Square}
          onClick={onStop}
          className="w-44 bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20"
        >
          Stop
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          icon={Zap}
          onClick={onScan}
          className="w-44 shadow-glow"
        >
          {status === "complete" ? "Re-scan" : "Smart Scan"}
        </Button>
      )}
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
  isSelected,
  showCheckbox,
  onToggleSelect,
}: {
  category: ScanCategory;
  results: ScanResults | null;
  scanStatus: string;
  currentCategory: ScanCategory | null;
  completedCategories: Set<ScanCategory>;
  isSelected: boolean;
  showCheckbox: boolean;
  onToggleSelect: () => void;
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
        (showCheckbox && isSelected) ? color :
        (hasResults || isCompleted || isScanning) ? color : undefined
      }
      interactive
      onClick={() => setCurrentPage(pageMap[category] as never)}
      className={clsx(
        "group",
        isScanning && "animate-scan-pulse",
        isPending && "opacity-50",
        showCheckbox && !isSelected && "opacity-60",
      )}
      style={
        isScanning
          ? { borderLeft: `2px solid ${color}`, ["--scan-pulse-color" as string]: `${color}40` }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        {/* Checkbox for Clean All selection — top-left overlay */}
        {showCheckbox && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={clsx(
              "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
              isSelected
                ? "border-transparent"
                : "border-border-default hover:border-border-strong",
            )}
            style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
          >
            {isSelected && (
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

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
            {isScanning && <span className="text-accent">Scanning…</span>}
            {isCompleted && !results && <span style={{ color }}>Done</span>}
            {!isScanning && !isCompleted && !results && "—"}
            {!isScanning && results && !hasResults && "Nothing found"}
            {!isScanning && hasResults && (
              <span style={{ color }}>{formatBytes(catResult.totalBytes)}</span>
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
    categoryBytes,
    completedCategories,
    selectedCategories,
    addCompletedCategory,
    toggleSelectedCategory,
    setSelectedCategories,
    resetScanState,
  } = useAppStore();
  const [cleaning, setCleaning] = useState(false);
  const stoppedRef = useRef(false);

  const accumulatedBytes = Object.values(categoryBytes).reduce((a, b) => a + b, 0);
  const progressPct = Math.round((completedCategories.size / ALL_CATEGORIES.length) * 100);

  async function handleScan() {
    stoppedRef.current = false;
    resetScanState();
    setScanStatus("scanning");

    const unlisten = await listen<ScanProgress>("scan_progress", (e) => {
      if (stoppedRef.current) return;
      setScanProgress(e.payload);
      if (e.payload.phase === "complete") {
        addCompletedCategory(e.payload.category, e.payload.bytesFound);
      }
    });

    try {
      const results = await invoke<ScanResults>("start_scan", {
        options: { categories: ALL_CATEGORIES },
      });
      if (stoppedRef.current) return;
      setScanResults(results);
      setScanStatus("complete");

      // Initialize all categories with results as selected for Clean All
      const catsWithData = ALL_CATEGORIES.filter((cat) => {
        const r = results.byCategory[cat];
        return r && r.itemCount > 0;
      });
      setSelectedCategories(new Set(catsWithData));

      addToast({
        type: "success",
        title: "Scan complete",
        description: `${formatBytes(results.totalBytes)} found across ${results.items.length} items`,
      });
    } catch (e) {
      if (stoppedRef.current) return;
      setScanStatus("error");
      addToast({ type: "error", title: "Scan failed", description: String(e) });
    } finally {
      unlisten();
    }
  }

  async function handleStop() {
    stoppedRef.current = true;
    await invoke("cancel_scan").catch(() => {});
    setScanStatus("idle");
    setScanProgress(null);
  }

  async function handleCleanAll() {
    if (!scanResults) return;
    const itemsToClean = scanResults.items.filter((i) => selectedCategories.has(i.category));
    if (itemsToClean.length === 0) return;

    setCleaning(true);
    try {
      const result = await invoke<{ itemsCleaned: number; bytesFreed: number }>("clean_items", {
        itemIds: itemsToClean.map((i) => i.id),
        permanent: settings.deleteMode === "permanent",
      });
      addToast({
        type: "success",
        title: "Clean complete",
        description: `Removed ${result.itemsCleaned} items (${formatBytes(result.bytesFreed)})`,
      });
      const cached = await invoke<ScanResults | null>("get_scan_results");
      if (cached && cached.items.length > 0) {
        setScanResults(cached);
        const remaining = ALL_CATEGORIES.filter((cat) => {
          const r = cached.byCategory[cat];
          return r && r.itemCount > 0;
        });
        setSelectedCategories(new Set(remaining));
      } else {
        resetScanState();
        setScanStatus("idle");
      }
    } catch (e) {
      addToast({ type: "error", title: "Clean failed", description: String(e) });
    } finally {
      setCleaning(false);
    }
  }

  const healthScore = systemStats?.healthScore ?? 0;

  const catsWithData = scanResults
    ? ALL_CATEGORIES.filter((cat) => {
        const r = scanResults.byCategory[cat];
        return r && r.itemCount > 0;
      })
    : [];

  // Compute selected bytes for Clean All button
  const selectedItems = scanStatus === "complete" && scanResults
    ? scanResults.items.filter((i) => selectedCategories.has(i.category))
    : [];
  const selectedBytes = selectedItems.reduce((s, i) => s + i.sizeBytes, 0);

  const allSelected = catsWithData.length > 0 && catsWithData.every((cat) => selectedCategories.has(cat));
  const cleanButtonLabel = allSelected
    ? "Clean All"
    : `Clean Selected (${formatBytes(selectedBytes)})`;

  const showCheckbox = scanStatus === "complete" && scanResults !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Hero section */}
      <div className="flex flex-col items-center pt-10 pb-8 px-8 border-b border-border-subtle">
        <ScanRing
          status={scanStatus}
          progress={scanProgress}
          progressPct={progressPct}
          results={scanResults}
          accumulatedBytes={accumulatedBytes}
          onScan={handleScan}
          onStop={handleStop}
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
        {scanStatus === "complete" && scanResults && selectedItems.length > 0 && (
          <Button
            variant="danger"
            size="sm"
            loading={cleaning}
            onClick={handleCleanAll}
            className="mt-4"
          >
            {cleanButtonLabel}
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
          {showCheckbox ? "Deselect categories to skip cleaning" : "Scan Results"}
        </div>
        {showCheckbox && catsWithData.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setSelectedCategories(new Set(catsWithData))}
              className="text-[10px] font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedCategories(new Set())}
              className="text-[10px] font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              Uncheck All
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              results={scanResults}
              scanStatus={scanStatus}
              currentCategory={scanProgress?.category ?? null}
              completedCategories={completedCategories}
              isSelected={selectedCategories.has(cat)}
              showCheckbox={showCheckbox}
              onToggleSelect={() => toggleSelectedCategory(cat)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
