import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Files, RefreshCw, ArrowUpDown } from "lucide-react";
import { useAppStore } from "@/store";
import { type ScanItem, formatBytes, CATEGORY_COLORS } from "@/types";
import { SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PermissionDialog from "@/components/PermissionDialog";

type SortKey = "size" | "name" | "accessed";

export default function LargeFiles() {
  const { settings, addToast, setActionSheetOpen, selectedItemIds, toggleItemSelection, scanResults, scanStatus } = useAppStore();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [showPermission, setShowPermission] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [sortAsc, setSortAsc] = useState(false);

  const color = CATEGORY_COLORS["large_files"];
  const totalBytes = items.reduce((s, i) => s + i.sizeBytes, 0);
  const selectedCount = items.filter((i) => selectedItemIds.has(i.id)).length;

  // Use cached Smart Scan results if available
  useEffect(() => {
    if (scanStatus === "complete" && scanResults) {
      const cachedItems = scanResults.items.filter((i) => i.category === "large_files");
      if (cachedItems.length > 0) {
        setItems(cachedItems);
        setScanned(true);
      }
    }
  }, [scanStatus, scanResults]);

  async function handleScan() {
    try {
      const ok = await invoke<boolean>("check_permission");
      if (!ok) {
        setShowPermission(true);
        return;
      }
    } catch {
      // Permission check failed / not supported — proceed anyway
    }
    performScan();
  }

  async function performScan() {
    setScanning(true);
    setScanned(false);
    try {
      const result = await invoke<ScanItem[]>("scan_category", {
        category: "large_files",
        options: {
          largeFileSizeThresholdMb: settings.largeFileSizeThresholdMb,
          largeFileAgeThresholdDays: settings.largeFileAgeThresholdDays,
        },
      });
      setItems(result);
      setScanned(true);
    } catch (e) {
      addToast({ type: "error", title: "Scan failed", description: String(e) });
    } finally {
      setScanning(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "size");
    }
  }

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "size") cmp = a.sizeBytes - b.sizeBytes;
    else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "accessed") cmp = (a.lastAccessed ?? "").localeCompare(b.lastAccessed ?? "");
    return sortAsc ? cmp : -cmp;
  });

  function SortHeader({ label, sort }: { label: string; sort: SortKey }) {
    const active = sortKey === sort;
    return (
      <button
        onClick={() => toggleSort(sort)}
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted hover:text-text-secondary transition-colors"
      >
        {label}
        <ArrowUpDown size={10} className={active ? "text-accent" : ""} />
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Files size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">
              {scanned ? `${items.length} files found` : "Large & old files"}
            </div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {scanned ? formatBytes(totalBytes) : "—"}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedCount > 0 && (
              <Button variant="danger" size="sm" onClick={() => setActionSheetOpen(true)}>
                Clean {selectedCount} items
              </Button>
            )}
            <Button
              variant={scanned ? "secondary" : "primary"}
              size="sm"
              icon={scanned ? RefreshCw : undefined}
              loading={scanning}
              onClick={handleScan}
            >
              {scanned ? "Re-scan" : "Scan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showPermission && (
          <PermissionDialog
            onRetry={() => {
              setShowPermission(false);
              handleScan();
            }}
            onDismiss={() => setShowPermission(false)}
          />
        )}

        {!scanned && !scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Files size={36} className="text-text-muted opacity-40" />
            <p className="text-[13px] text-text-muted">
              Find files over {settings.largeFileSizeThresholdMb} MB untouched for {settings.largeFileAgeThresholdDays}+ days
            </p>
            <Button variant="primary" onClick={handleScan}>Start Scan</Button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size={28} />
            <p className="text-[13px] text-text-secondary">Scanning for large files…</p>
          </div>
        )}

        {scanned && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <div className="text-[28px]">✅</div>
            <p className="text-[13px] font-medium text-text-primary">No large files found</p>
            <p className="text-[12px] text-text-muted">Adjust thresholds in Settings to widen the search</p>
          </div>
        )}

        {scanned && items.length > 0 && (
          <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-bg-elevated/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => items.forEach((i) => { if (!selectedItemIds.has(i.id)) toggleItemSelection(i.id); })}
                  className="text-[10px] font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => items.forEach((i) => { if (selectedItemIds.has(i.id)) toggleItemSelection(i.id); })}
                  className="text-[10px] font-medium text-text-muted hover:text-text-secondary transition-colors"
                >
                  Uncheck All
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border-subtle bg-bg-elevated/50">
              <div className="w-4" />
              <SortHeader label="Name" sort="name" />
              <div className="flex-1" />
              <SortHeader label="Size" sort="size" />
              <SortHeader label="Accessed" sort="accessed" />
            </div>
            <div className="divide-y divide-border-subtle">
              {sorted.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-overlay cursor-pointer transition-colors"
                  onClick={() => toggleItemSelection(item.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="w-3.5 h-3.5 accent-[#00D4AA] cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-text-primary truncate">{item.name}</div>
                    <div className="text-[11px] font-mono text-text-muted truncate">{item.path}</div>
                  </div>
                  <SizeLabel bytes={item.sizeBytes} />
                  <span className="text-[10px] font-mono text-text-muted w-20 text-right">
                    {item.lastAccessed ? item.lastAccessed.slice(0, 10) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
