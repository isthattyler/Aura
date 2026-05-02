import { Trash2, AlertTriangle } from "lucide-react";
import { useAppStore, selectSelectedBytes, selectSelectedItems } from "@/store";
import { formatBytes } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import Button from "./Button";
import { useState } from "react";

export default function ActionSheet() {
  const {
    isActionSheetOpen,
    setActionSheetOpen,
    selectedItemIds,
    clearSelection,
    setScanResults,
    settings,
    addToast,
  } = useAppStore();

  const selectedItems = useAppStore(selectSelectedItems);
  const selectedBytes = useAppStore(selectSelectedBytes);
  const [cleaning, setCleaning] = useState(false);

  if (!isActionSheetOpen) return null;

  async function handleClean() {
    setCleaning(true);
    try {
      await invoke("clean_items", {
        itemIds: Array.from(selectedItemIds),
        permanent: settings.deleteMode === "permanent",
      });
      addToast({
        type: "success",
        title: `Cleaned ${selectedItems.length} items`,
        description: `${formatBytes(selectedBytes)} freed`,
      });
      clearSelection();
      // Refresh results
      const results = await invoke("get_scan_results");
      setScanResults(results as never);
    } catch (e) {
      addToast({ type: "error", title: "Clean failed", description: String(e) });
    } finally {
      setCleaning(false);
      setActionSheetOpen(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={() => setActionSheetOpen(false)}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-[220px] right-0 z-50 p-5">
        <div className="max-w-xl mx-auto bg-bg-elevated border border-border-default rounded-2xl p-5 shadow-lg animate-fade-up">
          {/* Warning header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-danger/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={17} className="text-danger" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[15px] text-text-primary">
                Confirm Clean
              </h3>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {settings.deleteMode === "permanent"
                  ? "Items will be permanently deleted and cannot be recovered."
                  : "Items will be moved to Trash. You can restore them later."}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 p-3 bg-bg-surface rounded-xl border border-border-subtle mb-4">
            <div className="text-center px-3 border-r border-border-subtle">
              <div className="font-mono font-medium text-[18px] text-text-primary">
                {selectedItems.length}
              </div>
              <div className="text-[10px] text-text-muted">items</div>
            </div>
            <div className="text-center px-3">
              <div className="font-mono font-medium text-[18px] text-accent">
                {formatBytes(selectedBytes)}
              </div>
              <div className="text-[10px] text-text-muted">to free</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setActionSheetOpen(false)}
              disabled={cleaning}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              icon={Trash2}
              loading={cleaning}
              onClick={handleClean}
            >
              {settings.deleteMode === "permanent" ? "Delete Permanently" : "Move to Trash"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
