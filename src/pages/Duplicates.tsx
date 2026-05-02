import { useMemo } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store";
import { type ScanItem, formatBytes, CATEGORY_COLORS } from "@/types";
import { useScanCategory } from "@/hooks/useScan";
import { Card, Badge, SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function Duplicates() {
  const { setActionSheetOpen, selectedItemIds, toggleItemSelection } = useAppStore();
  const { items, scanning, scanned, scan } = useScanCategory("duplicates");

  const color = CATEGORY_COLORS.duplicates;
  const groups = useMemo(() => {
    const map = new Map<string, ScanItem[]>();
    for (const item of items) {
      if (item.groupId) {
        const g = map.get(item.groupId) ?? [];
        g.push(item);
        map.set(item.groupId, g);
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      const sizeA = a[1].reduce((s, i) => s + i.sizeBytes, 0);
      const sizeB = b[1].reduce((s, i) => s + i.sizeBytes, 0);
      return sizeB - sizeA;
    });
  }, [items]);

  const totalBytes = groups.reduce((s, [, g]) => s + g.reduce((sg, i) => sg + (i.safe ? i.sizeBytes : 0), 0), 0);
  const selectedCount = items.filter((i) => selectedItemIds.has(i.id)).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Copy size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">
              {scanned ? `${groups.length} duplicate groups` : "Duplicate files"}
            </div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {scanned ? formatBytes(totalBytes) + " reclaimable" : "—"}
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
            <Copy size={36} className="text-text-muted opacity-40" />
            <p className="text-[13px] text-text-muted">
              Find duplicate files using SHA-256 content hashing
            </p>
            <Button variant="primary" onClick={scan}>Start Scan</Button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size={28} />
            <p className="text-[13px] text-text-secondary">Scanning for duplicates…</p>
          </div>
        )}

        {scanned && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <div className="text-[28px]">✅</div>
            <p className="text-[13px] font-medium text-text-primary">No duplicates found</p>
          </div>
        )}

        {scanned && (
          <div className="space-y-4">
            {groups.map(([hash, group]) => {
              const groupBytes = group.reduce((s, i) => s + (i.safe ? i.sizeBytes : 0), 0);
              return (
                <Card key={hash} accentColor={color}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Copy size={14} style={{ color }} />
                      <span className="text-[13px] font-medium text-text-primary">{group.length} copies</span>
                      <Badge variant="warning">{formatBytes(groupBytes)} reclaimable</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => group.forEach((i) => !selectedItemIds.has(i.id) && toggleItemSelection(i.id))}
                    >
                      Select all
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {group.map((item) => (
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
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-text-secondary font-mono truncate">{item.path}</div>
                          <div className="text-[10px] text-text-muted mt-0.5">
                            Modified: {item.lastModified ? item.lastModified.slice(0, 10) : "—"}
                            {!item.safe && " · Kept (newest)"}
                          </div>
                        </div>
                        <SizeLabel bytes={item.sizeBytes} dim />
                        {!item.safe && (
                          <Badge variant="info">Kept</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
