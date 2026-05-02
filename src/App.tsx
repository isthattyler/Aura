import { useEffect, useCallback, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/store";
import { type SystemStats, type ScanProgress } from "@/types";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import ToastContainer from "@/components/ui/Toast";
import ActionSheet from "@/components/ui/ActionSheet";
import Spinner from "@/components/ui/Spinner";
import OnboardingOverlay from "@/components/OnboardingOverlay";

// Lazy-loaded pages
const Dashboard       = lazy(() => import("@/pages/Dashboard"));
const SystemJunk      = lazy(() => import("@/pages/SystemJunk"));
const TrashBins       = lazy(() => import("@/pages/TrashBins"));
const LargeFiles      = lazy(() => import("@/pages/LargeFiles"));
const Duplicates      = lazy(() => import("@/pages/Duplicates"));
const AppUninstaller  = lazy(() => import("@/pages/AppUninstaller"));
const StartupManager  = lazy(() => import("@/pages/StartupManager"));
const Privacy         = lazy(() => import("@/pages/Privacy"));
const DiskSpace       = lazy(() => import("@/pages/DiskSpace"));
const Maintenance     = lazy(() => import("@/pages/Maintenance"));
const Settings        = lazy(() => import("@/pages/Settings"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner size={24} />
    </div>
  );
}

function ActivePage() {
  const currentPage = useAppStore((s) => s.currentPage);
  const pages = {
    dashboard:       <Dashboard />,
    system_junk:     <SystemJunk />,
    trash:           <TrashBins />,
    large_files:     <LargeFiles />,
    duplicates:      <Duplicates />,
    app_uninstaller: <AppUninstaller />,
    startup:         <StartupManager />,
    privacy:         <Privacy />,
    disk:            <DiskSpace />,
    maintenance:     <Maintenance />,
    settings:        <Settings />,
  };
  return (
    <Suspense fallback={<PageFallback />}>
      <div key={currentPage} className="animate-fade-up h-full">
        {pages[currentPage]}
      </div>
    </Suspense>
  );
}

export default function App() {
  const { setSystemStats, setScanProgress, setScanStatus, setPlatform, setCurrentPage, addToast, settings } =
    useAppStore();

  // ── Apply theme ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === ",") {
      e.preventDefault();
      setCurrentPage("settings");
    }
  }, [setCurrentPage]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Initialize: fetch platform + system stats ────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const platform = await invoke<"macos" | "windows" | "linux">("get_platform");
        setPlatform(platform);

        const stats = await invoke<SystemStats>("get_system_stats");
        setSystemStats(stats);
      } catch (e) {
        console.error("Init failed:", e);
      }
    }
    void init();
  }, [setPlatform, setSystemStats]);

  // ── Poll system stats every 5s ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const stats = await invoke<SystemStats>("get_system_stats");
        setSystemStats(stats);
      } catch {
        // silent — stats are non-critical
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [setSystemStats]);

  // ── Listen for scan progress events ─────────────────────────────────────
  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan_progress", (event) => {
      setScanProgress(event.payload);
    });

    const unlistenComplete = listen("scan_complete", () => {
      setScanStatus("complete");
      setScanProgress(null);
      addToast({ type: "success", title: "Scan complete", description: "Review your results below." });
    });

    const unlistenError = listen<string>("scan_error", (event) => {
      setScanStatus("error");
      setScanProgress(null);
      addToast({ type: "error", title: "Scan failed", description: event.payload });
    });

    return () => {
      void unlisten.then((fn) => fn());
      void unlistenComplete.then((fn) => fn());
      void unlistenError.then((fn) => fn());
    };
  }, [setScanProgress, setScanStatus, addToast]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <ActivePage />
        </main>
      </div>

      {/* Global overlays */}
      <ToastContainer />
      <ActionSheet />
      <OnboardingOverlay />
    </div>
  );
}
