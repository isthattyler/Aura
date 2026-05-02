import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store";
import { formatBytes, CATEGORY_COLORS } from "@/types";
import { useScanCategory } from "@/hooks/useScan";
import { Card, SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function TrashBins() {
  const { addToast } = useAppStore();
  const { items, scanning, scanned, scan } = useScanCategory("trash");
  const [emptying, setEmptying] = useState(false);

  const color = CATEGORY_COLORS.trash;
  const totalBytes = items.reduce((s, i) => s + i.sizeBytes, 0);

  async function emptyTrash() {
    setEmptying(true);
    try {
      await invoke("empty_trash");
      addToast({ type: "success", title: "Trash emptied", description: `Freed ${formatBytes(totalBytes)}` });
      scan();
    } catch (e) {
      addToast({ type: "error", title: "Failed to empty trash", description: String(e) });
    } finally {
      setEmptying(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Trash2 size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">Trash contents</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {scanned ? formatBytes(totalBytes) : "—"}
            </div>
          </div>
          <div className="flex gap-2">
            {scanned && items.length > 0 && (
              <Button variant="danger" size="sm" loading={emptying} onClick={emptyTrash}>
                Empty Trash
              </Button>
            )}
            <Button
              variant={scanned ? "secondary" : "primary"}
              size="sm"
              icon={scanned ? RefreshCw : undefined}
              loading={scanning}
              onClick={scan}
            >
              {scanned ? "Re-scan" : "Scan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!scanned && !scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Trash2 size={36} className="text-text-muted opacity-40" />
            <p className="text-[13px] text-text-muted">Scan to check trash bins across all volumes</p>
            <Button variant="primary" onClick={scan}>Start Scan</Button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size={28} />
            <p className="text-[13px] text-text-secondary">Scanning trash bins…</p>
          </div>
        )}

        {scanned && (
          <div className="space-y-3">
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <div className="text-[28px]">🗑️</div>
                <p className="text-[13px] font-medium text-text-primary">Trash is empty</p>
                <p className="text-[12px] text-text-muted">No items to clean</p>
              </div>
            )}

            {items.map((item) => (
              <Card key={item.id} accentColor={color}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-text-primary truncate">{item.name}</div>
                    <div className="text-[11px] font-mono text-text-muted truncate mt-0.5">{item.path}</div>
                  </div>
                  <SizeLabel bytes={item.sizeBytes} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
