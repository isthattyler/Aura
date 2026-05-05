import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useRef } from "react";
import {
  FileX, Trash2, ShieldOff, Square, Sparkles, RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/store";
import {
  type ScanCategory, type ScanProgress, type QuickCleanResult,
  categoryLabel, CATEGORY_COLORS, formatBytes,
} from "@/types";
import { ProgressRing } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import clsx from "clsx";

const QC_CATEGORIES: ScanCategory[] = ["system_junk", "trash", "privacy"];

const CATEGORY_ICONS: Record<ScanCategory, React.ElementType> = {
  system_junk: FileX,
  trash: Trash2,
  large_files: () => null,
  duplicates: () => null,
  privacy: ShieldOff,
  apps: () => null,
  startup: () => null,
  maintenance: () => null,
};

export default function QuickClean() {
  const addToast = useAppStore((s) => s.addToast);

  const [status, setStatus] = useState<"idle" | "scanning" | "cleaning" | "complete" | "error">("idle");
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [accumulatedBytes, setAccumulatedBytes] = useState(0);
  const [results, setResults] = useState<QuickCleanResult | null>(null);
  const stoppedRef = useRef(false);

  const progressPct = Math.round((completedCategories.length / QC_CATEGORIES.length) * 100);
  const hasResults = status === "complete" && results !== null;

  async function handleQuickClean() {
    stoppedRef.current = false;
    setStatus("scanning");
    setCompletedCategories([]);
    setAccumulatedBytes(0);
    setResults(null);

    const unlisten = await listen<ScanProgress>("scan_progress", (e) => {
      if (stoppedRef.current) return;
      setProgress(e.payload);
      if (e.payload.phase === "complete") {
        setCompletedCategories((prev) => {
          if (prev.includes(e.payload.category)) return prev;
          return [...prev, e.payload.category];
        });
        setAccumulatedBytes((prev) => prev + e.payload.bytesFound);
      }
    });

    const unlistenClean = listen<{ phase: string }>("quick_clean_status", (e) => {
      if (e.payload.phase === "cleaning") {
        setStatus("cleaning");
      }
    });

    try {
      const result = await invoke<QuickCleanResult>("quick_clean");
      if (stoppedRef.current) return;
      setResults(result);
      setStatus("complete");
      addToast({
        type: "success",
        title: "Quick Clean complete",
        description: `Cleaned ${result.itemsCleaned} items (${formatBytes(result.bytesCleaned)})`,
      });
    } catch (e) {
      if (stoppedRef.current) return;
      setStatus("error");
      addToast({ type: "error", title: "Quick Clean failed", description: String(e) });
    } finally {
      unlisten();
      void unlistenClean.then((fn) => fn());
    }
  }

  async function handleStop() {
    stoppedRef.current = true;
    await invoke("cancel_scan").catch(() => {});
    setStatus("idle");
    setProgress(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center pt-10 pb-8 px-8 border-b border-border-subtle">
        {/* Progress Ring */}
        <div className="relative">
          {(status === "scanning" || status === "cleaning") && (
            <div
              className="absolute inset-0 rounded-full animate-pulse-slow"
              style={{ boxShadow: status === "cleaning" ? "0 0 40px rgba(250,204,21,0.25)" : "0 0 40px rgba(0,212,170,0.2)" }}
            />
          )}

          <ProgressRing
            value={status === "scanning" ? progressPct : status === "cleaning" ? 100 : hasResults ? 100 : 0}
            size={180}
            strokeWidth={7}
            glow={hasResults || status === "cleaning"}
          >
            <div className="flex flex-col items-center">
              {status === "idle" && (
                <>
                  <Sparkles size={28} className="text-accent mb-1" strokeWidth={1.5} />
                  <span className="text-[11px] text-text-muted">Quick Clean</span>
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
              {status === "cleaning" && (
                <>
                  <RefreshCw size={22} className="text-warning animate-spin mb-1" strokeWidth={1.5} />
                  <span className="text-[11px] text-warning font-mono">Cleaning…</span>
                </>
              )}
              {status === "complete" && results && (
                <>
                  <span className="font-mono font-medium text-[22px] text-text-primary">
                    {formatBytes(results.bytesCleaned)}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5">cleaned</span>
                </>
              )}
              {status === "error" && (
                <span className="text-[11px] text-danger">Quick Clean failed</span>
              )}
            </div>
          </ProgressRing>
        </div>

        {/* Action button */}
        {status === "scanning" ? (
          <Button
            variant="secondary"
            size="lg"
            icon={Square}
            onClick={handleStop}
            className="w-44 bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 mt-6"
          >
            Stop
          </Button>
        ) : status === "cleaning" ? (
          <Button
            variant="secondary"
            size="lg"
            icon={RefreshCw}
            disabled
            className="w-44 opacity-60 cursor-not-allowed mt-6"
          >
            Cleaning…
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            icon={Sparkles}
            onClick={handleQuickClean}
            className="w-44 shadow-glow mt-6"
          >
            {status === "complete" ? "Run Again" : "Quick Clean"}
          </Button>
        )}
      </div>

      {/* Category cards */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-3">
          {status === "scanning" ? "Scanning" : hasResults ? "Results" : "Categories"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QC_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            const color = CATEGORY_COLORS[cat];
            const catResult = results?.scanResults.byCategory[cat];
            const catHasItems = catResult && catResult.itemCount > 0;

            const isScanning = status === "scanning" && progress?.category === cat;
            const isCompleted = status === "scanning" && completedCategories.includes(cat);
            const isPending = status === "scanning" && !isScanning && !isCompleted;

            return (
              <div
                key={cat}
                className={clsx(
                  "flex items-center gap-3 p-3 rounded-lg border border-border-subtle bg-bg-surface transition-all duration-200",
                  isScanning && "animate-scan-pulse",
                  isPending && "opacity-50",
                )}
                style={
                  isScanning
                    ? { borderLeft: `2px solid ${color}`, ["--scan-pulse-color" as string]: `${color}40` }
                    : catHasItems
                      ? { borderLeft: `2px solid ${color}` }
                      : undefined
                }
              >
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
                  <div className="text-[12px] font-medium text-text-primary">{categoryLabel(cat)}</div>
                  <div className="text-[11px] font-mono text-text-muted mt-0.5">
                    {isScanning && <span className="text-accent">Scanning…</span>}
                    {isCompleted && !results && <span style={{ color }}>Done</span>}
                    {!isScanning && !isCompleted && !results && "—"}
                    {!isScanning && results && !catHasItems && "Nothing found"}
                    {!isScanning && catHasItems && (
                      <span style={{ color }}>{formatBytes(catResult.totalBytes)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
