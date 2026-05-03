import { create } from "zustand";
import {
  type Page,
  type ScanCategory,
  type ScanStatus,
  type ScanResults,
  type ScanProgress,
  type SystemStats,
  type Toast,
  type AppSettings,
  type CleanResult,
  DEFAULT_SETTINGS,
} from "@/types";

const SETTINGS_STORAGE_KEY = "aura-settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore — use defaults
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore — settings not persisted
  }
}

// ─────────────────────────────────────────
// Store Shape
// ─────────────────────────────────────────

interface AppStore {
  // Navigation
  currentPage: Page;
  setCurrentPage: (page: Page) => void;

  // Scan State
  scanStatus: ScanStatus;
  scanProgress: ScanProgress | null;
  scanResults: ScanResults | null;
  selectedItemIds: Set<string>;

  setScanStatus: (status: ScanStatus) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setScanResults: (results: ScanResults | null) => void;
  toggleItemSelection: (id: string) => void;
  selectAllInCategory: (category: string) => void;
  clearSelection: () => void;

  // Scan UI State (persists across tab navigation)
  categoryBytes: Partial<Record<ScanCategory, number>>;
  completedCategories: Set<ScanCategory>;
  selectedCategories: Set<ScanCategory>;

  addCompletedCategory: (cat: ScanCategory, bytes: number) => void;
  toggleSelectedCategory: (cat: ScanCategory) => void;
  setSelectedCategories: (cats: Set<ScanCategory>) => void;
  resetScanState: () => void;

  // Clean State
  cleanResult: CleanResult | null;
  setCleanResult: (result: CleanResult | null) => void;

  // System Stats
  systemStats: SystemStats | null;
  setSystemStats: (stats: SystemStats) => void;

  // Platform
  platform: "macos" | "windows" | "linux" | null;
  setPlatform: (p: "macos" | "windows" | "linux") => void;

  // Toast Queue
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  // UI State
  isActionSheetOpen: boolean;
  setActionSheetOpen: (open: boolean) => void;
}

// ─────────────────────────────────────────
// Store Implementation
// ─────────────────────────────────────────

let toastCounter = 0;

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Navigation ────────────────────────
  currentPage: "dashboard",
  setCurrentPage: (page) => set({ currentPage: page }),

  // ── Scan State ────────────────────────
  scanStatus: "idle",
  scanProgress: null,
  scanResults: null,
  selectedItemIds: new Set(),

  setScanStatus: (status) => set({ scanStatus: status }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  setScanResults: (results) => set({ scanResults: results }),

  toggleItemSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedItemIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedItemIds: next };
    }),

  selectAllInCategory: (category) =>
    set((state) => {
      const items = state.scanResults?.items.filter(
        (i) => i.category === category
      ) ?? [];
      const next = new Set(state.selectedItemIds);
      items.forEach((i) => next.add(i.id));
      return { selectedItemIds: next };
    }),

  clearSelection: () => set({ selectedItemIds: new Set() }),

  // ── Scan UI State (persists across tab nav) ──
  categoryBytes: {},
  completedCategories: new Set<ScanCategory>(),
  selectedCategories: new Set<ScanCategory>(),

  addCompletedCategory: (cat, bytes) =>
    set((state) => ({
      categoryBytes: { ...state.categoryBytes, [cat]: bytes },
      completedCategories: new Set(state.completedCategories).add(cat),
    })),

  toggleSelectedCategory: (cat) =>
    set((state) => {
      const next = new Set(state.selectedCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return { selectedCategories: next };
    }),

  setSelectedCategories: (cats) => set({ selectedCategories: cats }),

  resetScanState: () => set({
    scanProgress: null,
    scanResults: null,
    categoryBytes: {},
    completedCategories: new Set<ScanCategory>(),
    selectedCategories: new Set<ScanCategory>(),
  }),

  // ── Clean State ───────────────────────
  cleanResult: null,
  setCleanResult: (result) => set({ cleanResult: result }),

  // ── System Stats ──────────────────────
  systemStats: null,
  setSystemStats: (stats) => set({ systemStats: stats }),

  // ── Platform ──────────────────────────
  platform: null,
  setPlatform: (p) => set({ platform: p }),

  // ── Toasts ────────────────────────────
  toasts: [],
  addToast: (toast) => {
    const id = String(++toastCounter);
    set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }));
    // Auto-dismiss after 4s
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // ── Settings ──────────────────────────
  settings: loadSettings(),
  updateSettings: (patch) =>
    set((state) => {
      const next = { ...state.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    }),

  // ── UI State ──────────────────────────
  isActionSheetOpen: false,
  setActionSheetOpen: (open) => set({ isActionSheetOpen: open }),
}));

// ─────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────

export const selectSelectedItems = (state: AppStore) =>
  state.scanResults?.items.filter((i) => state.selectedItemIds.has(i.id)) ?? [];

export const selectSelectedBytes = (state: AppStore) =>
  selectSelectedItems(state).reduce((sum, i) => sum + i.sizeBytes, 0);

export const selectIsScanRunning = (state: AppStore) =>
  state.scanStatus === "scanning";
