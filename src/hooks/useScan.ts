import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type ScanItem, type ScanCategory, type ScanProgress } from "@/types";
import { useAppStore } from "@/store";

export function useScanCategory(category: ScanCategory) {
  const { addToast, scanResults, scanStatus } = useAppStore();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  // On mount, use cached Smart Scan results if available
  useEffect(() => {
    if (scanStatus === "complete" && scanResults) {
      const cachedItems = scanResults.items.filter((i) => i.category === category);
      if (cachedItems.length > 0) {
        setItems(cachedItems);
        setScanned(true);
      }
    }
  }, [category, scanStatus, scanResults]);

  const scan = useCallback(async () => {
    setScanning(true);
    setScanned(false);
    setProgress(null);
    try {
      const result = await invoke<ScanItem[]>("scan_category", { category });
      setItems(result);
      setScanned(true);
    } catch (e) {
      addToast({ type: "error", title: "Scan failed", description: String(e) });
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, [category, addToast]);

  return { items, scanning, scanned, progress, scan, setItems };
}
