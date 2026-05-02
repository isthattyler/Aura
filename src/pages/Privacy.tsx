import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldOff, RefreshCw, Globe, Lock } from "lucide-react";
import { useAppStore } from "@/store";
import { type BrowserType, formatBytes, CATEGORY_COLORS } from "@/types";
import { useScanCategory } from "@/hooks/useScan";
import { Card, SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import PermissionDialog from "@/components/PermissionDialog";
import clsx from "clsx";

const BROWSERS: { key: BrowserType; label: string }[] = [
  { key: "chrome", label: "Chrome" },
  { key: "firefox", label: "Firefox" },
  { key: "safari", label: "Safari" },
  { key: "edge", label: "Edge" },
  { key: "brave", label: "Brave" },
  { key: "opera", label: "Opera" },
];

export default function Privacy() {
  const { setActionSheetOpen, selectedItemIds, toggleItemSelection } = useAppStore();
  const { items, scanning, scanned, scan: doScan } = useScanCategory("privacy");
  const [activeBrowser, setActiveBrowser] = useState<BrowserType>("chrome");
  const [showPermission, setShowPermission] = useState(false);

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
    doScan();
  }

  const color = CATEGORY_COLORS.privacy;
  const browserItems = useMemo(() => items.filter((i) => i.description.toLowerCase().includes(activeBrowser)), [items, activeBrowser]);
  const selectedCount = browserItems.filter((i) => selectedItemIds.has(i.id)).length;

  const browserTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      for (const b of BROWSERS) {
        if (item.description.toLowerCase().includes(b.key)) {
          map[b.key] = (map[b.key] ?? 0) + item.sizeBytes;
        }
      }
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <ShieldOff size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">
              {scanned ? `${items.length} artifacts across ${Object.keys(browserTotals).length} browsers` : "Browser privacy data"}
            </div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {scanned ? formatBytes(items.reduce((s, i) => s + i.sizeBytes, 0)) : "—"}
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
            <ShieldOff size={36} className="text-text-muted opacity-40" />
            <p className="text-[13px] text-text-muted">Scan browser caches, history, and cookies</p>
            <Button variant="primary" onClick={handleScan}>Start Scan</Button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size={28} />
            <p className="text-[13px] text-text-secondary">Scanning browser data…</p>
          </div>
        )}

        {scanned && (
          <>
            {/* Browser tabs */}
            <div className="flex gap-1 mb-5 flex-wrap">
              {BROWSERS.map((b) => {
                const bytes = browserTotals[b.key] ?? 0;
                return (
                  <button
                    key={b.key}
                    onClick={() => setActiveBrowser(b.key)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors",
                      activeBrowser === b.key
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent"
                    )}
                  >
                    <Globe size={13} />
                    {b.label}
                    {bytes > 0 && <span className="font-mono text-[10px] opacity-70">{formatBytes(bytes)}</span>}
                  </button>
                );
              })}
            </div>

            {browserItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <Lock size={28} className="text-text-muted opacity-40" />
                <p className="text-[13px] font-medium text-text-primary">No {activeBrowser} artifacts found</p>
              </div>
            )}

            <div className="space-y-2">
              {browserItems.map((item) => (
                <Card key={item.id} accentColor={color}>
                  <div
                    className="flex items-center gap-3 cursor-pointer"
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
                      <div className="text-[12px] font-medium text-text-primary">{item.name}</div>
                      <div className="text-[11px] font-mono text-text-muted truncate">{item.path}</div>
                    </div>
                    <SizeLabel bytes={item.sizeBytes} />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
