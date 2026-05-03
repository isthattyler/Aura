import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileX, Folder, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store";
import { type ScanItem, formatBytes, CATEGORY_COLORS } from "@/types";
import { Card, Badge, SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PermissionDialog from "@/components/PermissionDialog";

const SUBCATEGORIES = [
  { key: "caches", label: "User Caches", description: "App and system cache files" },
  { key: "logs", label: "Log Files", description: "Application and system logs" },
  { key: "temp", label: "Temp Files", description: "Temporary files left behind" },
  { key: "lang_packs", label: "Language Packs", description: "Unused language resources" },
  { key: "broken_prefs", label: "Broken Preferences", description: "Orphaned preference files" },
];

export default function SystemJunk() {
  const { addToast, setActionSheetOpen, selectedItemIds, toggleItemSelection, scanResults, scanStatus } = useAppStore();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [showPermission, setShowPermission] = useState(false);

  const color = CATEGORY_COLORS.system_junk;
  const totalBytes = items.reduce((s, i) => s + i.sizeBytes, 0);
  const selectedCount = items.filter((i) => selectedItemIds.has(i.id)).length;

  // Use cached Smart Scan results if available
  useEffect(() => {
    if (scanStatus === "complete" && scanResults) {
      const cachedItems = scanResults.items.filter((i) => i.category === "system_junk");
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
      const result = await invoke<ScanItem[]>("scan_category", { category: "system_junk" });
      setItems(result);
      setScanned(true);
    } catch (e) {
      addToast({ type: "error", title: "Scan failed", description: String(e) });
    } finally {
      setScanning(false);
    }
  }

  // Group by subcategory label
  const groups = SUBCATEGORIES.map((sub) => ({
    ...sub,
    items: items.filter((i) => i.description.toLowerCase().includes(sub.key)),
    bytes: items
      .filter((i) => i.description.toLowerCase().includes(sub.key))
      .reduce((s, i) => s + i.sizeBytes, 0),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <FileX size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">Space recoverable</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {scanned ? formatBytes(totalBytes) : "—"}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedCount > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActionSheetOpen(true)}
              >
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

      {/* Content */}
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
            <FileX size={36} className="text-text-muted opacity-40" />
            <p className="text-[13px] text-text-muted">
              Scan to discover junk files on your system
            </p>
            <Button variant="primary" onClick={handleScan}>Start Scan</Button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size={28} />
            <p className="text-[13px] text-text-secondary">Scanning system junk…</p>
          </div>
        )}

        {scanned && (
          <div className="space-y-4">
            {items.length > 0 && (
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
            )}
            {groups.map((group) => (
              group.items.length > 0 && (
                <Card key={group.key} accentColor={color}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Folder size={14} style={{ color }} />
                      <span className="text-[13px] font-medium text-text-primary">{group.label}</span>
                      <Badge variant="muted">{group.items.length} files</Badge>
                    </div>
                    <SizeLabel bytes={group.bytes} />
                  </div>

                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-bg-overlay cursor-pointer transition-colors"
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-3.5 h-3.5 accent-[#00D4AA] cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="flex-1 text-[12px] text-text-secondary font-mono truncate">
                          {item.path}
                        </span>
                        <SizeLabel bytes={item.sizeBytes} dim />
                      </div>
                    ))}
                  </div>
                </Card>
              )
            ))}

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <div className="text-[28px]">✨</div>
                <p className="text-[13px] font-medium text-text-primary">Your system is clean</p>
                <p className="text-[12px] text-text-muted">No junk files found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
