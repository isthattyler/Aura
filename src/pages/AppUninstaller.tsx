import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppWindow, Search } from "lucide-react";
import { useAppStore } from "@/store";
import { type InstalledApp, type AppLeftover, formatBytes, CATEGORY_COLORS } from "@/types";
import { Card, Badge, SizeLabel } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import clsx from "clsx";

export default function AppUninstaller() {
  const { addToast } = useAppStore();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [leftovers, setLeftovers] = useState<AppLeftover[]>([]);
  const [leftoverLoading, setLeftoverLoading] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  const color = CATEGORY_COLORS.apps;

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<InstalledApp[]>("list_installed_apps");
      setApps(result);
      setLoaded(true);
    } catch (e) {
      addToast({ type: "error", title: "Failed to list apps", description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  async function selectApp(app: InstalledApp) {
    setSelectedApp(app);
    setLeftoverLoading(true);
    setLeftovers([]);
    try {
      const result = await invoke<AppLeftover[]>("get_app_leftovers", { appName: app.name, bundleId: app.bundleId });
      setLeftovers(result);
    } catch {
      // leftovers are informational, not critical
    } finally {
      setLeftoverLoading(false);
    }
  }

  async function uninstall(includeLeftovers: boolean) {
    if (!selectedApp) return;
    setUninstalling(true);
    try {
      await invoke("uninstall_app", {
        appPath: selectedApp.path,
        appName: selectedApp.name,
        bundleId: selectedApp.bundleId,
        includeLeftovers,
        permanent: true,
      });
      addToast({
        type: "success",
        title: "Uninstalled",
        description: `${selectedApp.name} has been removed`,
      });
      setSelectedApp(null);
      setLeftovers([]);
      loadApps();
    } catch (e) {
      addToast({ type: "error", title: "Uninstall failed", description: String(e) });
    } finally {
      setUninstalling(false);
    }
  }

  useEffect(() => { loadApps(); }, [loadApps]);

  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase())
  );

  const leftoverBytes = leftovers.reduce((s, l) => s + l.sizeBytes, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <AppWindow size={18} style={{ color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-text-muted mb-0.5">Installed applications</div>
            <div className="font-mono font-medium text-[22px] text-text-primary">
              {loaded ? `${apps.length} apps` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* App list */}
        <div className="w-72 border-r border-border-subtle flex flex-col">
          <div className="px-3 py-2.5 border-b border-border-subtle">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search apps…"
                className="w-full bg-bg-overlay border border-border-default text-text-primary text-[12px] rounded-md pl-8 pr-3 py-1.5 placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Spinner size={20} />
              </div>
            )}

            {loaded && filtered.map((app) => (
              <button
                key={app.id}
                onClick={() => selectApp(app)}
                className={clsx(
                  "w-full text-left px-3 py-2.5 border-b border-border-subtle last:border-b-0 transition-colors",
                  selectedApp?.id === app.id
                    ? "bg-accent/10 border-l-2 border-l-accent"
                    : "hover:bg-bg-elevated"
                )}
              >
                <div className="text-[12px] font-medium text-text-primary truncate">{app.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <SizeLabel bytes={app.sizeBytes} />
                  {app.version && <span className="text-[10px] font-mono text-text-muted">{app.version}</span>}
                </div>
              </button>
            ))}

            {loaded && filtered.length === 0 && (
              <p className="text-[12px] text-text-muted text-center py-8">No apps match your search</p>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedApp && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <AppWindow size={36} className="text-text-muted opacity-40" />
              <p className="text-[13px] text-text-muted">Select an app to uninstall</p>
            </div>
          )}

          {selectedApp && (
            <div className="max-w-lg space-y-4">
              <div>
                <h3 className="text-[15px] font-medium text-text-primary">{selectedApp.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <SizeLabel bytes={selectedApp.sizeBytes} />
                  {selectedApp.version && <Badge>v{selectedApp.version}</Badge>}
                  {selectedApp.publisher && (
                    <span className="text-[11px] text-text-muted">{selectedApp.publisher}</span>
                  )}
                </div>
              </div>

              {leftoverLoading && <Spinner size={16} />}

              {leftovers.length > 0 && (
                <Card accentColor={color}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12.5px] font-medium text-text-primary">Leftover Files</div>
                    <Badge variant="warning">{formatBytes(leftoverBytes)}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {leftovers.map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-text-secondary truncate flex-1">{l.path}</span>
                        <SizeLabel bytes={l.sizeBytes} dim />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {leftovers.length === 0 && !leftoverLoading && (
                <p className="text-[12px] text-text-muted">No leftover files found</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={uninstalling}
                  onClick={() => uninstall(false)}
                >
                  Uninstall App Only
                </Button>
                {leftovers.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={uninstalling}
                    onClick={() => uninstall(true)}
                  >
                    Uninstall + Leftovers
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
